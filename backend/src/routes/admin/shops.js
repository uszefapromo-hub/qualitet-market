'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

const VALID_STATUSES = ['pending', 'active', 'suspended', 'banned'];

// ─── GET /api/admin/shops ─────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where  = status ? `WHERE s.status = $1` : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM stores s ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS owner_email, u.name AS owner_name
       FROM stores s
       JOIN users u ON u.id = s.owner_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, shops: result.rows });
  } catch (err) {
    console.error('admin list shops error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/shops/:id ─────────────────────────────────────────────────

router.get(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const shopResult = await db.query(
        `SELECT s.*, u.email AS owner_email, u.name AS owner_name
         FROM stores s
         JOIN users u ON u.id = s.owner_id
         WHERE s.id = $1`,
        [req.params.id]
      );
      if (!shopResult.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const [productsResult, ordersResult] = await Promise.all([
        db.query('SELECT COUNT(*) FROM products WHERE store_id = $1', [req.params.id]),
        db.query('SELECT COUNT(*) FROM orders WHERE store_id = $1', [req.params.id]),
      ]);

      return res.json({
        shop: shopResult.rows[0],
        products_count: parseInt(productsResult.rows[0].count, 10),
        orders_count:   parseInt(ordersResult.rows[0].count, 10),
      });
    } catch (err) {
      console.error('admin get shop error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/shops/:id ───────────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('status').optional().isIn(VALID_STATUSES),
    body('name').optional().trim().notEmpty(),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { status, name, plan, margin, description } = req.body;
    try {
      const result = await db.query(
        `UPDATE stores SET
           status      = COALESCE($1, status),
           name        = COALESCE($2, name),
           plan        = COALESCE($3, plan),
           margin      = COALESCE($4, margin),
           description = COALESCE($5, description),
           updated_at  = NOW()
         WHERE id = $6
         RETURNING *`,
        [status || null, name || null, plan || null,
         margin !== undefined ? margin : null,
         description !== undefined ? description : null,
         req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      await logAudit(req.user.id, 'shop.update', 'store', req.params.id, { changes: req.body }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update shop error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/shops/:id ─────────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM stores WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      await logAudit(req.user.id, 'shop.delete', 'store', req.params.id, {}, req);
      return res.json({ message: 'Sklep usunięty' });
    } catch (err) {
      console.error('admin delete shop error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
