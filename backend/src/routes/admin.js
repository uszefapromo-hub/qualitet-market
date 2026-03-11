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
      ordersResult,
      revenueResult,
      pendingOrdersResult,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM stores WHERE status = $1', ['active']),
      db.query('SELECT COUNT(*) FROM products'),
      db.query('SELECT COUNT(*) FROM orders'),
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != $1`, ['cancelled']),
      db.query(`SELECT COUNT(*) FROM orders WHERE status = $1`, ['pending']),
    ]);

    return res.json({
      users:          parseInt(usersResult.rows[0].count, 10),
      active_stores:  parseInt(storesResult.rows[0].count, 10),
      products:       parseInt(productsResult.rows[0].count, 10),
      orders:         parseInt(ordersResult.rows[0].count, 10),
      revenue:        parseFloat(revenueResult.rows[0].revenue),
      pending_orders: parseInt(pendingOrdersResult.rows[0].count, 10),
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
  const role   = req.query.role   || null;
  const search = req.query.search || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (role)   { conditions.push(`role = $${idx++}`);                                  params.push(role); }
    if (search) { conditions.push(`(email ILIKE $${idx} OR name ILIKE $${idx})`);       params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, email, name, role, plan, trial_ends_at, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, users: result.rows });
  } catch (err) {
    console.error('admin list users error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/users/:id – update user (role / plan) ───────────────────

router.patch(
  '/users/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('role').optional().isIn(['buyer', 'seller', 'admin', 'owner']),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
    body('name').optional().trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { role, plan, name } = req.body;
    try {
      const result = await db.query(
        `UPDATE users SET
           role       = COALESCE($1, role),
           plan       = COALESCE($2, plan),
           name       = COALESCE($3, name),
           updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, name, role, plan, trial_ends_at, created_at`,
        [role || null, plan || null, name || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/users/:id – delete user ────────────────────────────────

router.delete('/users/:id', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    return res.json({ message: 'Użytkownik usunięty' });
  } catch (err) {
    console.error('admin delete user error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

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
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM stores ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS owner_email, u.name AS owner_name
       FROM stores s
       LEFT JOIN users u ON s.owner_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, stores: result.rows });
  } catch (err) {
    console.error('admin list stores error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/stores/:id/status – change store status ─────────────────

router.patch(
  '/stores/:id/status',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['active', 'inactive', 'suspended', 'pending']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE stores SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/products – all products (paginated) ───────────────────────

router.get('/products', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page      = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit     = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset    = (page - 1) * limit;
  const status    = req.query.status    || null;
  const isCentral = req.query.is_central != null ? req.query.is_central === 'true' : null;
  const search    = req.query.search    || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status)            { conditions.push(`p.status = $${idx++}`);                                   params.push(status); }
    if (isCentral !== null){ conditions.push(`p.is_central = $${idx++}`);                               params.push(isCentral); }
    if (search)            { conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);          params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS store_name
       FROM products p
       LEFT JOIN stores s ON p.store_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin list products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/products/:id/status – set product status ────────────────

router.patch(
  '/products/:id/status',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['draft', 'pending', 'active', 'archived']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update product status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

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
