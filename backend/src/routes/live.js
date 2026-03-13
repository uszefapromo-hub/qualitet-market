'use strict'

/**
 * Live Commerce – mounted at /api/live
 *
 *   GET   /api/live/streams                         – list streams
 *   POST  /api/live/streams                         – create stream
 *   GET   /api/live/streams/:id                     – get stream details
 *   PATCH /api/live/streams/:id/status              – update stream status
 *   POST  /api/live/streams/:id/messages            – post chat message
 *   GET   /api/live/streams/:id/messages            – get recent messages
 *   POST  /api/live/streams/:id/pin-product         – pin product to stream
 *   GET   /api/live/streams/:id/pinned-products     – list pinned products
 *   POST  /api/live/streams/:id/order               – record live-stream order
 */

const crypto  = require('crypto')
const express = require('express')
const { body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')

const db = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate } = require('../middleware/validate')

const router = express.Router()

// ─── GET /api/live/streams ────────────────────────────────────────────────────

router.get('/streams', async (req, res) => {
  const statusFilter = req.query.status || null
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10))
  const offset = Math.max(0,   parseInt(req.query.offset || '0',  10))

  try {
    const conditions = []
    const params = []

    if (statusFilter) {
      params.push(statusFilter)
      conditions.push(`ls.status = $${params.length}`)
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

    const [countResult, rowsResult] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM live_streams ls ${where}`, params),
      db.query(
        `SELECT ls.*, u.name AS seller_name
         FROM live_streams ls
         LEFT JOIN users u ON u.id = ls.seller_id
         ${where}
         ORDER BY ls.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
    ])

    return res.json({
      streams: rowsResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
    })
  } catch (err) {
    console.error('live list streams error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/live/streams ───────────────────────────────────────────────────

router.post(
  '/streams',
  authenticate,
  requireRole('seller', 'creator', 'owner', 'admin'),
  [
    body('title').notEmpty().isString().isLength({ max: 200 }),
    body('description').optional().isString().isLength({ max: 2000 }),
    body('store_id').optional().isUUID(),
    body('scheduled_at').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const { title, description, store_id, scheduled_at } = req.body
    const streamKey = 'LIVE-' + crypto.randomBytes(16).toString('hex').toUpperCase()
    const id = uuidv4()

    try {
      const result = await db.query(
        `INSERT INTO live_streams
           (id, seller_id, store_id, title, description, stream_key, scheduled_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, req.user.id, store_id || null, title, description || null, streamKey, scheduled_at || null]
      )

      return res.status(201).json({ stream: result.rows[0] })
    } catch (err) {
      console.error('live create stream error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /api/live/streams/:id ────────────────────────────────────────────────

router.get('/streams/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ls.*, u.name AS seller_name
       FROM live_streams ls
       LEFT JOIN users u ON u.id = ls.seller_id
       WHERE ls.id = $1`,
      [req.params.id]
    )

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Stream nie istnieje' })
    }

    return res.json({ stream: result.rows[0] })
  } catch (err) {
    console.error('live get stream error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── PATCH /api/live/streams/:id/status ──────────────────────────────────────

router.patch(
  '/streams/:id/status',
  authenticate,
  [
    body('status').isIn(['live', 'ended']),
  ],
  validate,
  async (req, res) => {
    const { status } = req.body

    try {
      const streamResult = await db.query(
        'SELECT id, seller_id FROM live_streams WHERE id = $1',
        [req.params.id]
      )
      const stream = streamResult.rows[0]
      if (!stream) return res.status(404).json({ error: 'Stream nie istnieje' })
      if (stream.seller_id !== req.user.id && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' })
      }

      let extraFields = ''
      if (status === 'live')  extraFields = ', started_at = NOW()'
      if (status === 'ended') extraFields = ', ended_at = NOW()'

      const result = await db.query(
        `UPDATE live_streams SET status = $1${extraFields} WHERE id = $2 RETURNING *`,
        [status, req.params.id]
      )

      return res.json({ stream: result.rows[0] })
    } catch (err) {
      console.error('live update status error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── POST /api/live/streams/:id/messages ─────────────────────────────────────

router.post(
  '/streams/:id/messages',
  authenticate,
  [
    body('message').notEmpty().isString().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { message } = req.body

    try {
      const streamCheck = await db.query(
        'SELECT id FROM live_streams WHERE id = $1',
        [req.params.id]
      )
      if (!streamCheck.rows[0]) {
        return res.status(404).json({ error: 'Stream nie istnieje' })
      }

      const id = uuidv4()
      const result = await db.query(
        `INSERT INTO live_messages (id, stream_id, user_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [id, req.params.id, req.user.id, message]
      )

      return res.status(201).json({ message: result.rows[0] })
    } catch (err) {
      console.error('live post message error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /api/live/streams/:id/messages ──────────────────────────────────────

router.get('/streams/:id/messages', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT lm.*, u.name AS author_name
       FROM live_messages lm
       LEFT JOIN users u ON u.id = lm.user_id
       WHERE lm.stream_id = $1
       ORDER BY lm.created_at DESC
       LIMIT 50`,
      [req.params.id]
    )

    return res.json({ messages: result.rows.reverse() })
  } catch (err) {
    console.error('live get messages error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/live/streams/:id/pin-product ───────────────────────────────────

router.post(
  '/streams/:id/pin-product',
  authenticate,
  [
    body('shop_product_id').notEmpty().isUUID(),
    body('discount_percent').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { shop_product_id, discount_percent } = req.body

    try {
      const streamResult = await db.query(
        'SELECT id, seller_id FROM live_streams WHERE id = $1',
        [req.params.id]
      )
      const stream = streamResult.rows[0]
      if (!stream) return res.status(404).json({ error: 'Stream nie istnieje' })
      if (stream.seller_id !== req.user.id && req.user.role !== 'owner' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Brak uprawnień' })
      }

      const id = uuidv4()
      const result = await db.query(
        `INSERT INTO live_pinned_products (id, stream_id, shop_product_id, discount_percent, pinned_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [id, req.params.id, shop_product_id, discount_percent || 0]
      )

      return res.status(201).json({ pinned: result.rows[0] })
    } catch (err) {
      console.error('live pin product error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /api/live/streams/:id/pinned-products ───────────────────────────────

router.get('/streams/:id/pinned-products', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT lpp.*, sp.name AS product_name, sp.price_gross
       FROM live_pinned_products lpp
       LEFT JOIN shop_products sp ON sp.id = lpp.shop_product_id
       WHERE lpp.stream_id = $1 AND lpp.is_active = TRUE
       ORDER BY lpp.pinned_at DESC`,
      [req.params.id]
    )

    return res.json({ products: result.rows })
  } catch (err) {
    console.error('live get pinned products error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/live/streams/:id/order ────────────────────────────────────────

router.post(
  '/streams/:id/order',
  authenticate,
  [
    body('shop_product_id').notEmpty().isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const streamCheck = await db.query(
        'SELECT id FROM live_streams WHERE id = $1',
        [req.params.id]
      )
      if (!streamCheck.rows[0]) {
        return res.status(404).json({ error: 'Stream nie istnieje' })
      }

      const id = uuidv4()
      await db.query(
        `INSERT INTO live_orders (id, stream_id, buyer_id, shop_product_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [id, req.params.id, req.user.id, req.body.shop_product_id]
      )

      return res.status(201).json({ success: true })
    } catch (err) {
      console.error('live order error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

module.exports = router
