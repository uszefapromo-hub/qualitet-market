'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

const VALID_STATUSES = ['created', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

// ─── GET /api/admin/orders ────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;
  const storeId = req.query.store_id || null;

  try {
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (storeId) {
      params.push(storeId);
      conditions.push(`o.store_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM orders o ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT o.*, s.name AS store_name
       FROM orders o
       JOIN stores s ON s.id = o.store_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('admin list orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/orders/:id ────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const orderResult = await db.query(
        `SELECT o.*, s.name AS store_name, s.slug AS store_slug
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         WHERE o.id = $1`,
        [req.params.id]
      );
      if (!orderResult.rows[0]) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

      const itemsResult = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [req.params.id]
      );

      return res.json({ order: orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
      console.error('admin get order error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/orders/:id ─────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(VALID_STATUSES),
    body('notes').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { status, notes } = req.body;
    try {
      const result = await db.query(
        `UPDATE orders SET
           status     = COALESCE($1, status),
           notes      = COALESCE($2, notes),
           updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status || null, notes !== undefined ? notes : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Zamówienie nie znalezione' });
      await logAudit(req.user.id, 'order.update', 'order', req.params.id, { status }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update order error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
