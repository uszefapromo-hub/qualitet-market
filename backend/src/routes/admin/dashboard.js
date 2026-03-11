'use strict';

const express = require('express');

const db = require('../../config/database');

const router = express.Router();

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
// Returns platform-wide statistics for the superadmin dashboard.

router.get('/', async (_req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      usersResult,
      storesResult,
      productsResult,
      ordersResult,
      dailySalesResult,
      monthlySalesResult,
      newShopsResult,
      newUsersResult,
      recentOrdersResult,
      recentShopsResult,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM stores'),
      db.query('SELECT COUNT(*) FROM products'),
      db.query('SELECT COUNT(*) FROM orders'),
      db.query(
        `SELECT COALESCE(SUM(total), 0) AS sales FROM orders
         WHERE status != 'cancelled' AND created_at >= $1`,
        [startOfDay]
      ),
      db.query(
        `SELECT COALESCE(SUM(total), 0) AS sales FROM orders
         WHERE status != 'cancelled' AND created_at >= $1`,
        [startOfMonth]
      ),
      db.query('SELECT COUNT(*) FROM stores WHERE created_at >= $1', [startOfMonth]),
      db.query('SELECT COUNT(*) FROM users WHERE created_at >= $1', [startOfMonth]),
      db.query(
        `SELECT o.id, o.status, o.total, o.created_at, s.name AS store_name
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         ORDER BY o.created_at DESC LIMIT 10`
      ),
      db.query(
        `SELECT id, name, slug, status, plan, created_at
         FROM stores ORDER BY created_at DESC LIMIT 10`
      ),
    ]);

    return res.json({
      stats: {
        users:          parseInt(usersResult.rows[0].count, 10),
        stores:         parseInt(storesResult.rows[0].count, 10),
        products:       parseInt(productsResult.rows[0].count, 10),
        orders:         parseInt(ordersResult.rows[0].count, 10),
        daily_sales:    parseFloat(dailySalesResult.rows[0].sales),
        monthly_sales:  parseFloat(monthlySalesResult.rows[0].sales),
        new_shops:      parseInt(newShopsResult.rows[0].count, 10),
        new_users:      parseInt(newUsersResult.rows[0].count, 10),
      },
      recent_orders: recentOrdersResult.rows,
      recent_shops:  recentShopsResult.rows,
    });
  } catch (err) {
    console.error('admin dashboard error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
