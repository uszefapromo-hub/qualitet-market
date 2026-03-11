'use strict';

/**
 * Audit log helper.
 * Inserts a row into audit_logs without throwing – logging failures must
 * never break the main request flow.
 *
 * @param {object} opts
 * @param {string|null} opts.actorUserId  – user who triggered the action
 * @param {string}      opts.entityType   – entity class (e.g. 'shop_product')
 * @param {string|null} opts.entityId     – entity UUID
 * @param {string}      opts.action       – verb (e.g. 'create', 'update', 'delete')
 * @param {object}      [opts.payload]    – additional data (stored as JSON)
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function auditLog({ actorUserId, entityType, entityId, action, payload = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        uuidv4(),
        actorUserId || null,
        action,
        entityType,
        entityId || null,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    console.error('audit_log write error:', err.message);
  }
}

module.exports = { auditLog };
