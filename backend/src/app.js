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

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Nie znaleziono zasobu' }));

// ─── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Wewnętrzny błąd serwera' });
});

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HurtDetalUszefaQUALITET API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

module.exports = app;
