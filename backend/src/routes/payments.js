'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_METHODS  = ['transfer', 'card', 'blik', 'p24'];
const VALID_STATUSES = ['pending', 'completed', 'failed', 'refunded'];

// ─── List payments ─────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const isAdmin = ['owner', 'admin'].includes(req.user.role);

  try {
    const countResult = isAdmin
      ? await db.query('SELECT COUNT(*) FROM payments')
      : await db.query('SELECT COUNT(*) FROM payments WHERE user_id = $1', [req.user.id]);

    const total = parseInt(countResult.rows[0].count, 10);

    const result = isAdmin
      ? await db.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
      : await db.query(
          'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [req.user.id, limit, offset]
        );

    return res.json({ total, page, limit, payments: result.rows });
  } catch (err) {
    console.error('list payments error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get single payment ────────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    const payment = result.rows[0];
    if (!payment) return res.status(404).json({ error: 'Płatność nie znaleziona' });

    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    if (!isAdmin && payment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    return res.json(payment);
  } catch (err) {
    console.error('get payment error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create payment record ─────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('order_id').isUUID(),
    body('amount').isFloat({ min: 0.01 }),
    body('method').isIn(VALID_METHODS),
    body('external_ref').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { order_id, amount, method, external_ref = null } = req.body;

    try {
      // Verify order exists and belongs to the requesting user (buyer or admin)
      const orderResult = await db.query('SELECT id, buyer_id, total FROM orders WHERE id = $1', [order_id]);
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && order.buyer_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO payments
           (id, order_id, user_id, amount, currency, method, status, external_ref, created_at)
         VALUES ($1, $2, $3, $4, 'PLN', $5, 'pending', $6, NOW())
         RETURNING *`,
        [id, order_id, req.user.id, amount, method, external_ref]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create payment error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update payment status (admin/owner only) ──────────────────────────────────

router.put(
  '/:id/status',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(VALID_STATUSES),
    body('external_ref').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { status, external_ref } = req.body;

    try {
      const paidAt = status === 'completed' ? new Date() : null;

      const result = await db.query(
        `UPDATE payments SET
           status       = $1,
           external_ref = COALESCE($2, external_ref),
           paid_at      = COALESCE($3, paid_at),
           updated_at   = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, external_ref || null, paidAt, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Płatność nie znaleziona' });

      // When payment completes, confirm the order
      if (status === 'completed') {
        await db.query(
          `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
          [result.rows[0].order_id]
        );
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update payment status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
