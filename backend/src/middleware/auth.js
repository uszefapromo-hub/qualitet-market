'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

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
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token nieprawidłowy lub wygasły' });
  }
}

/**
 * Middleware factory: require the requesting user to have a specific role.
 * @param {...string} roles – e.g. 'owner', 'seller', 'admin'
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
 * Middleware: verify the store referenced in the request has an active subscription.
 *
 * Reads store_id from req.body, req.params (storeId / store_id), or req.query.
 * If no store_id is present the check is skipped (fail-open).
 * Sets req.subscription when an active subscription is found.
 *
 * Returns 403 { error: 'subscription_expired' } when the subscription has lapsed.
 */
async function requireActiveSubscription(req, res, next) {
  const storeId =
    req.body?.store_id ||
    req.params?.storeId ||
    req.params?.store_id ||
    req.query?.store_id;

  if (!storeId) return next();

  // Lazy-require db to avoid circular dependency at module load time
  const db = require('../config/database');

  try {
    const storeResult = await db.query(
      'SELECT owner_id FROM stores WHERE id = $1',
      [storeId]
    );
    const store = storeResult.rows[0];
    if (!store) return next(); // let the route return 404

    const subResult = await db.query(
      `SELECT id FROM subscriptions
       WHERE user_id = $1 AND status = 'active' AND ends_at > NOW()
       LIMIT 1`,
      [store.owner_id]
    );

    if (!subResult.rows[0]) {
      return res.status(403).json({
        error: 'subscription_expired',
        message: 'Subskrypcja wygasła. Odnów plan, aby kontynuować.',
      });
    }

    req.subscription = subResult.rows[0];
    next();
  } catch (err) {
    console.error('requireActiveSubscription error:', err.message);
    next(); // fail open – do not block legitimate requests on DB errors
  }
}

/**
 * Sign and return a new JWT for the given user record.
 * @param {{ id: string, email: string, role: string }} user
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { authenticate, requireRole, requireActiveSubscription, signToken };
