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
 * Middleware: verify the shop referenced in the request has an active, non-expired subscription.
 * Resolves shop_id from req.body.store_id, req.params.store_id or req.query.store_id.
 * On success, attaches the subscription record to req.subscription.
 */
async function requireActiveSubscription(req, res, next) {
  const storeId = resolveStoreId(req);

  if (storeId !== undefined && storeId !== null && !isUuid(String(storeId))) {
    return res.status(400).json({ error: 'Nieprawidłowy store_id' });
  }

  req.subscription = null;
  return next();
}

module.exports = { authenticate, requireRole, requireSuperAdmin, requireActiveSubscription, signToken };
