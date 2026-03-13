'use strict'

/**
 * Payments Module – Model (data-access layer)
 */

const db = require('../../config/database')

async function findById(id) {
  const result = await db.query('SELECT * FROM payments WHERE id = $1', [id])
  return result.rows[0] || null
}

async function findByOrderId(orderId) {
  const result = await db.query('SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC', [orderId])
  return result.rows
}

async function updateStatus(id, status, providerRef) {
  const result = await db.query(
    `UPDATE payments SET status = $1, provider_ref = COALESCE($2, provider_ref), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, providerRef || null, id]
  )
  return result.rows[0] || null
}

module.exports = { findById, findByOrderId, updateStatus }
