'use strict'

/**
 * Gamification – mounted at /api/gamification
 *
 *   GET  /api/gamification/leaderboard        – top 100 users by points (public)
 *   GET  /api/gamification/my/level           – own points & level
 *   GET  /api/gamification/my/badges          – own earned badges
 *   POST /api/gamification/points             – award points for an action
 *   POST /api/gamification/badges/award       – award badge (admin/owner)
 *   POST /api/gamification/leaderboard/refresh – rebuild leaderboard cache (admin/owner)
 */

const express = require('express')
const { body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')

const db = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate } = require('../middleware/validate')

const router = express.Router()

// Points needed to reach the next level (level * 100 points per level)
function nextLevelPoints(level) {
  return (level + 1) * 100
}

// ─── GET /api/gamification/leaderboard ───────────────────────────────────────

router.get('/leaderboard', async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM leaderboard_cache ORDER BY points DESC LIMIT 100`
    )
    return res.json({ leaderboard: result.rows })
  } catch (err) {
    console.error('gamification leaderboard error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── GET /api/gamification/my/level ──────────────────────────────────────────

router.get('/my/level', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT points, level FROM user_points WHERE user_id = $1',
      [req.user.id]
    )

    const points = result.rows[0] ? result.rows[0].points : 0
    const level  = result.rows[0] ? result.rows[0].level  : 1

    return res.json({ points, level, next_level_points: nextLevelPoints(level) })
  } catch (err) {
    console.error('gamification my level error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── GET /api/gamification/my/badges ─────────────────────────────────────────

router.get('/my/badges', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, ub.awarded_at
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       WHERE ub.user_id = $1
       ORDER BY ub.awarded_at DESC`,
      [req.user.id]
    )
    return res.json({ badges: result.rows })
  } catch (err) {
    console.error('gamification my badges error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/gamification/points ───────────────────────────────────────────

router.post(
  '/points',
  authenticate,
  [
    body('action').notEmpty().isString(),
    body('points').isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const earned = parseInt(req.body.points, 10)

    try {
      const result = await db.query(
        `INSERT INTO user_points (id, user_id, points, level, updated_at)
         VALUES ($1, $2, $3, GREATEST(1, $3 / 100), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           points     = user_points.points + EXCLUDED.points,
           level      = GREATEST(1, (user_points.points + EXCLUDED.points) / 100),
           updated_at = NOW()
         RETURNING points, level`,
        [uuidv4(), req.user.id, earned]
      )

      const { points, level } = result.rows[0]
      return res.json({ points, level })
    } catch (err) {
      console.error('gamification award points error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── POST /api/gamification/badges/award ─────────────────────────────────────

router.post(
  '/badges/award',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('user_id').notEmpty().isUUID(),
    body('badge_code').notEmpty().isString(),
  ],
  validate,
  async (req, res) => {
    const { user_id, badge_code } = req.body

    try {
      const badgeResult = await db.query(
        'SELECT * FROM badges WHERE code = $1',
        [badge_code]
      )
      const badge = badgeResult.rows[0]
      if (!badge) return res.status(404).json({ error: 'Odznaka nie istnieje' })

      await db.query(
        `INSERT INTO user_badges (id, user_id, badge_id, awarded_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [uuidv4(), user_id, badge.id]
      )

      return res.json({ success: true, badge })
    } catch (err) {
      console.error('gamification award badge error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── POST /api/gamification/leaderboard/refresh ──────────────────────────────

router.post(
  '/leaderboard/refresh',
  authenticate,
  requireRole('owner', 'admin'),
  async (_req, res) => {
    try {
      // Rebuild cache from user_points + user names
      const usersResult = await db.query(
        `SELECT up.user_id, u.name AS username, up.points, up.level,
                COUNT(ub.id)::int AS badges_count
         FROM user_points up
         JOIN users u ON u.id = up.user_id
         LEFT JOIN user_badges ub ON ub.user_id = up.user_id
         GROUP BY up.user_id, u.name, up.points, up.level
         ORDER BY up.points DESC`
      )

      const rows = usersResult.rows
      let rank = 1

      for (const row of rows) {
        await db.query(
          `INSERT INTO leaderboard_cache (id, user_id, username, points, level, badges_count, rank, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             username     = EXCLUDED.username,
             points       = EXCLUDED.points,
             level        = EXCLUDED.level,
             badges_count = EXCLUDED.badges_count,
             rank         = EXCLUDED.rank,
             updated_at   = NOW()`,
          [uuidv4(), row.user_id, row.username, row.points, row.level, row.badges_count, rank]
        )
        rank++
      }

      return res.json({ refreshed: rows.length })
    } catch (err) {
      console.error('gamification leaderboard refresh error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

module.exports = router
