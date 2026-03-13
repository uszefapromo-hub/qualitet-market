'use strict'

/**
 * Social Commerce Routes – /api/social
 *
 * GET    /api/social/feed           – paginated product/post feed
 * GET    /api/social/trending       – trending posts by viral score
 * POST   /api/social/posts          – create a new post
 * GET    /api/social/posts/:id      – get single post with comments
 * DELETE /api/social/posts/:id      – delete own post
 * POST   /api/social/posts/:id/like   – toggle like on a post
 * POST   /api/social/posts/:id/comment – add a comment
 * DELETE /api/social/posts/:postId/comments/:commentId – delete comment
 * POST   /api/social/posts/:id/share   – record a share
 */

const { Router } = require('express')
const { body, query, param, validationResult } = require('express-validator')
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

// Recalculate viral score: likes*3 + comments*5 + shares*7 + log(views+1)
async function refreshViralScore(postId) {
  await db.query(
    `UPDATE social_posts
        SET viral_score = (likes_count * 3 + comments_count * 5 + shares_count * 7 + ln(views_count + 1)),
            updated_at  = NOW()
      WHERE id = $1`,
    [postId]
  )
}

// ─── GET /api/social/feed ─────────────────────────────────────────────────────
router.get(
  '/feed',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('offset').optional().isInt({ min: 0 }),
    query('type').optional().isIn(['general', 'product', 'promotion', 'live_recap']),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 20)
      const offset = parseInt(req.query.offset, 10) || 0
      const typeFilter = req.query.type || null

      const result = await db.query(
        `SELECT sp.id, sp.content, sp.media_urls, sp.post_type,
                sp.likes_count, sp.comments_count, sp.shares_count, sp.views_count,
                sp.viral_score, sp.created_at,
                u.id AS author_id,
                COALESCE(u.name, u.email) AS author_name,
                st.id AS store_id, st.name AS store_name,
                p.id AS product_id, p.name AS product_name, p.price AS product_price
           FROM social_posts sp
           JOIN users u ON sp.user_id = u.id
      LEFT JOIN stores st ON sp.store_id = st.id
      LEFT JOIN products p ON sp.product_id = p.id
          WHERE sp.is_active = TRUE
            AND ($3::text IS NULL OR sp.post_type = $3)
          ORDER BY sp.created_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset, typeFilter]
      )

      // Increment views in the background (fire-and-forget)
      if (result.rows.length > 0) {
        const ids = result.rows.map((r) => r.id)
        db.query(
          `UPDATE social_posts SET views_count = views_count + 1 WHERE id = ANY($1::uuid[])`,
          [ids]
        ).catch(() => {})
      }

      res.json({ posts: result.rows, limit, offset })
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/social/trending ─────────────────────────────────────────────────
router.get('/trending', async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10)

    const result = await db.query(
      `SELECT sp.id, sp.content, sp.media_urls, sp.post_type,
              sp.likes_count, sp.comments_count, sp.shares_count, sp.viral_score,
              sp.created_at,
              u.id AS author_id,
              COALESCE(u.name, u.email) AS author_name,
              p.id AS product_id, p.name AS product_name, p.price AS product_price
         FROM social_posts sp
         JOIN users u ON sp.user_id = u.id
    LEFT JOIN products p ON sp.product_id = p.id
        WHERE sp.is_active = TRUE
          AND sp.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY sp.viral_score DESC, sp.created_at DESC
        LIMIT $1`,
      [limit]
    )

    res.json({ posts: result.rows })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/social/posts ───────────────────────────────────────────────────
router.post(
  '/posts',
  authenticate,
  [
    body('content').notEmpty().withMessage('Treść jest wymagana').isLength({ max: 2000 }).withMessage('Treść zbyt długa'),
    body('post_type').optional().isIn(['general', 'product', 'promotion', 'live_recap']).withMessage('Nieprawidłowy typ posta'),
    body('product_id').optional().isUUID().withMessage('Nieprawidłowy format product_id'),
    body('store_id').optional().isUUID().withMessage('Nieprawidłowy format store_id'),
    body('media_urls').optional().isArray().withMessage('media_urls musi być tablicą'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { content, post_type = 'general', product_id = null, store_id = null, media_urls = [] } = req.body

      const result = await db.query(
        `INSERT INTO social_posts (user_id, store_id, product_id, content, media_urls, post_type)
              VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           RETURNING id, content, post_type, likes_count, comments_count, shares_count, created_at`,
        [req.user.id, store_id, product_id, content, JSON.stringify(media_urls), post_type]
      )

      res.status(201).json({ post: result.rows[0] })
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/social/posts/:id ────────────────────────────────────────────────
router.get(
  '/posts/:id',
  [param('id').isUUID().withMessage('Nieprawidłowy format id')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const postResult = await db.query(
        `SELECT sp.id, sp.content, sp.media_urls, sp.post_type,
                sp.likes_count, sp.comments_count, sp.shares_count, sp.views_count,
                sp.viral_score, sp.created_at,
                u.id AS author_id,
                COALESCE(u.name, u.email) AS author_name,
                p.id AS product_id, p.name AS product_name, p.price AS product_price
           FROM social_posts sp
           JOIN users u ON sp.user_id = u.id
      LEFT JOIN products p ON sp.product_id = p.id
          WHERE sp.id = $1 AND sp.is_active = TRUE`,
        [req.params.id]
      )

      if (!postResult.rows.length) return res.status(404).json({ error: 'Post nie istnieje' })

      const commentsResult = await db.query(
        `SELECT sc.id, sc.content, sc.created_at,
                COALESCE(u.name, u.email) AS author_name
           FROM social_comments sc
           JOIN users u ON sc.user_id = u.id
          WHERE sc.post_id = $1 AND sc.is_active = TRUE
          ORDER BY sc.created_at ASC
          LIMIT 50`,
        [req.params.id]
      )

      res.json({ post: postResult.rows[0], comments: commentsResult.rows })
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/social/posts/:id ────────────────────────────────────────────
router.delete(
  '/posts/:id',
  authenticate,
  [param('id').isUUID().withMessage('Nieprawidłowy format id')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const isAdmin = ['admin', 'owner'].includes(req.user.role)
      const result = await db.query(
        `UPDATE social_posts SET is_active = FALSE
          WHERE id = $1 AND ($2 OR user_id = $3)
          RETURNING id`,
        [req.params.id, isAdmin, req.user.id]
      )

      if (!result.rows.length) return res.status(404).json({ error: 'Post nie istnieje lub brak uprawnień' })
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/social/posts/:id/like ─────────────────────────────────────────
router.post(
  '/posts/:id/like',
  authenticate,
  [param('id').isUUID().withMessage('Nieprawidłowy format id')],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      // Check post exists
      const postCheck = await db.query(`SELECT id FROM social_posts WHERE id = $1 AND is_active = TRUE`, [req.params.id])
      if (!postCheck.rows.length) return res.status(404).json({ error: 'Post nie istnieje' })

      // Toggle like
      const existing = await db.query(
        `SELECT id FROM social_likes WHERE post_id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      )

      let liked
      if (existing.rows.length) {
        await db.query(`DELETE FROM social_likes WHERE post_id = $1 AND user_id = $2`, [req.params.id, req.user.id])
        await db.query(`UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`, [req.params.id])
        liked = false
      } else {
        await db.query(`INSERT INTO social_likes (post_id, user_id) VALUES ($1, $2)`, [req.params.id, req.user.id])
        await db.query(`UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = $1`, [req.params.id])
        liked = true
      }

      refreshViralScore(req.params.id).catch(() => {})

      const updated = await db.query(`SELECT likes_count FROM social_posts WHERE id = $1`, [req.params.id])
      res.json({ liked, likes_count: updated.rows[0]?.likes_count ?? 0 })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/social/posts/:id/comment ──────────────────────────────────────
router.post(
  '/posts/:id/comment',
  authenticate,
  [
    param('id').isUUID().withMessage('Nieprawidłowy format id'),
    body('content').notEmpty().withMessage('Treść komentarza jest wymagana').isLength({ max: 500 }).withMessage('Komentarz zbyt długi'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const postCheck = await db.query(`SELECT id FROM social_posts WHERE id = $1 AND is_active = TRUE`, [req.params.id])
      if (!postCheck.rows.length) return res.status(404).json({ error: 'Post nie istnieje' })

      const result = await db.query(
        `INSERT INTO social_comments (post_id, user_id, content) VALUES ($1, $2, $3)
         RETURNING id, content, created_at`,
        [req.params.id, req.user.id, req.body.content]
      )

      await db.query(`UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = $1`, [req.params.id])
      refreshViralScore(req.params.id).catch(() => {})

      res.status(201).json({ comment: result.rows[0] })
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/social/posts/:postId/comments/:commentId ────────────────────
router.delete(
  '/posts/:postId/comments/:commentId',
  authenticate,
  [
    param('postId').isUUID().withMessage('Nieprawidłowy format postId'),
    param('commentId').isUUID().withMessage('Nieprawidłowy format commentId'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const isAdmin = ['admin', 'owner'].includes(req.user.role)
      const result = await db.query(
        `UPDATE social_comments SET is_active = FALSE
          WHERE id = $1 AND post_id = $2 AND ($3 OR user_id = $4)
          RETURNING id`,
        [req.params.commentId, req.params.postId, isAdmin, req.user.id]
      )

      if (!result.rows.length) return res.status(404).json({ error: 'Komentarz nie istnieje lub brak uprawnień' })

      await db.query(`UPDATE social_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1`, [req.params.postId])
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/social/posts/:id/share ────────────────────────────────────────
router.post(
  '/posts/:id/share',
  authenticate,
  [
    param('id').isUUID().withMessage('Nieprawidłowy format id'),
    body('platform').optional().isIn(['internal', 'facebook', 'instagram', 'tiktok', 'twitter', 'whatsapp']).withMessage('Nieprawidłowa platforma'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const postCheck = await db.query(`SELECT id FROM social_posts WHERE id = $1 AND is_active = TRUE`, [req.params.id])
      if (!postCheck.rows.length) return res.status(404).json({ error: 'Post nie istnieje' })

      const platform = req.body.platform || 'internal'
      await db.query(
        `INSERT INTO social_shares (post_id, user_id, platform) VALUES ($1, $2, $3)`,
        [req.params.id, req.user.id, platform]
      )
      await db.query(`UPDATE social_posts SET shares_count = shares_count + 1 WHERE id = $1`, [req.params.id])
      refreshViralScore(req.params.id).catch(() => {})

      const updated = await db.query(`SELECT shares_count FROM social_posts WHERE id = $1`, [req.params.id])
      res.json({ shared: true, shares_count: updated.rows[0]?.shares_count ?? 0 })
    } catch (err) {
      next(err)
    }
  }
)

module.exports = router
