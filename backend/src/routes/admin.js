'use strict';

const express = require('express');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

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
