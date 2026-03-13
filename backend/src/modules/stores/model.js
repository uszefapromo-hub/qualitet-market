'use strict'

/**
 * Stores Module – Model (data-access layer)
 */

const db = require('../../config/database')

async function findById(id) {
  const result = await db.query('SELECT * FROM stores WHERE id = $1', [id])
  return result.rows[0] || null
}

async function findBySlug(slug) {
  const result = await db.query('SELECT * FROM stores WHERE slug = $1', [slug])
  return result.rows[0] || null
}

async function findByOwnerId(ownerId) {
  const result = await db.query('SELECT * FROM stores WHERE owner_id = $1', [ownerId])
  return result.rows[0] || null
}

async function list({ limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    'SELECT * FROM stores ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  )
  return result.rows
}

module.exports = { findById, findBySlug, findByOwnerId, list }
