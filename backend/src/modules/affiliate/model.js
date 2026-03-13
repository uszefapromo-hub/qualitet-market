'use strict'

/**
 * Affiliate Module – Model (data-access layer)
 */

const db = require('../../config/database')

async function findLinkByCode(code) {
  const result = await db.query('SELECT * FROM affiliate_links WHERE code = $1', [code])
  return result.rows[0] || null
}

async function findLinksByUserId(userId) {
  const result = await db.query(
    'SELECT * FROM affiliate_links WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  )
  return result.rows
}

async function recordClick({ linkId, ipAddress, userAgent, referrer }) {
  const result = await db.query(
    `INSERT INTO affiliate_clicks (link_id, ip_address, user_agent, referrer)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [linkId, ipAddress || null, userAgent || null, referrer || null]
  )
  return result.rows[0]
}

module.exports = { findLinkByCode, findLinksByUserId, recordClick }
