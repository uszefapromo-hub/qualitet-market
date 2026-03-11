'use strict';

const db = require('./database');

/**
 * Write a row to the audit_logs table.
 *
 * @param {object} opts
 * @param {string|null} opts.userId     – actor (null for system)
 * @param {string}      opts.action     – e.g. 'order.created'
 * @param {string|null} opts.entityType – e.g. 'order', 'shop_product'
 * @param {string|null} opts.entityId   – UUID of the affected row
 * @param {object|null} opts.payload    – arbitrary JSON metadata
 * @param {string|null} opts.ip         – request IP address
 */
async function logAudit({ userId = null, action, entityType = null, entityId = null, payload = null, ip = null }) {
  try {
    const { v4: uuidv4 } = require('uuid');
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [uuidv4(), userId, action, entityType, entityId, payload ? JSON.stringify(payload) : null, ip]
    );
  } catch (err) {
    // Audit logging must never break the main request flow
    console.error('audit log error:', err.message);
  }
}

module.exports = { logAudit };
