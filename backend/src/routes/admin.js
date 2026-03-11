'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── GET /api/admin/stats – platform dashboard statistics ─────────────────────

router.get('/stats', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const [
      usersResult,
      storesResult,
      productsResult,
      catalogueResult,
      ordersResult,
      revenueResult,
      pendingOrdersResult,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM stores WHERE status = $1', ['active']),
      db.query('SELECT COUNT(*) FROM products'),
      db.query('SELECT COUNT(*) FROM products WHERE is_central = true'),
      db.query('SELECT COUNT(*) FROM orders'),
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != $1`, ['cancelled']),
      db.query(`SELECT COUNT(*) FROM orders WHERE status = $1`, ['pending']),
    ]);

    return res.json({
      users:               parseInt(usersResult.rows[0].count, 10),
      active_stores:       parseInt(storesResult.rows[0].count, 10),
      products:            parseInt(productsResult.rows[0].count, 10),
      central_catalogue:   parseInt(catalogueResult.rows[0].count, 10),
      orders:              parseInt(ordersResult.rows[0].count, 10),
      revenue:             parseFloat(revenueResult.rows[0].revenue),
      pending_orders:      parseInt(pendingOrdersResult.rows[0].count, 10),
    });
  } catch (err) {
    console.error('admin stats error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/users – all users (paginated) ─────────────────────────────

router.get('/users', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, email, name, role, plan, trial_ends_at, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, users: result.rows });
  } catch (err) {
    console.error('admin list users error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/users/:id – update user role / plan ────────────────────

router.patch(
  '/users/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('role').optional().isIn(['buyer', 'seller', 'admin', 'owner']),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
  ],
  validate,
  async (req, res) => {
    const { role, plan } = req.body;

    try {
      const result = await db.query(
        `UPDATE users SET
           role       = COALESCE($1, role),
           plan       = COALESCE($2, plan),
           updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, name, role, plan, updated_at`,
        [role || null, plan || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/orders – all orders (paginated, filterable by status) ─────

router.get('/orders', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM orders ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('admin list orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/stores – all stores (paginated) ───────────────────────────

router.get('/stores', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM stores');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      'SELECT * FROM stores ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json({ total, page, limit, stores: result.rows });
  } catch (err) {
    console.error('admin list stores error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/stores/:id – update store status / plan ────────────────

router.patch(
  '/stores/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
    body('plan').optional().isIn(['basic', 'pro', 'elite']),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { status, plan, margin } = req.body;

    try {
      const result = await db.query(
        `UPDATE stores SET
           status     = COALESCE($1, status),
           plan       = COALESCE($2, plan),
           margin     = COALESCE($3, margin),
           updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, slug, status, plan, margin, owner_id, updated_at`,
        [status || null, plan || null, margin !== undefined ? margin : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/subscriptions – all subscriptions (paginated) ─────────────

router.get('/subscriptions', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE s.status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM subscriptions s ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS user_email, u.name AS user_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, subscriptions: result.rows });
  } catch (err) {
    console.error('admin list subscriptions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/catalogue – central catalogue products (paginated) ─────────

router.get('/catalogue', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit    = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset   = (page - 1) * limit;
  const category = req.query.category || null;
  const search   = req.query.search   || null;

  try {
    const conditions = ['is_central = true'];
    const params = [];
    let idx = 1;

    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) FROM products ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin catalogue error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/audit-logs – audit log (paginated) ────────────────────────

router.get('/audit-logs', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM audit_logs');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json({ total, page, limit, logs: result.rows });
  } catch (err) {
    console.error('admin audit logs error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
