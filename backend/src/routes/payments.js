'use strict';

const crypto = require('crypto');
const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_METHODS    = ['transfer', 'card', 'blik', 'p24', 'stripe'];
const VALID_PROVIDERS  = ['p24', 'stripe'];         // external payment providers
const VALID_STATUSES   = ['pending', 'paid', 'failed', 'refunded'];
// 'completed' kept as alias for backward compatibility with existing integrations
const ALL_VALID_STATUSES = [...VALID_STATUSES, 'completed'];

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
      const provider = VALID_PROVIDERS.includes(method) ? method : null;
      const result = await db.query(
        `INSERT INTO payments
           (id, order_id, user_id, amount, currency, method, payment_provider, status, external_ref, created_at)
         VALUES ($1, $2, $3, $4, 'PLN', $5, $6, 'pending', $7, NOW())
         RETURNING *`,
        [id, order_id, req.user.id, amount, method, provider, external_ref]
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
    body('status').isIn(ALL_VALID_STATUSES),
    body('external_ref').optional().trim(),
  ],
  validate,
  async (req, res) => {
    const { status, external_ref } = req.body;

    try {
      const isPaid = status === 'paid' || status === 'completed';
      const paidAt = isPaid ? new Date() : null;

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

      // When payment is paid/completed, mark the order as paid
      if (isPaid) {
        await db.query(
          `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status IN ('pending','created')`,
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

// ─── POST /api/payments/webhook – provider callback (P24, Stripe, BLIK, etc.) ─

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';
const WEBHOOK_VALID_STATUSES = ['paid', 'failed', 'refunded', 'completed'];

function verifyWebhookSignature(paymentId, status, signature) {
  // If no secret is configured, reject all webhook requests to prevent unauthorized access.
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${paymentId}:${status}`)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch (err) {
    // Malformed hex string or other comparison error
    if (process.env.NODE_ENV !== 'production') {
      console.debug('webhook signature comparison error:', err.message);
    }
    return false;
  }
}

router.post(
  '/webhook',
  [
    body('payment_id').isUUID(),
    body('status').isIn(WEBHOOK_VALID_STATUSES),
    body('external_ref').optional().trim(),
    body('signature').isString().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { payment_id, status, external_ref = null, signature = '' } = req.body;

    if (!verifyWebhookSignature(payment_id, status, signature)) {
      return res.status(401).json({ error: 'Nieprawidłowa sygnatura webhooka' });
    }

    try {
      const paymentResult = await db.query(
        'SELECT id, order_id, status FROM payments WHERE id = $1',
        [payment_id]
      );
      const payment = paymentResult.rows[0];
      if (!payment) return res.status(404).json({ error: 'Płatność nie znaleziona' });

      // Idempotency: ignore if already in the target status
      if (payment.status === status) {
        return res.json({ ok: true, idempotent: true });
      }

      const isPaid = status === 'paid' || status === 'completed';
      const paidAt = isPaid ? new Date() : null;

      const updated = await db.query(
        `UPDATE payments SET
           status       = $1,
           external_ref = COALESCE($2, external_ref),
           paid_at      = COALESCE($3, paid_at),
           updated_at   = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, external_ref, paidAt, payment_id]
      );

      // Propagate status change to the linked order
      if (isPaid) {
        await db.query(
          `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status IN ('pending','created')`,
          [payment.order_id]
        );
      } else if (status === 'failed') {
        await db.query(
          `UPDATE orders SET status = 'payment_failed', updated_at = NOW() WHERE id = $1 AND status IN ('pending','created')`,
          [payment.order_id]
        );
      } else if (status === 'refunded') {
        await db.query(
          `UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
          [payment.order_id]
        );
      }

      return res.json({ ok: true, payment: updated.rows[0] });
    } catch (err) {
      console.error('payment webhook error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/payments/:orderId/initiate – initiate payment for an order ─────

router.post(
  '/:orderId/initiate',
  authenticate,
  [
    param('orderId').isUUID(),
    body('method').isIn(VALID_METHODS),
    body('return_url').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    const { method, return_url = '' } = req.body;
    const { orderId } = req.params;

    try {
      const orderResult = await db.query(
        'SELECT id, buyer_id, total, status FROM orders WHERE id = $1',
        [orderId]
      );
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && order.buyer_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }
      if (!['pending', 'created'].includes(order.status)) {
        return res.status(422).json({ error: 'Zamówienie nie może zostać opłacone w obecnym statusie' });
      }

      const paymentId = uuidv4();
      const provider = VALID_PROVIDERS.includes(method) ? method : null;
      const result = await db.query(
        `INSERT INTO payments
           (id, order_id, user_id, amount, currency, method, payment_provider, status, created_at)
         VALUES ($1, $2, $3, $4, 'PLN', $5, $6, 'pending', NOW())
         RETURNING *`,
        [paymentId, orderId, req.user.id, order.total, method, provider]
      );

      const providerData = buildProviderPayload(method, result.rows[0], return_url);

      return res.status(201).json({
        payment: result.rows[0],
        ...providerData,
      });
    } catch (err) {
      console.error('initiate payment error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

/**
 * Build the minimal provider payload for redirecting the user to the payment page.
 *
 * Supported providers:
 *   - stripe: create a CheckoutSession via stripe.checkout.sessions.create()
 *   - p24 (Przelewy24): use the official Przelewy24 Node.js SDK
 *   - blik: create a BLIK code challenge via the bank/acquirer API
 *   - transfer: manual bank transfer
 *   - card: generic card payment
 */
function buildProviderPayload(method, payment, returnUrl) {
  const base = process.env.APP_URL || 'https://uszefaqualitet.pl';
  const successUrl = returnUrl || `${base}/koszyk.html?payment=success&payment_id=${payment.id}`;
  const cancelUrl  = `${base}/koszyk.html?payment=cancel`;

  if (method === 'stripe') {
    const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
    return {
      provider: 'stripe',
      payment_id: payment.id,
      sandbox_mode: !hasStripe,
      redirect_url: successUrl,
      cancel_url: cancelUrl,
      ...(hasStripe
        ? {}
        : { warning: 'Bramka Stripe nie jest skonfigurowana. Ustaw STRIPE_SECRET_KEY w .env.' }),
    };
  }

  if (method === 'p24') {
    const hasP24 = Boolean(process.env.P24_MERCHANT_ID);
    return {
      provider: 'p24',
      payment_id: payment.id,
      sandbox_mode: !hasP24,
      redirect_url: successUrl,
      cancel_url: cancelUrl,
      ...(hasP24
        ? {}
        : { warning: 'Bramka Przelewy24 nie jest skonfigurowana. Ustaw P24_MERCHANT_ID w .env.' }),
    };
  }

  if (method === 'card') {
    const hasPaymentProvider = Boolean(process.env.STRIPE_SECRET_KEY || process.env.P24_MERCHANT_ID);
    return {
      provider: 'card',
      payment_id: payment.id,
      sandbox_mode: !hasPaymentProvider,
      redirect_url: successUrl,
      ...(hasPaymentProvider
        ? {}
        : { warning: 'Bramka płatności kartą nie jest skonfigurowana. Ustaw STRIPE_SECRET_KEY lub P24_MERCHANT_ID w .env.' }),
    };
  }

  if (method === 'blik') {
    return {
      provider: 'blik',
      payment_id: payment.id,
      instructions: 'Wygeneruj kod BLIK w aplikacji bankowej i podaj go w polu poniżej.',
      confirm_url: `${base}/api/payments/webhook`,
    };
  }

  // transfer – manual
  return {
    provider: 'transfer',
    payment_id: payment.id,
    bank_account: process.env.BANK_ACCOUNT_NUMBER || 'PL00 0000 0000 0000 0000 0000 0000',
    amount: payment.amount,
    reference: payment.id,
    instructions: `Przelej ${payment.amount} PLN z tytułem: ${payment.id}`,
    success_url: successUrl,
    cancel_url: cancelUrl,
  };
}

module.exports = router;
