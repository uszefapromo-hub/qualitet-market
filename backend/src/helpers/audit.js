'use strict';

/**
 * Audit log helper.
 * Inserts a row into audit_logs without throwing – logging failures must
 * never break the main request flow.
 *
 * @param {object} opts
 * @param {string|null} opts.actorUserId
 * @param {string}      opts.entityType
 * @param {string|null} opts.entityId
 * @param {string}      opts.action
 * @param {object}      [opts.payload]
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function auditLog({ actorUserId, entityType, entityId, action, payload = null }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (id, actor_user_id, entity_type, entity_id, action, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), actorUserId || null, entityType, entityId || null, action, payload ? JSON.stringify(payload) : null]
    );
  } catch (err) {
    console.error('audit_log write error:', err.message);
  }
}

module.exports = { auditLog };
