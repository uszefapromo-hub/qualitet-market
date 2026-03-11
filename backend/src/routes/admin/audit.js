'use strict';

const express = require('express');

const db = require('../../config/database');

const router = express.Router();

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page     || '1',  10));
  const limit    = Math.min(100, parseInt(req.query.limit   || '20', 10));
  const offset   = (page - 1) * limit;
  const action   = req.query.action   || null;
  const resource = req.query.resource || null;

  try {
    const conditions = [];
    const params = [];

    if (action) {
      params.push(`%${action}%`);
      conditions.push(`al.action ILIKE $${params.length}`);
    }
    if (resource) {
      params.push(resource);
      conditions.push(`al.resource = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT al.*, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, logs: result.rows });
  } catch (err) {
    console.error('admin audit logs error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Helper: write an audit log entry ─────────────────────────────────────────
/**
 * @param {string}      userId     – acting user's UUID
 * @param {string}      action     – e.g. 'user.update'
 * @param {string}      resource   – e.g. 'user', 'order'
 * @param {string|null} resourceId – UUID of the affected resource
 * @param {object}      metadata   – arbitrary JSON payload
 * @param {object}      req        – Express request (for IP)
 */
async function logAudit(userId, action, resource, resourceId, metadata, req) {
  try {
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    await db.query(
      `INSERT INTO audit_logs (id, user_id, action, resource, resource_id, metadata, ip_address, created_at)
       VALUES (uuid_generate_v4(),$1,$2,$3,$4,$5,$6,NOW())`,
      [userId || null, action, resource, resourceId || null, JSON.stringify(metadata || {}), ip]
    );
  } catch (err) {
    // Audit failures must not break the main request
    console.error('logAudit error:', err.message);
  }
}

module.exports = router;
module.exports.logAudit = logAudit;
