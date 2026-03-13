'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../helpers/audit');
const wsManager = require('../services/websocket');

const router = express.Router();

// Roles allowed to start a live stream
const STREAMER_ROLES = ['seller', 'creator', 'admin', 'owner'];

/**
 * Helper: verify the requesting user owns the given stream.
 */
async function ownStream(streamId, userId, role) {
  const result = await db.query('SELECT * FROM live_streams WHERE id = $1', [streamId]);
  const stream = result.rows[0];
  if (!stream) return { stream: null, forbidden: false, notFound: true };
  const isAdmin = ['admin', 'owner'].includes(role);
  if (stream.streamer_id !== userId && !isAdmin) {
    return { stream, forbidden: true, notFound: false };
  }
  return { stream, forbidden: false, notFound: false };
}

// ─── List live streams ─────────────────────────────────────────────────────────
// Public endpoint; optional ?status=live|scheduled|ended&page=&limit=

router.get('/streams', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status || null;

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM live_streams
       WHERE ($1::text IS NULL OR status = $1)`,
      [statusFilter]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT ls.id, ls.title, ls.description, ls.status, ls.viewer_count,
              ls.thumbnail_url, ls.scheduled_at, ls.started_at, ls.ended_at,
              ls.created_at, ls.store_id,
              u.name AS streamer_name, u.role AS streamer_role
         FROM live_streams ls
         JOIN users u ON u.id = ls.streamer_id
        WHERE ($1::text IS NULL OR ls.status = $1)
        ORDER BY
          CASE ls.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
          ls.started_at DESC NULLS LAST, ls.created_at DESC
        LIMIT $2 OFFSET $3`,
      [statusFilter, limit, offset]
    );

    return res.json({ total, page, limit, streams: result.rows });
  } catch (err) {
    console.error('list live streams error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get single stream ─────────────────────────────────────────────────────────

router.get('/streams/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ls.*, u.name AS streamer_name, u.role AS streamer_role
         FROM live_streams ls
         JOIN users u ON u.id = ls.streamer_id
        WHERE ls.id = $1`,
      [req.params.id]
    );
    const stream = result.rows[0];
    if (!stream) return res.status(404).json({ error: 'Stream nie znaleziony' });
    return res.json({ stream });
  } catch (err) {
    console.error('get live stream error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create stream ─────────────────────────────────────────────────────────────

router.post(
  '/streams',
  authenticate,
  requireRole(...STREAMER_ROLES),
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('store_id').optional({ nullable: true }).isUUID(),
    body('thumbnail_url').optional({ nullable: true }).isURL(),
    body('scheduled_at').optional({ nullable: true }).isISO8601(),
  ],
  validate,
  async (req, res) => {
    const { title, description, store_id, thumbnail_url, scheduled_at } = req.body;
    const streamKey = uuidv4().replace(/-/g, '').slice(0, 32);

    try {
      if (store_id) {
        const storeCheck = await db.query('SELECT id FROM stores WHERE id = $1', [store_id]);
        if (!storeCheck.rows[0]) return res.status(400).json({ error: 'Sklep nie znaleziony' });
      }

      const result = await db.query(
        `INSERT INTO live_streams
           (title, description, streamer_id, store_id, stream_key, thumbnail_url, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, description || null, req.user.id, store_id || null, streamKey, thumbnail_url || null, scheduled_at || null]
      );
      const stream = result.rows[0];

      auditLog({ actorUserId: req.user.id, action: 'live_stream_created', resource: 'live_streams', resourceId: stream.id, ipAddress: req.ip });

      return res.status(201).json({ stream });
    } catch (err) {
      console.error('create live stream error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update stream status ──────────────────────────────────────────────────────
// Allowed transitions: scheduled→live, live→ended, *→cancelled

router.patch(
  '/streams/:id/status',
  authenticate,
  [
    param('id').isUUID(),
    body('status').isIn(['live', 'ended', 'cancelled']),
  ],
  validate,
  async (req, res) => {
    try {
      const { stream, forbidden, notFound } = await ownStream(req.params.id, req.user.id, req.user.role);
      if (notFound) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (forbidden) return res.status(403).json({ error: 'Brak uprawnień' });

      const { status } = req.body;
      const updates = { status };
      if (status === 'live') updates.started_at = new Date().toISOString();
      if (status === 'ended' || status === 'cancelled') updates.ended_at = new Date().toISOString();

      const result = await db.query(
        `UPDATE live_streams
            SET status = $1,
                started_at = COALESCE($2, started_at),
                ended_at   = COALESCE($3, ended_at)
          WHERE id = $4
          RETURNING *`,
        [status, updates.started_at || null, updates.ended_at || null, stream.id]
      );

      const updated = result.rows[0];

      // Broadcast status change to connected viewers
      wsManager.broadcast(stream.id, { type: 'stream_status', status, stream: updated });

      auditLog({ actorUserId: req.user.id, action: `live_stream_${status}`, resource: 'live_streams', resourceId: stream.id, ipAddress: req.ip });

      return res.json({ stream: updated });
    } catch (err) {
      console.error('update stream status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Get chat messages ─────────────────────────────────────────────────────────
// Polling endpoint: ?since=<ISO timestamp>&limit=50

router.get('/streams/:id/messages', async (req, res) => {
  const since = req.query.since || null;
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));

  try {
    const streamCheck = await db.query('SELECT id FROM live_streams WHERE id = $1', [req.params.id]);
    if (!streamCheck.rows[0]) return res.status(404).json({ error: 'Stream nie znaleziony' });

    const result = await db.query(
      `SELECT id, user_id, display_name, content, message_type, created_at
         FROM live_messages
        WHERE stream_id = $1
          AND ($2::timestamptz IS NULL OR created_at > $2)
        ORDER BY created_at ASC
        LIMIT $3`,
      [req.params.id, since, limit]
    );

    return res.json({ messages: result.rows });
  } catch (err) {
    console.error('get messages error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Post chat message ─────────────────────────────────────────────────────────

router.post(
  '/streams/:id/messages',
  authenticate,
  [
    param('id').isUUID(),
    body('content').trim().notEmpty().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    try {
      const streamCheck = await db.query(
        `SELECT id, status FROM live_streams WHERE id = $1`,
        [req.params.id]
      );
      const stream = streamCheck.rows[0];
      if (!stream) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (stream.status !== 'live') {
        return res.status(400).json({ error: 'Stream nie jest aktywny' });
      }

      const displayName = req.user.name || req.user.email || 'Użytkownik';
      const result = await db.query(
        `INSERT INTO live_messages (stream_id, user_id, display_name, content, message_type)
         VALUES ($1, $2, $3, $4, 'chat')
         RETURNING *`,
        [req.params.id, req.user.id, displayName, req.body.content]
      );
      const message = result.rows[0];

      // Real-time broadcast to WebSocket subscribers
      wsManager.broadcast(req.params.id, { type: 'message', message });

      return res.status(201).json({ message });
    } catch (err) {
      console.error('post message error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Get pinned products ───────────────────────────────────────────────────────

router.get('/streams/:id/products', async (req, res) => {
  try {
    const streamCheck = await db.query('SELECT id FROM live_streams WHERE id = $1', [req.params.id]);
    if (!streamCheck.rows[0]) return res.status(404).json({ error: 'Stream nie znaleziony' });

    const result = await db.query(
      `SELECT lpp.id, lpp.product_id, lpp.is_active, lpp.pinned_at,
              p.name, p.price, p.image_url, p.description
         FROM live_pinned_products lpp
         JOIN products p ON p.id = lpp.product_id
        WHERE lpp.stream_id = $1 AND lpp.is_active = TRUE
        ORDER BY lpp.pinned_at DESC`,
      [req.params.id]
    );

    return res.json({ products: result.rows });
  } catch (err) {
    console.error('get pinned products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Pin product ───────────────────────────────────────────────────────────────

router.post(
  '/streams/:id/products',
  authenticate,
  [
    param('id').isUUID(),
    body('product_id').isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { stream, forbidden, notFound } = await ownStream(req.params.id, req.user.id, req.user.role);
      if (notFound) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (forbidden) return res.status(403).json({ error: 'Brak uprawnień' });

      const productCheck = await db.query('SELECT id, name, price, image_url FROM products WHERE id = $1', [req.body.product_id]);
      if (!productCheck.rows[0]) return res.status(400).json({ error: 'Produkt nie znaleziony' });

      await db.query(
        `INSERT INTO live_pinned_products (stream_id, product_id)
         VALUES ($1, $2)
         ON CONFLICT (stream_id, product_id) DO UPDATE SET is_active = TRUE, pinned_at = NOW()`,
        [stream.id, req.body.product_id]
      );

      const product = productCheck.rows[0];
      wsManager.broadcast(stream.id, { type: 'product_pinned', product });

      return res.status(201).json({ product });
    } catch (err) {
      console.error('pin product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Unpin product ─────────────────────────────────────────────────────────────

router.delete(
  '/streams/:id/products/:productId',
  authenticate,
  [
    param('id').isUUID(),
    param('productId').isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { stream, forbidden, notFound } = await ownStream(req.params.id, req.user.id, req.user.role);
      if (notFound) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (forbidden) return res.status(403).json({ error: 'Brak uprawnień' });

      await db.query(
        'UPDATE live_pinned_products SET is_active = FALSE WHERE stream_id = $1 AND product_id = $2',
        [stream.id, req.params.productId]
      );

      wsManager.broadcast(stream.id, { type: 'product_unpinned', product_id: req.params.productId });

      return res.json({ success: true });
    } catch (err) {
      console.error('unpin product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Get live promotions ───────────────────────────────────────────────────────

router.get('/streams/:id/promotions', async (req, res) => {
  try {
    const streamCheck = await db.query('SELECT id FROM live_streams WHERE id = $1', [req.params.id]);
    if (!streamCheck.rows[0]) return res.status(404).json({ error: 'Stream nie znaleziony' });

    const result = await db.query(
      `SELECT lp.id, lp.title, lp.promo_price, lp.original_price,
              lp.discount_percent, lp.ends_at, lp.max_quantity,
              lp.used_quantity, lp.is_active,
              p.name AS product_name, p.image_url AS product_image
         FROM live_promotions lp
         LEFT JOIN products p ON p.id = lp.product_id
        WHERE lp.stream_id = $1 AND lp.is_active = TRUE AND lp.ends_at > NOW()
        ORDER BY lp.created_at DESC`,
      [req.params.id]
    );

    return res.json({ promotions: result.rows });
  } catch (err) {
    console.error('get promotions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create live promotion ─────────────────────────────────────────────────────

router.post(
  '/streams/:id/promotions',
  authenticate,
  [
    param('id').isUUID(),
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('promo_price').isFloat({ min: 0 }),
    body('original_price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('discount_percent').optional({ nullable: true }).isInt({ min: 0, max: 100 }),
    body('ends_at').isISO8601(),
    body('max_quantity').optional({ nullable: true }).isInt({ min: 1 }),
    body('product_id').optional({ nullable: true }).isUUID(),
  ],
  validate,
  async (req, res) => {
    try {
      const { stream, forbidden, notFound } = await ownStream(req.params.id, req.user.id, req.user.role);
      if (notFound) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (forbidden) return res.status(403).json({ error: 'Brak uprawnień' });

      const { title, promo_price, original_price, discount_percent, ends_at, max_quantity, product_id } = req.body;

      const result = await db.query(
        `INSERT INTO live_promotions
           (stream_id, product_id, title, promo_price, original_price, discount_percent, ends_at, max_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [stream.id, product_id || null, title, promo_price, original_price || null, discount_percent || null, ends_at, max_quantity || null]
      );
      const promotion = result.rows[0];

      wsManager.broadcast(stream.id, { type: 'promotion', promotion });

      return res.status(201).json({ promotion });
    } catch (err) {
      console.error('create promotion error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Buy from live stream ──────────────────────────────────────────────────────
// Creates an order directly from a live stream (quick checkout).

router.post(
  '/streams/:id/orders',
  authenticate,
  [
    param('id').isUUID(),
    body('product_id').isUUID(),
    body('quantity').isInt({ min: 1 }),
    body('promotion_id').optional({ nullable: true }).isUUID(),
    body('shipping_address').trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { product_id, quantity, promotion_id, shipping_address } = req.body;

    try {
      const streamResult = await db.query('SELECT * FROM live_streams WHERE id = $1', [req.params.id]);
      const stream = streamResult.rows[0];
      if (!stream) return res.status(404).json({ error: 'Stream nie znaleziony' });
      if (stream.status !== 'live') return res.status(400).json({ error: 'Stream nie jest aktywny' });

      const productResult = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
      const product = productResult.rows[0];
      if (!product) return res.status(400).json({ error: 'Produkt nie znaleziony' });

      // Determine price: use promotion price if valid, otherwise product price
      let unitPrice = parseFloat(product.price);
      if (promotion_id) {
        const promoResult = await db.query(
          `SELECT * FROM live_promotions
            WHERE id = $1 AND stream_id = $2 AND is_active = TRUE AND ends_at > NOW()`,
          [promotion_id, stream.id]
        );
        const promo = promoResult.rows[0];
        if (promo) {
          if (promo.max_quantity && promo.used_quantity >= promo.max_quantity) {
            return res.status(400).json({ error: 'Limit promocji wyczerpany' });
          }
          unitPrice = parseFloat(promo.promo_price);
          // Increment used_quantity
          await db.query(
            'UPDATE live_promotions SET used_quantity = used_quantity + 1 WHERE id = $1',
            [promotion_id]
          );
        }
      }

      const totalAmount = (unitPrice * quantity).toFixed(2);

      // Create order
      const orderId = uuidv4();
      await db.query(
        `INSERT INTO orders
           (id, buyer_id, store_owner_id, total_amount, status, shipping_address, source)
         VALUES ($1, $2, $3, $4, 'created', $5, 'live')`,
        [orderId, req.user.id, stream.streamer_id, totalAmount, shipping_address]
      );

      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, product_id, quantity, unitPrice]
      );

      // Broadcast purchase event to stream viewers
      const displayName = req.user.name || req.user.email || 'Użytkownik';
      wsManager.broadcast(stream.id, {
        type: 'purchase',
        message: {
          stream_id: stream.id,
          user_id: req.user.id,
          display_name: displayName,
          content: `${displayName} kupił(a) ${product.name}!`,
          message_type: 'purchase',
          created_at: new Date().toISOString(),
        },
      });

      // Post system message to chat
      await db.query(
        `INSERT INTO live_messages (stream_id, user_id, display_name, content, message_type)
         VALUES ($1, $2, $3, $4, 'purchase')`,
        [stream.id, req.user.id, displayName, `${displayName} kupił(a) ${product.name}!`]
      );

      auditLog({ actorUserId: req.user.id, action: 'live_order_created', resource: 'orders', resourceId: orderId, ipAddress: req.ip });

      return res.status(201).json({ order_id: orderId, total_amount: totalAmount });
    } catch (err) {
      console.error('live order error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
