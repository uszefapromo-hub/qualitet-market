'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_PLANS = [
  'free', 'trial',                          // seller free (trial is legacy alias)
  'basic', 'pro', 'elite', 'premium',       // seller paid plans (premium is alias for elite)
  'supplier_basic', 'supplier_pro',         // supplier plans
  'brand',                                  // company / brand plan
  'artist_basic', 'artist_pro',             // artist plans
];

/**
 * Plan configuration – aligned with cennik.html final pricing.
 *
 * product_limit / commission_rate are the DB column names used for persistence.
 * maxProducts / platformMarginPct are semantic aliases used in business logic.
 * durationDays is the default subscription period in days.
 *
 * Seller plans:  free → basic (Seller PRO, 79 zł) → pro (Seller Business, 249 zł) → elite (499 zł)
 * Supplier:      supplier_basic (149 zł) → supplier_pro (399 zł)
 * Company/Brand: brand (999 zł)
 * Artist:        artist_basic (free) → artist_pro (49 zł)
 */
const PLAN_CONFIG = {
  // ── Seller Free (replaces legacy trial) ─────────────────────────────────────
  free:           { product_limit: 10,   maxProducts: 10,   commission_rate: 0.05, platformMarginPct: 5,  duration_days: null, durationDays: null, price_pln: 0 },
  trial:          { product_limit: 10,   maxProducts: 10,   commission_rate: 0.05, platformMarginPct: 5,  duration_days: null, durationDays: null, price_pln: 0 }, // legacy alias for free

  // ── Seller paid plans ────────────────────────────────────────────────────────
  basic:          { product_limit: null, maxProducts: null, commission_rate: 0.03, platformMarginPct: 3,  duration_days: 30,   durationDays: 30,   price_pln: 79 },   // Seller PRO
  pro:            { product_limit: null, maxProducts: null, commission_rate: 0.02, platformMarginPct: 2,  duration_days: 30,   durationDays: 30,   price_pln: 249 },  // Seller Business
  elite:          { product_limit: null, maxProducts: null, commission_rate: 0.01, platformMarginPct: 1,  duration_days: 30,   durationDays: 30,   price_pln: 499 },  // Elite
  premium:        { product_limit: null, maxProducts: null, commission_rate: 0.01, platformMarginPct: 1,  duration_days: 30,   durationDays: 30,   price_pln: 499 },  // Premium (alias for elite)

  // ── Supplier plans ───────────────────────────────────────────────────────────
  supplier_basic: { product_limit: null, maxProducts: null, commission_rate: 0.00, platformMarginPct: 0,  duration_days: 30,   durationDays: 30,   price_pln: 149 },  // Supplier Basic
  supplier_pro:   { product_limit: null, maxProducts: null, commission_rate: 0.00, platformMarginPct: 0,  duration_days: 30,   durationDays: 30,   price_pln: 399 },  // Supplier Pro

  // ── Company / Brand plan ─────────────────────────────────────────────────────
  brand:          { product_limit: null, maxProducts: null, commission_rate: 0.00, platformMarginPct: 0,  duration_days: 30,   durationDays: 30,   price_pln: 999 },  // Brand Plan

  // ── Artist plans ─────────────────────────────────────────────────────────────
  artist_basic:   { product_limit: null, maxProducts: null, commission_rate: 0.10, platformMarginPct: 10, duration_days: null, durationDays: null, price_pln: 0 },   // Artist Basic (free)
  artist_pro:     { product_limit: null, maxProducts: null, commission_rate: 0.06, platformMarginPct: 6,  duration_days: 30,   durationDays: 30,   price_pln: 49 },   // Artist Pro
};

// Human-readable display names for plans
const PLAN_DISPLAY_NAMES = {
  free:           'Seller Free',
  trial:          'Seller Free',        // legacy alias
  basic:          'Seller PRO',
  pro:            'Seller Business',
  elite:          'Elite',
  premium:        'Elite Premium',      // alias for elite
  supplier_basic: 'Supplier Basic',
  supplier_pro:   'Supplier Pro',
  brand:          'Brand Plan',
  artist_basic:   'Artist Basic',
  artist_pro:     'Artist Pro',
};

// Lazily initialised Stripe SDK instance
let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line global-require
  _stripe = require('stripe')(key);
  return _stripe;
}

/**
 * Sync a Stripe subscription into the users table.
 * Retrieves live status from Stripe and persists it to the DB.
 *
 * Note: subscription_plan uses COALESCE($3, subscription_plan), which means
 * it is only updated when Stripe subscription metadata contains a `plan` key.
 * If Stripe metadata does not carry a plan value the existing DB value is kept.
 * This is intentional – the plan may have been set by an earlier checkout.session
 * event or by an admin.  If you need to explicitly clear the plan, call a direct
 * UPDATE instead of this helper.
 *
 * @param {object} stripeSub – Stripe Subscription object
 * @param {string} userId    – internal user UUID
 * @returns {{ subscription_status, subscription_plan, current_period_end }}
 */
async function syncStripeSubToDb(stripeSub, userId) {
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : null;
  const planMeta = stripeSub.metadata && stripeSub.metadata.plan;

  await db.query(
    `UPDATE users SET
       stripe_subscription_id = $1,
       subscription_status    = $2,
       subscription_plan      = COALESCE($3, subscription_plan),
       current_period_end     = $4,
       updated_at             = NOW()
     WHERE id = $5`,
    [stripeSub.id, stripeSub.status, planMeta || null, periodEnd, userId]
  );

  return {
    subscription_status: stripeSub.status,
    subscription_plan: planMeta || null,
    current_period_end: periodEnd,
  };
}

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
    body('status').optional().isIn(['active', 'cancelled', 'expired', 'legacy']),
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
           is_legacy       = CASE WHEN $1 = 'legacy' THEN true ELSE is_legacy END,
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

// ─── POST /api/subscriptions/:id/checkout – create Stripe checkout for plan ───

router.post(
  '/:id/checkout',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const subResult = await db.query(
        `SELECT s.*, st.owner_id
           FROM subscriptions s
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

      const plan = sub.plan;
      const config = PLAN_CONFIG[plan];
      if (!config) return res.status(400).json({ error: 'Nieznany plan subskrypcji' });

      const pricePln = config.price_pln || 0;
      if (pricePln === 0) {
        return res.status(400).json({ error: 'Ten plan jest bezpłatny – nie wymaga płatności' });
      }

      const stripe = getStripe();
      if (!stripe) {
        return res.status(503).json({
          error: 'Bramka Stripe nie jest skonfigurowana.',
          warning: 'Ustaw STRIPE_SECRET_KEY w .env.',
          sandbox_mode: true,
        });
      }

      const base = process.env.APP_URL || 'https://uszefaqualitet.pl';

      // Prefer a pre-configured recurring Price ID; fall back to one-time payment
      const envKey = `STRIPE_PRICE_ID_${plan.toUpperCase()}`;
      const stripePriceId = process.env[envKey];

      // Retrieve or create a Stripe customer linked to this user
      const userResult = await db.query(
        'SELECT stripe_customer_id, email, name FROM users WHERE id = $1',
        [req.user.id]
      );
      const userRow = userResult.rows[0] || {};
      let customerId = userRow.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userRow.email || undefined,
          name: userRow.name || undefined,
          metadata: { user_id: req.user.id },
        });
        customerId = customer.id;
        // Persist the customer ID; if DB write fails, log but proceed so the
        // checkout session is still created (customer exists in Stripe already).
        try {
          await db.query(
            'UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2',
            [customerId, req.user.id]
          );
        } catch (dbErr) {
          console.error(`Failed to save stripe_customer_id ${customerId} for user ${req.user.id}:`, dbErr.message);
        }
      }

      let session;
      if (stripePriceId) {
        // Recurring subscription checkout
        session = await stripe.checkout.sessions.create({
          customer: customerId,
          client_reference_id: req.user.id,
          payment_method_types: ['card'],
          line_items: [{ price: stripePriceId, quantity: 1 }],
          mode: 'subscription',
          success_url: `${base}/cennik.html?subscription=success&subscription_id=${sub.id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/cennik.html?subscription=cancel`,
          metadata: { subscription_id: sub.id, plan },
          subscription_data: { metadata: { subscription_id: sub.id, plan, user_id: req.user.id } },
        });
      } else {
        // One-time payment fallback
        session = await stripe.checkout.sessions.create({
          customer: customerId,
          client_reference_id: req.user.id,
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'pln',
                product_data: {
                  name: `Subskrypcja Qualitet – ${PLAN_DISPLAY_NAMES[plan] || plan}`,
                  description: config.duration_days
                    ? `${config.duration_days} dni dostępu, ${config.product_limit == null ? 'nieograniczona' : `do ${config.product_limit}`} liczba produktów`
                    : `Dostęp bez okresu ważności`,
                },
                unit_amount: pricePln * 100,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${base}/cennik.html?subscription=success&subscription_id=${sub.id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${base}/cennik.html?subscription=cancel`,
          metadata: { subscription_id: sub.id, plan },
        });
      }

      return res.json({
        subscription_id: sub.id,
        plan,
        price_pln: pricePln,
        redirect_url: session.url,
        session_id: session.id,
        mode: session.mode,
      });
    } catch (err) {
      console.error('subscription checkout error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/subscriptions/plans – public plan listing ───────────────────────

router.get('/plans', async (_req, res) => {
  // Exclude legacy 'trial' alias – expose 'free' instead
  const plans = Object.entries(PLAN_CONFIG)
    .filter(([name]) => name !== 'trial')
    .map(([name, cfg]) => ({
      name,
      display_name: PLAN_DISPLAY_NAMES[name] || name,
      price_pln: cfg.price_pln,
      duration_days: cfg.duration_days,
      product_limit: cfg.product_limit,
      platform_margin_pct: cfg.platformMarginPct,
    }));
  return res.json({ plans });
});

// ─── GET /api/subscriptions/my-billing – owner billing status ─────────────────
// Returns the Stripe billing state for the authenticated owner/seller.
// Called on dashboard load to show plan, renewal date, and connection status.

router.get('/my-billing', authenticate, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT stripe_customer_id, stripe_subscription_id,
              subscription_status, subscription_plan, current_period_end,
              plan AS local_plan
         FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

    const stripe = getStripe();
    const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

    // If Stripe is configured and the user has a subscription, sync live data
    if (stripe && user.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        const synced = await syncStripeSubToDb(stripeSub, req.user.id);
        user.subscription_status = synced.subscription_status;
        if (synced.subscription_plan) user.subscription_plan = synced.subscription_plan;
        user.current_period_end = synced.current_period_end;
      } catch (stripeErr) {
        console.error('stripe subscription retrieve error:', stripeErr.message);
        // Return cached data if Stripe call fails
      }
    }

    const base = process.env.APP_URL || 'https://uszefaqualitet.pl';
    let customerPortalUrl = null;
    if (stripe && user.stripe_customer_id) {
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: user.stripe_customer_id,
          return_url: `${base}/owner-panel.html`,
        });
        customerPortalUrl = portalSession.url;
      } catch (_portalErr) {
        // Portal not configured – skip
      }
    }

    return res.json({
      stripe_configured: stripeConfigured,
      stripe_customer_id: user.stripe_customer_id || null,
      stripe_subscription_id: user.stripe_subscription_id || null,
      subscription_status: user.subscription_status || null,
      subscription_plan: user.subscription_plan || user.local_plan || null,
      current_period_end: user.current_period_end || null,
      customer_portal_url: customerPortalUrl,
    });
  } catch (err) {
    console.error('my-billing error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/subscriptions/stripe-sync – sync subscription on login ─────────
// Checks the user's Stripe subscription status and updates the DB.
// Called automatically after owner/seller login.

router.post('/stripe-sync', authenticate, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT stripe_customer_id, stripe_subscription_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });

    const stripe = getStripe();
    if (!stripe) {
      return res.json({ synced: false, reason: 'stripe_not_configured' });
    }

    // If we have a direct subscription ID, sync it
    if (user.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
        const synced = await syncStripeSubToDb(stripeSub, req.user.id);
        return res.json({ synced: true, ...synced });
      } catch (stripeErr) {
        console.error('stripe-sync retrieve error:', stripeErr.message);
        return res.json({ synced: false, reason: 'stripe_api_error', detail: stripeErr.message });
      }
    }

    // If we have a customer ID but no sub ID, look for active subscriptions
    if (user.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripe_customer_id,
          status: 'all',
          limit: 5,
        });
        const activeSub = subscriptions.data.find(
          (s) => ['active', 'trialing', 'past_due'].includes(s.status)
        );
        if (activeSub) {
          const synced = await syncStripeSubToDb(activeSub, req.user.id);
          return res.json({ synced: true, ...synced });
        }
      } catch (stripeErr) {
        console.error('stripe-sync list error:', stripeErr.message);
      }
    }

    return res.json({ synced: false, reason: 'no_subscription' });
  } catch (err) {
    console.error('stripe-sync error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, PLAN_CONFIG, PLAN_DISPLAY_NAMES, VALID_PLANS };

// Test-only helper: resets the cached Stripe instance so each test that checks
// "Stripe not configured" behaviour works correctly regardless of execution order.
if (process.env.NODE_ENV === 'test') {
  module.exports._resetStripeForTest = () => { _stripe = null; };
}

