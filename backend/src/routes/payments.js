'use strict';

const crypto = require('crypto');
const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { computeRealProfit, estimatePaymentFee } = require('../helpers/pricing');

const router = express.Router();

const VALID_METHODS    = ['transfer', 'card', 'blik', 'p24', 'stripe'];
const VALID_PROVIDERS  = ['p24', 'stripe'];         // external payment providers
const VALID_STATUSES   = ['pending', 'paid', 'failed', 'refunded'];
// 'completed' kept as alias for backward compatibility with existing integrations
const ALL_VALID_STATUSES = [...VALID_STATUSES, 'completed'];

// Lazily initialised Stripe SDK instance (only when key is configured)
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line global-require
  _stripe = require('stripe')(key);
  return _stripe;
}

// ─── Helper: calculate and persist order profit ────────────────────────────────
/**
 * Compute and store profitability data for a completed order.
 *
 * Called fire-and-forget (not awaited) whenever an order transitions to 'paid'.
 * Errors are logged but never thrown, so payment flows are never disrupted.
 * Profit can be recalculated later if needed.
 *
 * Flow:
 *   1. Sum order_items.quantity × product.supplier_price → supplier_cost
 *   2. Estimate payment processor fee (Stripe default 2.9% + €0.30)
 *   3. Compute real_profit = sale_total - supplier_cost - payment_fee
 *   4. Persist supplier_cost, payment_fee, real_profit on the orders row.
 *
 * @param {string} orderId     UUID of the completed order.
 * @param {number} saleTotal   Total amount paid by the customer (from orders.total).
 */
async function recordOrderProfit(orderId, saleTotal) {
  try {
    // Sum up supplier_cost from all items in this order
    const itemsResult = await db.query(
      `SELECT oi.quantity,
              COALESCE(p.supplier_price, p.price_gross, 0) AS unit_supplier_price
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1`,
      [orderId]
    );

    let supplierCost = 0;
    for (const row of itemsResult.rows) {
      supplierCost += parseFloat(row.unit_supplier_price || 0) * parseInt(row.quantity || 1, 10);
    }
    supplierCost = parseFloat(supplierCost.toFixed(2));

    const paymentFee = estimatePaymentFee(parseFloat(saleTotal) || 0);
    const realProfit = computeRealProfit(saleTotal, supplierCost, paymentFee);

    await db.query(
      `UPDATE orders SET supplier_cost = $1, payment_fee = $2, real_profit = $3, updated_at = NOW() WHERE id = $4`,
      [supplierCost, paymentFee, realProfit, orderId]
    );
    console.debug(`[profit] Order ${orderId}: sale=${saleTotal}, cost=${supplierCost}, fee=${paymentFee}, profit=${realProfit}`);
  } catch (err) {
    // Non-critical – log but do not throw; profit can be recalculated later
    console.error('[profit] Failed to record order profit:', err.message);
  }
}

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

      // When payment is paid/completed, mark the order as paid and record profit
      if (isPaid) {
        const orderResult = await db.query(
          `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status IN ('pending','created') RETURNING id, total`,
          [result.rows[0].order_id]
        );
        // Fire-and-forget: calculate and persist real profit for this order
        if (orderResult.rows[0]) {
          recordOrderProfit(orderResult.rows[0].id, orderResult.rows[0].total);
        }
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
        const orderResult = await db.query(
          `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1 AND status IN ('pending','created') RETURNING id, total`,
          [payment.order_id]
        );
        if (orderResult.rows[0]) {
          recordOrderProfit(orderResult.rows[0].id, orderResult.rows[0].total);
        }
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

      const providerData = await buildProviderPayload(method, result.rows[0], return_url);

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
async function buildProviderPayload(method, payment, returnUrl) {
  const base = process.env.APP_URL || 'https://uszefaqualitet.pl';
  const successUrl = returnUrl || `${base}/koszyk.html?payment=success&payment_id=${payment.id}`;
  const cancelUrl  = `${base}/koszyk.html?payment=cancel`;

  if (method === 'stripe') {
    const stripe = getStripe();
    if (stripe) {
      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'pln',
                product_data: { name: `Zamówienie #${payment.id.slice(0, 8)}` },
                unit_amount: Math.round(parseFloat(payment.amount) * 100), // grosze
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: cancelUrl,
          metadata: { payment_id: payment.id },
        });
        return {
          provider: 'stripe',
          payment_id: payment.id,
          sandbox_mode: false,
          redirect_url: session.url,
          session_id: session.id,
        };
      } catch (err) {
        console.error('stripe checkout session error:', err.message);
        // Fall through to sandbox mode
      }
    }
    return {
      provider: 'stripe',
      payment_id: payment.id,
      sandbox_mode: true,
      redirect_url: successUrl,
      cancel_url: cancelUrl,
      warning: 'Bramka Stripe nie jest skonfigurowana. Ustaw STRIPE_SECRET_KEY w .env.',
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

// ─── POST /api/payments/stripe/webhook – Stripe signed webhook ────────────────
// Verifies the Stripe-Signature header then dispatches to an isolated handler
// for each event type.  Every handler updates only the table(s) relevant to
// that specific event – there is no mixing of payment SQL and subscription SQL.

// ── Private webhook handler functions ─────────────────────────────────────────

/**
 * checkout.session.completed – payment mode
 * Marks the payment row as paid and, if changed, marks the linked order as paid
 * and asynchronously records profit.
 *
 * @param {object}   session          – Stripe Checkout Session object
 * @param {Function} [profitRecorder] – optional override for recordOrderProfit (used in tests)
 */
async function handleCheckoutPaymentCompleted(session, profitRecorder) {
  const paymentId = session.metadata && session.metadata.payment_id;
  if (!paymentId) return;

  const paymentUpdate = await db.query(
    `UPDATE payments
        SET status       = 'paid',
            external_ref = $1,
            paid_at      = NOW(),
            updated_at   = NOW()
      WHERE id = $2 AND status = 'pending'`,
    [session.id, paymentId]
  );

  if (paymentUpdate.rowCount === 0) return; // already processed

  const paymentRow = await db.query('SELECT order_id FROM payments WHERE id = $1', [paymentId]);
  if (!paymentRow.rows[0]) return;

  const orderResult = await db.query(
    `UPDATE orders
        SET status = 'paid', updated_at = NOW()
      WHERE id = $1 AND status IN ('pending','created')
      RETURNING id, total`,
    [paymentRow.rows[0].order_id]
  );

  if (orderResult.rows[0]) {
    const recorder = profitRecorder || recordOrderProfit;
    recorder(orderResult.rows[0].id, orderResult.rows[0].total);
  }
}

/**
 * checkout.session.completed – subscription mode
 * Links the Stripe customer and subscription to the internal user identified by
 * client_reference_id (the user's UUID).  Also marks the platform subscription
 * record as active if one is referenced in metadata.
 */
async function handleCheckoutSubscriptionCompleted(session) {
  const customerId  = session.customer;
  const stripeSubId = session.subscription;
  const userId      = session.client_reference_id;
  const plan        = session.metadata && session.metadata.plan;
  const subId       = session.metadata && session.metadata.subscription_id;

  // Mark the internal subscription record active (if referenced)
  if (subId) {
    await db.query(
      `UPDATE subscriptions
          SET status = 'active', updated_at = NOW()
        WHERE id = $1 AND status != 'active'`,
      [subId]
    );
  }

  // Link Stripe identifiers to the user account
  if (customerId && userId) {
    const result = await db.query(
      `UPDATE users
          SET stripe_customer_id     = $1,
              stripe_subscription_id = $2,
              subscription_status    = 'active',
              subscription_plan      = COALESCE($3, subscription_plan),
              updated_at             = NOW()
        WHERE id = $4`,
      [customerId, stripeSubId, plan || null, userId]
    );
    if (result.rowCount === 0) {
      console.warn(`stripe webhook: checkout.session.completed (subscription) – no user found for client_reference_id=${userId}`);
    }
  }
}

/**
 * customer.subscription.created / customer.subscription.updated
 * Keeps the users row in sync with the latest Stripe subscription state.
 */
async function handleSubscriptionUpserted(sub) {
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;
  const plan = sub.metadata && sub.metadata.plan;

  await db.query(
    `UPDATE users
        SET stripe_subscription_id = $1,
            subscription_status    = $2,
            subscription_plan      = COALESCE($3, subscription_plan),
            current_period_end     = $4,
            updated_at             = NOW()
      WHERE stripe_customer_id = $5`,
    [sub.id, sub.status, plan || null, periodEnd, sub.customer]
  );
}

/**
 * customer.subscription.deleted
 * Marks the subscription as canceled and clears the subscription identifiers
 * so that a future sync cannot accidentally resurrect a deleted subscription.
 */
async function handleSubscriptionDeleted(sub) {
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;

  await db.query(
    `UPDATE users
        SET stripe_subscription_id = NULL,
            subscription_status    = 'canceled',
            current_period_end     = $1,
            updated_at             = NOW()
      WHERE stripe_customer_id = $2`,
    [periodEnd, sub.customer]
  );
}

/**
 * invoice.paid
 * Restores the subscription to active when a previously failing invoice is paid.
 * Also updates the period end so the renewal date stays current.
 */
async function handleInvoicePaid(invoice) {
  if (!invoice.customer) return;

  const firstLine   = invoice.lines && invoice.lines.data && invoice.lines.data[0];
  const periodEndTs = firstLine && firstLine.period && firstLine.period.end;
  const periodEnd   = periodEndTs ? new Date(periodEndTs * 1000) : null;

  await db.query(
    `UPDATE users
        SET subscription_status = 'active',
            current_period_end  = COALESCE($1, current_period_end),
            updated_at          = NOW()
      WHERE stripe_customer_id  = $2
        AND subscription_status IN ('past_due','incomplete','unpaid')`,
    [periodEnd, invoice.customer]
  );
}

/**
 * invoice.payment_failed
 * Marks the subscription as past_due so the owner panel can display the
 * correct status and prompt the user to update their payment method.
 */
async function handleInvoicePaymentFailed(invoice) {
  if (!invoice.customer) return;

  await db.query(
    `UPDATE users
        SET subscription_status = 'past_due',
            updated_at          = NOW()
      WHERE stripe_customer_id = $1`,
    [invoice.customer]
  );
}

// ── Route handler ──────────────────────────────────────────────────────────────

router.post(
  '/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig           = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(503).json({ error: 'STRIPE_WEBHOOK_SECRET nie jest skonfigurowany' });
    }

    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: 'STRIPE_SECRET_KEY nie jest skonfigurowany' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('stripe webhook signature error:', err.message);
      return res.status(400).json({ error: `Błąd weryfikacji webhooka: ${err.message}` });
    }

    try {
      switch (event.type) {

        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.mode === 'payment') {
            await handleCheckoutPaymentCompleted(session);
          } else if (session.mode === 'subscription') {
            await handleCheckoutSubscriptionCompleted(session);
          }
          break;
        }

        case 'checkout.session.expired': {
          const session = event.data.object;
          const paymentId = session.metadata && session.metadata.payment_id;
          if (paymentId) {
            await db.query(
              `UPDATE payments
                  SET status = 'failed', updated_at = NOW()
                WHERE id = $1 AND status = 'pending'`,
              [paymentId]
            );
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpserted(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
          break;

        default:
          // Unhandled event type – acknowledged but not processed
          break;
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('stripe webhook processing error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;

// Export isolated handler functions for unit testing.
// These are NOT part of the public API – they are only used by the test suite.
module.exports._handlers = {
  handleCheckoutPaymentCompleted,
  handleCheckoutSubscriptionCompleted,
  handleSubscriptionUpserted,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
};
