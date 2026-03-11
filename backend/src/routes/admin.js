'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All admin routes require authentication and admin/owner role
router.use(authenticate, requireRole('owner', 'admin'));

// ─── GET /api/admin/orders ────────────────────────────────────────────────────

router.get('/orders', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;
  const shopId = req.query.shop_id || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`o.status = $${idx++}`); params.push(status); }
    if (shopId) { conditions.push(`o.store_id = $${idx++}`); params.push(shopId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM orders o ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT
         o.*,
         s.name AS shop_name,
         s.slug AS shop_slug,
         u.email AS buyer_email,
         u.name  AS buyer_name
       FROM orders o
       JOIN stores s ON o.store_id = s.id
       JOIN users u ON o.buyer_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('admin list orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/orders/:id/status ───────────────────────────────────────

router.patch(
  '/orders/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [req.body.status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Zamówienie nie znalezione' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update order status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────

router.get('/audit-logs', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
  const offset = (page - 1) * limit;
  const entityType = req.query.entity_type || null;
  const actorId = req.query.actor_user_id || null;
  const action = req.query.action || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (entityType) { conditions.push(`al.entity_type = $${idx++}`); params.push(entityType); }
    if (actorId)    { conditions.push(`al.actor_user_id = $${idx++}`); params.push(actorId); }
    if (action)     { conditions.push(`al.action = $${idx++}`); params.push(action); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM audit_logs al ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT
         al.*,
         u.email AS actor_email,
         u.name  AS actor_name
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_user_id = u.id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, logs: result.rows });
  } catch (err) {
    console.error('admin audit logs error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const role = req.query.role || null;

  try {
    const conditions = role ? ['role = $1'] : [];
    const params = role ? [role] : [];

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const idxLimit = params.length + 1;

    const countResult = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, email, name, role, plan, trial_ends_at, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idxLimit} OFFSET $${idxLimit + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, users: result.rows });
  } catch (err) {
    console.error('admin list users error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
