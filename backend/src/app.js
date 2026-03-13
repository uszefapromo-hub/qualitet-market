'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const storesRouter = require('./routes/stores');
const shopsRouter = require('./routes/shops');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const subscriptionsRouter = require('./routes/subscriptions').router;
const suppliersRouter = require('./routes/suppliers');
const categoriesRouter = require('./routes/categories');
const cartRouter = require('./routes/cart');
const adminRouter = require('./routes/admin');
const paymentsRouter = require('./routes/payments');
const shopProductsRouter = require('./routes/shop-products');
const myRouter = require('./routes/my');
const storeRouter = require('./routes/store');
const referralRouter = require('./routes/referral').router;
const referralsRouter = require('./routes/referrals');
const scriptsRouter = require('./routes/scripts');
const analyticsRouter = require('./routes/analytics');
const { importSupplierProducts } = require('./services/supplier-import');
const db = require('./config/database');

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('CORS policy: origin not allowed'));
    },
    credentials: true,
  })
);

// ─── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Rate limiting ─────────────────────────────────────────────────────────────
const isTest = process.env.NODE_ENV === 'test';

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: isTest ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' },
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 20,
  message: { error: 'Zbyt wiele prób logowania. Spróbuj za 15 minut.' },
});
app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Readiness check ───────────────────────────────────────────────────────────
// Reports per-subsystem status so operators can confirm the platform is ready
// for first sellers and first orders before opening to the public.
app.get('/api/readiness', async (_req, res) => {
  const checks = {};
  let allOk = true;

  // Database connectivity
  try {
    await db.query('SELECT 1');
    checks.database = 'ok';
  } catch (_err) {
    checks.database = 'error';
    allOk = false;
  }

  // User flow: register / login endpoint reachable
  checks.user_flow = {
    register:  'POST /api/users/register',
    login:     'POST /api/users/login',
    me:        'GET  /api/users/me',
  };

  // Store flow: store + product management
  checks.store_flow = {
    create_store:   'POST /api/stores',
    list_products:  'GET  /api/products',
    add_to_store:   'POST /api/shop-products',
  };

  // Cart & order flow
  checks.cart_order_flow = {
    add_to_cart:   'POST /api/cart',
    create_order:  'POST /api/orders',
    order_status:  'PATCH /api/orders/:id/status',
  };

  // Payment flow
  checks.payment_flow = {
    initiate_payment: 'POST /api/payments/:orderId/initiate',
    webhook:          'POST /api/payments/webhook',
    update_status:    'PUT  /api/payments/:id/status',
  };

  // Subscription system
  checks.subscription_system = {
    plans:       ['trial', 'basic', 'pro', 'elite'],
    create:      'POST /api/subscriptions',
  };

  // Referral system
  checks.referral_system = {
    create_code:  'POST /api/referrals',
    redeem_code:  'POST /api/referrals/redeem',
    list_uses:    'GET  /api/referrals/:id/uses',
  };

  // Scripts (seller storefront scripts)
  checks.scripts_system = {
    create:       'POST /api/scripts',
    store_scripts: 'GET  /api/scripts/store/:storeId',
  };

  // Analytics snapshots
  checks.analytics_system = {
    capture:      'POST /api/analytics/capture',
    latest:       'GET  /api/analytics/latest',
    list:         'GET  /api/analytics',
  };

  // Announcements & communications
  checks.announcements_system = {
    list_public:  'GET  /api/announcements',
    admin_list:   'GET  /api/admin/announcements',
    admin_create: 'POST /api/admin/announcements',
    admin_mail:   'POST /api/admin/mail',
  };

  // Store generator & promotions
  checks.generator_system = {
    generate_store:    'POST /api/my/store/generate',
    generate_promo:    'POST /api/my/promotion/generate',
  };

  const status = allOk ? 'ready' : 'degraded';
  return res.status(allOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    checks,
    message: allOk
      ? 'Platforma gotowa na pierwszych sprzedawców i pierwsze zamówienia.'
      : 'Platforma niedostępna – sprawdź logi bazy danych.',
  });
});

// ─── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/stores', storesRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/cart', cartRouter);
app.use('/api/admin', adminRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/shop-products', shopProductsRouter);
app.use('/api/my', myRouter);
app.use('/api/store', storeRouter);
app.use('/api/referral', referralRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/scripts', scriptsRouter);
app.use('/api/analytics', analyticsRouter);

// ─── Public announcements feed ─────────────────────────────────────────────────
// Active platform announcements visible to all authenticated users.
app.get('/api/announcements', async (req, res) => {
  const roleFilter = req.query.role || null;
  try {
    const result = await db.query(
      `SELECT id, title, body, type, target_role, created_at
         FROM announcements
        WHERE is_active = TRUE
          AND ($1::text IS NULL OR target_role IS NULL OR target_role = $1)
        ORDER BY created_at DESC
        LIMIT 20`,
      [roleFilter]
    );
    return res.json({ announcements: result.rows });
  } catch (_err) {
    return res.json({ announcements: [] });
  }
});

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Nie znaleziono zasobu' }));

// ─── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Wewnętrzny błąd serwera' });
});

// ─── Supplier sync scheduler – every 12 hours ─────────────────────────────────
// Disabled in test environment to avoid interference with mocked DB queries.
if (process.env.NODE_ENV !== 'test') {
  const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

  const syncAllSuppliers = async () => {
    try {
      const result = await db.query(
        `SELECT id FROM suppliers WHERE status = 'active' AND (api_url IS NOT NULL OR xml_endpoint IS NOT NULL OR csv_endpoint IS NOT NULL)`
      );
      for (const row of result.rows) {
        try {
          const count = await importSupplierProducts(row.id);
          console.log(`[sync] Supplier ${row.id}: ${count} products synced`);
        } catch (err) {
          console.error(`[sync] Supplier ${row.id} error:`, err.message);
        }
      }
    } catch (err) {
      console.error('[sync] Failed to load suppliers:', err.message);
    }
  };

  setInterval(syncAllSuppliers, SYNC_INTERVAL_MS);
}

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HurtDetalUszefaQUALITET API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app;
