'use strict'

/**
 * Gamification Routes – /api/gamification
 *
 * GET    /api/gamification/leaderboard         – global leaderboard (top 50)
 * GET    /api/gamification/my/level            – current user level + points summary
 * GET    /api/gamification/my/badges           – badges earned by current user
 * GET    /api/gamification/my/points           – point transaction history
 * POST   /api/gamification/points              – award points (admin only)
 * POST   /api/gamification/badges/award        – award a badge (admin only)
 * POST   /api/gamification/leaderboard/refresh – refresh leaderboard cache (admin only)
 */

const { Router } = require('express')
const { body, query, validationResult } = require('express-validator')
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

// Level thresholds: [minPoints, level, name]
const LEVELS = [
  [0,    1, 'Nowicjusz'],
  [100,  2, 'Adept'],
  [300,  3, 'Sprzedawca'],
  [700,  4, 'Profesjonalista'],
  [1500, 5, 'Ekspert'],
  [3000, 6, 'Mistrz'],
  [6000, 7, 'Legenda'],
]

function getLevel(totalPoints) {
  let result = LEVELS[0]
  for (const entry of LEVELS) {
    if (totalPoints >= entry[0]) result = entry
    else break
  }
  return { level: result[1], name: result[2], minPoints: result[0] }
}

// ─── GET /api/gamification/leaderboard ───────────────────────────────────────
router.get('/leaderboard', async (req, res, next) => {
  try {
    const type = req.query.type || 'global'
    const validTypes = ['global', 'weekly', 'monthly', 'sellers', 'creators']
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Nieprawidłowy typ rankingu' })

    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20)

    const result = await db.query(
      `SELECT lc.rank, lc.total_points, lc.refreshed_at,
              u.id AS user_id,
              COALESCE(u.name, u.email) AS username,
              u.role
         FROM leaderboard_cache lc
         JOIN users u ON lc.user_id = u.id
        WHERE lc.leaderboard_type = $1
        ORDER BY lc.rank ASC
        LIMIT $2`,
      [type, limit]
    )

    res.json({ leaderboard_type: type, entries: result.rows })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/gamification/my/level ──────────────────────────────────────────
router.get('/my/level', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT COALESCE(SUM(points), 0) AS total_points FROM user_points WHERE user_id = $1`,
      [req.user.id]
    )
    const totalPoints = parseInt(result.rows[0].total_points, 10) || 0
    const levelInfo = getLevel(totalPoints)

    res.json({ total_points: totalPoints, ...levelInfo })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/gamification/my/badges ─────────────────────────────────────────
router.get('/my/badges', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT bd.code, bd.name, bd.description, bd.icon_url, bd.category, bd.points_reward,
              ub.awarded_at
         FROM user_badges ub
         JOIN badge_definitions bd ON ub.badge_id = bd.id
        WHERE ub.user_id = $1
        ORDER BY ub.awarded_at DESC`,
      [req.user.id]
    )
    res.json({ badges: result.rows })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/gamification/my/points ─────────────────────────────────────────
router.get(
  '/my/points',
  authenticate,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const limit = Math.min(100, parseInt(req.query.limit, 10) || 20)
      const offset = parseInt(req.query.offset, 10) || 0

      const [summary, history] = await Promise.all([
        db.query(`SELECT COALESCE(SUM(points), 0) AS total_points FROM user_points WHERE user_id = $1`, [req.user.id]),
        db.query(
          `SELECT id, points, reason, source, created_at
             FROM user_points
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3`,
          [req.user.id, limit, offset]
        ),
      ])

      const totalPoints = parseInt(summary.rows[0].total_points, 10) || 0
      res.json({ total_points: totalPoints, history: history.rows, limit, offset })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/gamification/points (admin) ────────────────────────────────────
router.post(
  '/points',
  authenticate,
  requireAdmin,
  [
    body('user_id').isUUID().withMessage('Nieprawidłowy user_id'),
    body('points').isInt({ min: -10000, max: 10000 }).withMessage('Punkty muszą być liczbą całkowitą między -10000 a 10000').custom((value) => value !== 0).withMessage('Punkty nie mogą być zerem'),
    body('reason').notEmpty().withMessage('Powód jest wymagany').isLength({ max: 120 }),
    body('source').optional().isIn(['order', 'affiliate', 'social', 'badge', 'admin', 'bonus', 'referral']),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { user_id, points, reason, source = 'admin' } = req.body

      const userCheck = await db.query(`SELECT id FROM users WHERE id = $1`, [user_id])
      if (!userCheck.rows.length) return res.status(404).json({ error: 'Użytkownik nie istnieje' })

      const result = await db.query(
        `INSERT INTO user_points (user_id, points, reason, source)
              VALUES ($1, $2, $3, $4)
           RETURNING id, points, reason, source, created_at`,
        [user_id, points, reason, source]
      )

      res.status(201).json({ transaction: result.rows[0] })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/gamification/badges/award (admin) ─────────────────────────────
router.post(
  '/badges/award',
  authenticate,
  requireAdmin,
  [
    body('user_id').isUUID().withMessage('Nieprawidłowy user_id'),
    body('badge_code').notEmpty().withMessage('Kod odznaki jest wymagany'),
  ],
  async (req, res, next) => {
    if (validationErrors(req, res)) return
    try {
      const { user_id, badge_code } = req.body

      const [userCheck, badgeCheck] = await Promise.all([
        db.query(`SELECT id FROM users WHERE id = $1`, [user_id]),
        db.query(`SELECT id, name, points_reward FROM badge_definitions WHERE code = $1 AND is_active = TRUE`, [badge_code]),
      ])

      if (!userCheck.rows.length) return res.status(404).json({ error: 'Użytkownik nie istnieje' })
      if (!badgeCheck.rows.length) return res.status(404).json({ error: 'Odznaka nie istnieje' })

      const badge = badgeCheck.rows[0]

      // Insert badge (ignore duplicate)
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [user_id, badge.id]
      )

      // Award points if badge has a reward
      if (badge.points_reward > 0) {
        await db.query(
          `INSERT INTO user_points (user_id, points, reason, source, reference_id)
                VALUES ($1, $2, $3, 'badge', $4)`,
          [user_id, badge.points_reward, `Odznaka: ${badge.name}`, badge.id]
        )
      }

      res.json({ success: true, badge_name: badge.name, points_awarded: badge.points_reward })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/gamification/leaderboard/refresh (admin) ──────────────────────
router.post('/leaderboard/refresh', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const type = req.body.type || 'global'
    const validTypes = ['global', 'weekly', 'monthly', 'sellers', 'creators']
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Nieprawidłowy typ rankingu' })

    let dateFilter = ''
    if (type === 'weekly') dateFilter = `AND up.created_at >= NOW() - INTERVAL '7 days'`
    if (type === 'monthly') dateFilter = `AND up.created_at >= NOW() - INTERVAL '30 days'`

    let roleFilter = ''
    if (type === 'sellers') roleFilter = `AND u.role IN ('seller')`
    if (type === 'creators') roleFilter = `AND u.role IN ('creator')`

    // Rebuild leaderboard entries
    const entries = await db.query(
      `SELECT u.id AS user_id, COALESCE(SUM(up.points), 0) AS total_points,
              ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(up.points), 0) DESC) AS rank
         FROM users u
    LEFT JOIN user_points up ON up.user_id = u.id ${dateFilter}
        WHERE TRUE ${roleFilter}
        GROUP BY u.id
        ORDER BY total_points DESC
        LIMIT 100`
    )

    // Delete old cache entries and insert fresh in a single statement
    await db.query(`DELETE FROM leaderboard_cache WHERE leaderboard_type = $1`, [type])

    if (entries.rows.length > 0) {
      const valuePlaceholders = entries.rows
        .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
        .join(', ')
      const flatValues = [type]
      for (const row of entries.rows) {
        flatValues.push(row.user_id, Number(row.rank), Number(row.total_points))
      }
      await db.query(
        `INSERT INTO leaderboard_cache (leaderboard_type, user_id, rank, total_points) VALUES ${valuePlaceholders}`,
        flatValues
      )
    }

    res.json({ success: true, leaderboard_type: type, entries_count: entries.rows.length })
  } catch (err) {
    next(err)
  }
})

module.exports = router
