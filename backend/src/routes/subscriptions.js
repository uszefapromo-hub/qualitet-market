'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

/**
 * Platform subscription plan configuration.
 * Imported by admin.js and orders.js for plan-limit enforcement.
 *
 * @property {number|null} maxProducts        – max shop_products per store (null = unlimited)
 * @property {number}      platformMarginPct  – platform's take (%) on each sale
 * @property {number}      durationDays       – default subscription period in days
 */
const PLAN_CONFIG = {
  trial:  { maxProducts: 10,   platformMarginPct: 15, durationDays: 14 },
  basic:  { maxProducts: 100,  platformMarginPct: 10, durationDays: 30 },
  pro:    { maxProducts: 500,  platformMarginPct: 7,  durationDays: 30 },
  elite:  { maxProducts: null, platformMarginPct: 5,  durationDays: 30 },
};

const VALID_PLANS = Object.keys(PLAN_CONFIG);

// ─── List subscriptions ────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const isAdmin = ['owner', 'admin'].includes(req.user.role);
  try {
    const result = isAdmin
      ? await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC')
      : await db.query('SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    return res.json(result.rows);
  } catch (err) {
    console.error('list subscriptions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get active subscription for current user ──────────────────────────────────

router.get('/active', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND ends_at > NOW()
       ORDER BY ends_at DESC LIMIT 1`,
      [req.user.id]
    );
    return res.json(result.rows[0] || null);
  } catch (err) {
    console.error('get active subscription error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create / upgrade subscription ────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('plan').isIn(VALID_PLANS),
    body('payment_reference').optional().trim(),
    body('duration_days').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { plan, payment_reference = null, duration_days = 30 } = req.body;

    const PLAN_PRICES = { trial: 0, basic: 49, pro: 149, elite: 399 };

    try {
      // Deactivate any previous active subscription
      await db.query(
        `UPDATE subscriptions SET status = 'superseded' WHERE user_id = $1 AND status = 'active'`,
        [req.user.id]
      );

      const id = uuidv4();
      const startsAt = new Date();
      const endsAt = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000);

      const result = await db.query(
        `INSERT INTO subscriptions
           (id, user_id, plan, price, payment_reference, status, starts_at, ends_at, created_at)
         VALUES ($1,$2,$3,$4,$5,'active',$6,$7,NOW())
         RETURNING *`,
        [id, req.user.id, plan, PLAN_PRICES[plan], payment_reference, startsAt, endsAt]
      );

      // Update user plan
      await db.query('UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2', [plan, req.user.id]);

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
    const subResult = await db.query('SELECT user_id FROM subscriptions WHERE id = $1', [req.params.id]);
    const sub = subResult.rows[0];
    if (!sub) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });

    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    if (!isAdmin && sub.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const result = await db.query(
      `UPDATE subscriptions SET status = 'cancelled', ends_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    // Downgrade user plan to basic
    await db.query('UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2', ['basic', sub.user_id]);

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('cancel subscription error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Admin: update subscription (e.g. after payment confirmation) ──────────────

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(['active', 'cancelled', 'expired']),
    body('plan').optional().isIn(VALID_PLANS),
    body('ends_at').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const { status, plan, ends_at } = req.body;
    try {
      const result = await db.query(
        `UPDATE subscriptions SET
           status    = COALESCE($1, status),
           plan      = COALESCE($2, plan),
           ends_at   = COALESCE($3::timestamptz, ends_at),
           updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status || null, plan || null, ends_at || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });

      // Sync user plan if plan changed
      if (plan) {
        await db.query('UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2', [plan, result.rows[0].user_id]);
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update subscription error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
module.exports.PLAN_CONFIG = PLAN_CONFIG;
