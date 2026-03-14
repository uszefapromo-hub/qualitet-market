'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Lazy-require db to avoid circular dependency issues
let db;
function getDb() {
  if (!db) db = require('../config/database');
  return db;
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
    const payload = jwt.verify(token, JWT_SECRET);
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
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Middleware: verify the shop referenced in the request has an active, non-expired subscription.
 * Resolves shop_id from req.body.store_id, req.params.store_id or req.query.store_id.
 * On success, attaches the subscription record to req.subscription.
 */
async function requireActiveSubscription(req, res, next) {
  // Subscription gates removed — platform operates without subscription requirements.
  // All authenticated sellers can add products regardless of subscription status.
  return next();
}

module.exports = { authenticate, requireRole, requireSuperAdmin, requireActiveSubscription, signToken };