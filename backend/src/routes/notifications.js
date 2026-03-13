'use strict'

/**
 * Notifications – mounted at /api/notifications
 *
 *   GET   /api/notifications            – list user notifications
 *   PATCH /api/notifications/:id/read   – mark single notification as read
 *   PATCH /api/notifications/read-all   – mark all notifications as read
 */

const express = require('express')

const db = require('../config/database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// ─── GET /api/notifications ───────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const unreadOnly = req.query.unread_only === 'true'
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10))
  const offset = Math.max(0,   parseInt(req.query.offset || '0',  10))

  try {
    const conditions = ['user_id = $1']
    const params = [req.user.id]

    if (unreadOnly) {
      conditions.push('is_read = FALSE')
    }

    const where = conditions.join(' AND ')

    const [countResult, rowsResult] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM notifications WHERE ${where}`, params),
      db.query(
        `SELECT * FROM notifications WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ])

    return res.json({
      notifications: rowsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    })
  } catch (err) {
    console.error('notifications list error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── PATCH /api/notifications/read-all ───────────────────────────────────────
// Must be defined BEFORE /:id/read to prevent route collision.

router.patch('/read-all', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    )

    return res.json({ updated: result.rowCount })
  } catch (err) {
    console.error('notifications read-all error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── PATCH /api/notifications/:id/read ───────────────────────────────────────

router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notifications SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.id]
    )

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Nie znaleziono powiadomienia' })
    }

    return res.json({ success: true })
  } catch (err) {
    console.error('notification read error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

module.exports = router
