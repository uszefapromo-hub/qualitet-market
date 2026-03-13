'use strict'

/**
 * Reputation & Rating Routes – /api/reputation
 *
 * POST   /api/reputation/sellers/:sellerId/rate        – rate a seller after purchase (buyer)
 * GET    /api/reputation/sellers/:sellerId             – seller reputation summary
 * POST   /api/reputation/products/:productId/review   – submit product review (authenticated)
 * GET    /api/reputation/products/:productId/reviews  – get product reviews (public)
 * GET    /api/reputation/creators/:creatorId/score    – get creator reputation score
 * GET    /api/reputation/users/:userId/badges         – get badges earned by a user
 * GET    /api/reputation/badges                       – list all badge definitions
 * POST   /api/reputation/badges/award                 – award badge to user (admin only)
 * PUT    /api/reputation/creators/:creatorId/score    – update creator score (admin only)
 */

const { Router } = require('express')
const { body, param, query, validationResult } = require('express-validator')
const { authenticate } = require('../middleware/auth')
const db = require('../config/database')

const router = Router()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validationErrors(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg })
    return true
  }
  return false
}

function requireAdmin(req, res, next) {
  if (!['admin', 'owner'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Brak uprawnień administratora' })
  }
  next()
}

/**
 * Compute a composite reputation score from component metrics.
 * Formula: 40% avg_rating + 30% delivery + 20% conversion + 10% engagement
 */
function computeReputationScore({ avg_rating, delivery_score, conversion_rate, engagement_score }) {
  const r = parseFloat(avg_rating) || 0
  const d = parseFloat(delivery_score) || 0
  const c = parseFloat(conversion_rate) || 0
  const e = parseFloat(engagement_score) || 0

  // Normalize each component to 0-100
  const ratingNorm    = (r / 5) * 100
  const deliveryNorm  = (d / 5) * 100
  const convNorm      = Math.min(c, 100)
  const engNorm       = Math.min(e, 100)

  return parseFloat(
    (ratingNorm * 0.4 + deliveryNorm * 0.3 + convNorm * 0.2 + engNorm * 0.1).toFixed(2)
  )
}

// ─── POST /sellers/:sellerId/rate ─────────────────────────────────────────────

router.post(
  '/sellers/:sellerId/rate',
  authenticate,
  [
    param('sellerId').isUUID().withMessage('Nieprawidłowe ID sprzedawcy'),
    body('order_id').isUUID().withMessage('Wymagane prawidłowe ID zamówienia'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Ocena musi być liczbą 1-5'),
    body('comment').optional().isString().isLength({ max: 1000 })
      .withMessage('Komentarz może mieć maksymalnie 1000 znaków'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { sellerId } = req.params
    const { order_id, rating, comment } = req.body
    const buyerId = req.user.id

    try {
      // Verify the order belongs to this buyer and the store belongs to the seller
      const orderRes = await db.query(
        `SELECT o.id, o.buyer_id, s.owner_id AS seller_id
           FROM orders o
           JOIN stores s ON s.id = o.store_id
          WHERE o.id = $1`,
        [order_id]
      )
      if (!orderRes.rows.length) {
        return res.status(404).json({ error: 'Zamówienie nie istnieje' })
      }

      const order = orderRes.rows[0]
      if (order.buyer_id !== buyerId) {
        return res.status(403).json({ error: 'Możesz oceniać tylko własne zamówienia' })
      }
      if (order.seller_id !== sellerId) {
        return res.status(400).json({ error: 'Zamówienie nie pochodzi od tego sprzedawcy' })
      }

      // Insert rating (UNIQUE constraint prevents duplicates)
      const result = await db.query(
        `INSERT INTO seller_ratings (order_id, seller_id, buyer_id, rating, comment)
              VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id, buyer_id) DO NOTHING
           RETURNING *`,
        [order_id, sellerId, buyerId, rating, comment || null]
      )

      if (!result.rows.length) {
        return res.status(409).json({ error: 'To zamówienie zostało już ocenione' })
      }

      // Recalculate avg_rating in creator_scores for this seller
      await db.query(
        `INSERT INTO creator_scores (creator_id, avg_rating, total_reviews, reputation_score)
              VALUES ($1,
                (SELECT COALESCE(AVG(rating),0) FROM seller_ratings WHERE seller_id = $1),
                (SELECT COUNT(*)               FROM seller_ratings WHERE seller_id = $1),
                0)
         ON CONFLICT (creator_id) DO UPDATE
                SET avg_rating    = (SELECT COALESCE(AVG(rating),0) FROM seller_ratings WHERE seller_id = $1),
                    total_reviews = (SELECT COUNT(*)                FROM seller_ratings WHERE seller_id = $1),
                    updated_at    = NOW()`,
        [sellerId]
      )

      return res.status(201).json({ message: 'Ocena została dodana', rating: result.rows[0] })
    } catch (err) {
      console.error('POST /reputation/sellers/:id/rate', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /sellers/:sellerId ────────────────────────────────────────────────────

router.get(
  '/sellers/:sellerId',
  [param('sellerId').isUUID().withMessage('Nieprawidłowe ID sprzedawcy')],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { sellerId } = req.params

    try {
      // Aggregated stats
      const statsRes = await db.query(
        `SELECT
            COUNT(*)                              AS total_ratings,
            COALESCE(AVG(rating), 0)              AS avg_rating,
            COALESCE(AVG(CASE WHEN rating = 5 THEN 1.0 ELSE 0.0 END) * 100, 0) AS five_star_pct,
            COUNT(CASE WHEN comment IS NOT NULL AND comment != '' THEN 1 END) AS with_comment
           FROM seller_ratings
          WHERE seller_id = $1`,
        [sellerId]
      )

      // Distribution 1-5
      const distRes = await db.query(
        `SELECT rating, COUNT(*) AS cnt
           FROM seller_ratings
          WHERE seller_id = $1
          GROUP BY rating
          ORDER BY rating`,
        [sellerId]
      )

      // Reputation score from creator_scores (if computed)
      const scoreRes = await db.query(
        `SELECT reputation_score, sales_generated, conversion_rate, engagement_score
           FROM creator_scores
          WHERE creator_id = $1`,
        [sellerId]
      )

      // Recent comments
      const commentsRes = await db.query(
        `SELECT sr.rating, sr.comment, sr.created_at, u.name AS buyer_name
           FROM seller_ratings sr
           JOIN users u ON u.id = sr.buyer_id
          WHERE sr.seller_id = $1 AND sr.comment IS NOT NULL AND sr.comment != ''
          ORDER BY sr.created_at DESC
          LIMIT 10`,
        [sellerId]
      )

      const stats = statsRes.rows[0]
      const score = scoreRes.rows[0] || {}

      return res.json({
        seller_id:         sellerId,
        total_ratings:     parseInt(stats.total_ratings, 10),
        avg_rating:        parseFloat(parseFloat(stats.avg_rating).toFixed(2)),
        five_star_pct:     parseFloat(parseFloat(stats.five_star_pct).toFixed(1)),
        with_comment:      parseInt(stats.with_comment, 10),
        distribution:      distRes.rows.map((r) => ({ rating: r.rating, count: parseInt(r.cnt, 10) })),
        reputation_score:  parseFloat(score.reputation_score || 0),
        sales_generated:   parseFloat(score.sales_generated || 0),
        conversion_rate:   parseFloat(score.conversion_rate || 0),
        engagement_score:  parseFloat(score.engagement_score || 0),
        recent_comments:   commentsRes.rows,
      })
    } catch (err) {
      console.error('GET /reputation/sellers/:id', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── POST /products/:productId/review ─────────────────────────────────────────

router.post(
  '/products/:productId/review',
  authenticate,
  [
    param('productId').isUUID().withMessage('Nieprawidłowe ID produktu'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Ocena musi być liczbą 1-5'),
    body('comment').optional().isString().isLength({ max: 2000 })
      .withMessage('Komentarz może mieć maksymalnie 2000 znaków'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { productId } = req.params
    const { rating, comment } = req.body
    const reviewerId = req.user.id

    try {
      // Verify product exists
      const productRes = await db.query('SELECT id FROM products WHERE id = $1', [productId])
      if (!productRes.rows.length) {
        return res.status(404).json({ error: 'Produkt nie istnieje' })
      }

      const result = await db.query(
        `INSERT INTO product_reviews (product_id, reviewer_id, rating, comment)
              VALUES ($1, $2, $3, $4)
         ON CONFLICT (product_id, reviewer_id) DO UPDATE
                SET rating     = EXCLUDED.rating,
                    comment    = EXCLUDED.comment,
                    created_at = NOW()
           RETURNING *`,
        [productId, reviewerId, rating, comment || null]
      )

      return res.status(201).json({ message: 'Recenzja została zapisana', review: result.rows[0] })
    } catch (err) {
      console.error('POST /reputation/products/:id/review', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /products/:productId/reviews ─────────────────────────────────────────

router.get(
  '/products/:productId/reviews',
  [
    param('productId').isUUID().withMessage('Nieprawidłowe ID produktu'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { productId } = req.params
    const limit  = Math.min(100, parseInt(req.query.limit, 10) || 20)
    const offset = (Math.max(1, parseInt(req.query.page, 10) || 1) - 1) * limit

    try {
      const [summaryRes, reviewsRes] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS avg_rating
             FROM product_reviews WHERE product_id = $1`,
          [productId]
        ),
        db.query(
          `SELECT pr.id, pr.rating, pr.comment, pr.created_at, u.name AS reviewer_name
             FROM product_reviews pr
             JOIN users u ON u.id = pr.reviewer_id
            WHERE pr.product_id = $1
            ORDER BY pr.created_at DESC
            LIMIT $2 OFFSET $3`,
          [productId, limit, offset]
        ),
      ])

      const summary = summaryRes.rows[0]

      return res.json({
        product_id:  productId,
        total:       parseInt(summary.total, 10),
        avg_rating:  parseFloat(parseFloat(summary.avg_rating).toFixed(2)),
        reviews:     reviewsRes.rows,
      })
    } catch (err) {
      console.error('GET /reputation/products/:id/reviews', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /creators/:creatorId/score ───────────────────────────────────────────

router.get(
  '/creators/:creatorId/score',
  [param('creatorId').isUUID().withMessage('Nieprawidłowe ID kreatora')],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { creatorId } = req.params

    try {
      const result = await db.query(
        `SELECT cs.*,
                u.name AS creator_name,
                u.role AS creator_role
           FROM creator_scores cs
           JOIN users u ON u.id = cs.creator_id
          WHERE cs.creator_id = $1`,
        [creatorId]
      )

      if (!result.rows.length) {
        return res.json({
          creator_id:       creatorId,
          sales_generated:  0,
          conversion_rate:  0,
          engagement_score: 0,
          avg_rating:       0,
          total_reviews:    0,
          delivery_score:   0,
          reputation_score: 0,
        })
      }

      const row = result.rows[0]
      return res.json({
        creator_id:       row.creator_id,
        creator_name:     row.creator_name,
        creator_role:     row.creator_role,
        sales_generated:  parseFloat(row.sales_generated),
        conversion_rate:  parseFloat(row.conversion_rate),
        engagement_score: parseFloat(row.engagement_score),
        avg_rating:       parseFloat(row.avg_rating),
        total_reviews:    row.total_reviews,
        delivery_score:   parseFloat(row.delivery_score),
        reputation_score: parseFloat(row.reputation_score),
        updated_at:       row.updated_at,
      })
    } catch (err) {
      console.error('GET /reputation/creators/:id/score', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /users/:userId/badges ─────────────────────────────────────────────────

router.get(
  '/users/:userId/badges',
  [param('userId').isUUID().withMessage('Nieprawidłowe ID użytkownika')],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { userId } = req.params

    try {
      const result = await db.query(
        `SELECT ub.id, ub.awarded_at,
                bd.code, bd.name, bd.description, bd.icon_url, bd.category, bd.points_reward
           FROM user_badges ub
           JOIN badge_definitions bd ON bd.id = ub.badge_id
          WHERE ub.user_id = $1
          ORDER BY ub.awarded_at DESC`,
        [userId]
      )

      return res.json({ user_id: userId, badges: result.rows })
    } catch (err) {
      console.error('GET /reputation/users/:id/badges', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /badges ───────────────────────────────────────────────────────────────

router.get('/badges', async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT id, code, name, description, icon_url, category, points_reward, is_active
         FROM badge_definitions
        WHERE is_active = TRUE
        ORDER BY category, name`
    )
    return res.json({ badges: result.rows })
  } catch (err) {
    console.error('GET /reputation/badges', err)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /badges/award (admin) ────────────────────────────────────────────────

router.post(
  '/badges/award',
  authenticate,
  requireAdmin,
  [
    body('user_id').isUUID().withMessage('Wymagane prawidłowe ID użytkownika'),
    body('badge_code').isString().notEmpty().withMessage('Wymagany kod odznaki'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { user_id, badge_code } = req.body

    try {
      const badgeRes = await db.query(
        'SELECT id FROM badge_definitions WHERE code = $1 AND is_active = TRUE',
        [badge_code]
      )
      if (!badgeRes.rows.length) {
        return res.status(404).json({ error: 'Odznaka nie istnieje lub jest nieaktywna' })
      }

      const badgeId = badgeRes.rows[0].id

      const result = await db.query(
        `INSERT INTO user_badges (user_id, badge_id)
              VALUES ($1, $2)
         ON CONFLICT (user_id, badge_id) DO NOTHING
           RETURNING *`,
        [user_id, badgeId]
      )

      if (!result.rows.length) {
        return res.status(409).json({ error: 'Użytkownik już posiada tę odznakę' })
      }

      return res.status(201).json({ message: 'Odznaka przyznana', award: result.rows[0] })
    } catch (err) {
      console.error('POST /reputation/badges/award', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── PUT /creators/:creatorId/score (admin) ────────────────────────────────────

router.put(
  '/creators/:creatorId/score',
  authenticate,
  requireAdmin,
  [
    param('creatorId').isUUID().withMessage('Nieprawidłowe ID kreatora'),
    body('sales_generated').optional().isFloat({ min: 0 }).withMessage('Nieprawidłowa wartość sprzedaży'),
    body('conversion_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Współczynnik konwersji musi być 0-100'),
    body('engagement_score').optional().isFloat({ min: 0, max: 100 }).withMessage('Wskaźnik zaangażowania musi być 0-100'),
    body('delivery_score').optional().isFloat({ min: 0, max: 5 }).withMessage('Ocena dostawy musi być 0-5'),
  ],
  async (req, res) => {
    if (validationErrors(req, res)) return

    const { creatorId } = req.params
    const { sales_generated, conversion_rate, engagement_score, delivery_score } = req.body

    try {
      // Upsert creator_scores row
      const upsertRes = await db.query(
        `INSERT INTO creator_scores (creator_id, sales_generated, conversion_rate, engagement_score, delivery_score, reputation_score)
              VALUES ($1,
                COALESCE($2, 0),
                COALESCE($3, 0),
                COALESCE($4, 0),
                COALESCE($5, 0),
                0)
         ON CONFLICT (creator_id) DO UPDATE
                SET sales_generated  = COALESCE($2, creator_scores.sales_generated),
                    conversion_rate  = COALESCE($3, creator_scores.conversion_rate),
                    engagement_score = COALESCE($4, creator_scores.engagement_score),
                    delivery_score   = COALESCE($5, creator_scores.delivery_score),
                    updated_at       = NOW()
           RETURNING *`,
        [creatorId, sales_generated ?? null, conversion_rate ?? null, engagement_score ?? null, delivery_score ?? null]
      )

      const row = upsertRes.rows[0]

      // Recalculate composite reputation_score
      const reputationScore = computeReputationScore({
        avg_rating:       row.avg_rating,
        delivery_score:   row.delivery_score,
        conversion_rate:  row.conversion_rate,
        engagement_score: row.engagement_score,
      })

      await db.query(
        'UPDATE creator_scores SET reputation_score = $1 WHERE creator_id = $2',
        [reputationScore, creatorId]
      )

      return res.json({ message: 'Wynik reputacji zaktualizowany', reputation_score: reputationScore })
    } catch (err) {
      console.error('PUT /reputation/creators/:id/score', err)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

module.exports = router
