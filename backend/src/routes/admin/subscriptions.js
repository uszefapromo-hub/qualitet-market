'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

const VALID_PLANS = ['trial', 'basic', 'pro', 'elite'];

// ─── GET /api/admin/subscriptions ────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM subscriptions');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT sub.*, u.email, u.name
       FROM subscriptions sub
       JOIN users u ON u.id = sub.user_id
       ORDER BY sub.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, subscriptions: result.rows });
  } catch (err) {
    console.error('admin list subscriptions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/subscriptions/:id ──────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('plan').optional().isIn(VALID_PLANS),
    body('status').optional().isIn(['active', 'cancelled', 'expired', 'superseded']),
  ],
  validate,
  async (req, res) => {
    const { plan, status } = req.body;
    try {
      const result = await db.query(
        `UPDATE subscriptions SET
           plan       = COALESCE($1, plan),
           status     = COALESCE($2, status),
           updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [plan || null, status || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });

      // Also sync the user's plan field when plan changes
      if (plan) {
        await db.query(
          'UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2',
          [plan, result.rows[0].user_id]
        );
      }

      await logAudit(req.user.id, 'subscription.update', 'subscription', req.params.id, { plan, status }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update subscription error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
