'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_PLANS = ['trial', 'basic', 'pro', 'elite'];

/**
 * Plan configuration.
 *
 * product_limit / commission_rate are the DB column names used for persistence.
 * maxProducts / platformMarginPct are semantic aliases used in business logic.
 * durationDays is the default subscription period in days.
 */
const PLAN_CONFIG = {
  trial:  { product_limit: 10,   maxProducts: 10,   commission_rate: 0.15, platformMarginPct: 15, duration_days: 14, durationDays: 14 },
  basic:  { product_limit: 100,  maxProducts: 100,  commission_rate: 0.10, platformMarginPct: 10, durationDays: 30 },
  pro:    { product_limit: 500,  maxProducts: 500,  commission_rate: 0.07, platformMarginPct: 7,  durationDays: 30 },
  elite:  { product_limit: null, maxProducts: null, commission_rate: 0.05, platformMarginPct: 5,  durationDays: 30 },
};

// ─── List subscriptions (own shops) ───────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const isAdmin = ['owner', 'admin'].includes(req.user.role);
  try {
    const result = isAdmin
      ? await db.query(
          `SELECT s.*, st.name AS shop_name, st.slug AS shop_slug
           FROM subscriptions s
           LEFT JOIN stores st ON s.shop_id = st.id
           ORDER BY s.created_at DESC`
        )
      : await db.query(
          `SELECT s.*, st.name AS shop_name, st.slug AS shop_slug
           FROM subscriptions s
           JOIN stores st ON s.shop_id = st.id
           WHERE st.owner_id = $1
           ORDER BY s.created_at DESC`,
          [req.user.id]
        );
    return res.json(result.rows);
  } catch (err) {
    console.error('list subscriptions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get active subscription for current user's primary shop ──────────────────

router.get('/active', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, st.name AS shop_name
       FROM subscriptions s
       JOIN stores st ON s.shop_id = st.id
       WHERE st.owner_id = $1 AND s.status = 'active'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
       ORDER BY s.expires_at DESC LIMIT 1`,
      [req.user.id]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error('get active subscription error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create / upgrade subscription for a shop ─────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('shop_id').isUUID(),
    body('plan').isIn(VALID_PLANS),
    body('duration_days').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { shop_id, plan, duration_days } = req.body;
    const config = PLAN_CONFIG[plan];

    try {
      // Verify the shop belongs to this user (unless admin)
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [shop_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      // Deactivate existing active subscription for this shop
      await db.query(
        `UPDATE subscriptions SET status = 'superseded', updated_at = NOW()
         WHERE shop_id = $1 AND status = 'active'`,
        [shop_id]
      );

      const id = uuidv4();
      const startedAt = new Date();
      const days = duration_days || config.duration_days || null;
      const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

      const result = await db.query(
        `INSERT INTO subscriptions
           (id, shop_id, plan, status, product_limit, commission_rate, started_at, expires_at, created_at)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, NOW())
         RETURNING *`,
        [id, shop_id, plan, config.product_limit, config.commission_rate, startedAt, expiresAt]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create subscription error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Cancel subscription ───────────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const subResult = await db.query(
      `SELECT s.*, st.owner_id FROM subscriptions s
       JOIN stores st ON s.shop_id = st.id
       WHERE s.id = $1`,
      [req.params.id]
    );
    const sub = subResult.rows[0];
    if (!sub) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });

    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    if (!isAdmin && sub.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const result = await db.query(
      `UPDATE subscriptions SET status = 'cancelled', expires_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('cancel subscription error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Admin: update subscription ────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(['active', 'cancelled', 'expired']),
    body('plan').optional().isIn(VALID_PLANS),
    body('expires_at').optional().isISO8601(),
    body('commission_rate').optional().isFloat({ min: 0, max: 1 }),
    body('product_limit').optional({ nullable: true }).isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { status, plan, expires_at, commission_rate, product_limit } = req.body;

    let newProductLimit = product_limit !== undefined ? product_limit : null;
    let newCommissionRate = commission_rate !== undefined ? commission_rate : null;

    // Apply plan defaults when plan changes
    if (plan && !commission_rate) {
      newCommissionRate = PLAN_CONFIG[plan].commission_rate;
    }
    if (plan && product_limit === undefined) {
      newProductLimit = PLAN_CONFIG[plan].product_limit;
    }

    try {
      const result = await db.query(
        `UPDATE subscriptions SET
           status          = COALESCE($1, status),
           plan            = COALESCE($2, plan),
           expires_at      = COALESCE($3::timestamptz, expires_at),
           commission_rate = COALESCE($4, commission_rate),
           product_limit   = COALESCE($5, product_limit),
           updated_at      = NOW()
         WHERE id = $6
         RETURNING *`,
        [status || null, plan || null, expires_at || null, newCommissionRate, newProductLimit, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update subscription error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = { router, PLAN_CONFIG };

