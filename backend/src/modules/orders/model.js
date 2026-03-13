'use strict'

/**
 * Orders Module – Model (data-access layer)
 */

const db = require('../../config/database')

async function findById(id) {
  const result = await db.query('SELECT * FROM orders WHERE id = $1', [id])
  return result.rows[0] || null
}

async function findByBuyerId(buyerId, { limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    'SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [buyerId, limit, offset]
  )
  return result.rows
}

async function findByStoreId(storeId, { limit = 20, offset = 0 } = {}) {
  const result = await db.query(
    'SELECT * FROM orders WHERE store_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
    [storeId, limit, offset]
  )
  return result.rows
}

async function updateStatus(id, status) {
  const result = await db.query(
    'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
    [status, id]
  )
  return result.rows[0] || null
}

module.exports = { findById, findByBuyerId, findByStoreId, updateStatus }
