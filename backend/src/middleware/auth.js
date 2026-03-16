'use strict';

const jwt = require('jsonwebtoken');
const { validate: isUuid } = require('uuid');
const { getJwtSecret } = require('../config/runtime');

// Lazy-require db to avoid circular dependency issues
let db;
function getDb() {
  if (!db) db = require('../config/database');
  return db;
}

function resolveStoreId(req) {
  const sources = [req.body, req.params, req.query];

  for (const source of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, 'store_id')) {
      return source.store_id;
    }
  }

  return undefined;
}

/**
 * Middleware: verify Bearer token and attach decoded payload to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak tokenu autoryzacyjnego' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token nieprawidłowy lub wygasły' });
  }
}

/**
 * Middleware factory: require the requesting user to have a specific role.
 * @param {...string} roles – e.g. 'owner', 'seller', 'admin', 'superadmin'
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }
    next();
  };
}

/**
 * Middleware: require superadmin role (alias for requireRole('superadmin', 'owner')).
 * Owner is the platform owner and has full superadmin privileges.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'superadmin' && req.user.role !== 'owner')) {
    return res.status(403).json({ error: 'Wymagane uprawnienia superadmin' });
  }
  next();
}

/**
 * Sign and return a new JWT for the given user record.
 * @param {{ id: string, email: string, role: string }} user
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Middleware: look up the active subscription for the shop referenced in the request.
 * Resolves shop_id from req.body.store_id, req.params.store_id or req.query.store_id.
 *
 * Product gating policy (enforced in route handlers):
 *   • req.subscription === null  – no active subscription record found for the store.
 *     The route handler treats this as open access: products can be added without any
 *     cap.  This covers new sellers who have not yet created a subscription.
 *   • req.subscription.product_limit === null  – unlimited plan (basic / pro / elite).
 *     No product cap is applied.
 *   • req.subscription.product_limit = N  – capped plan (e.g., free plan with 10-product
 *     limit, or a custom admin-set cap).  The route handler enforces the cap and returns
 *     403 { error: 'product_limit_reached' } when the store already has N or more products.
 *
 * This middleware never blocks the request itself; it only attaches data for downstream checks.
 */
async function requireActiveSubscription(req, res, next) {
  const storeId = resolveStoreId(req);

  if (storeId !== undefined && storeId !== null && !isUuid(String(storeId))) {
    return res.status(400).json({ error: 'Nieprawidłowy store_id' });
  }

  req.subscription = null;

  if (storeId) {
    try {
      const result = await getDb().query(
        `SELECT id, plan, status, product_limit, commission_rate, expires_at
           FROM subscriptions
          WHERE shop_id = $1
            AND status = 'active'
            AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC
          LIMIT 1`,
        [storeId]
      );
      req.subscription = result.rows[0] || null;
    } catch (err) {
      console.error('requireActiveSubscription query error:', err.message);
      // Non-critical: allow request through if subscription lookup fails
    }
  }

  return next();
}

module.exports = { authenticate, requireRole, requireSuperAdmin, requireActiveSubscription, signToken };
