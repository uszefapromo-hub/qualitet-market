'use strict'

/**
 * Products Module – Model (data-access layer)
 */

const db = require('../../config/database')

async function findById(id) {
  const result = await db.query('SELECT * FROM products WHERE id = $1', [id])
  return result.rows[0] || null
}

async function list({ supplierId, isCentral, limit = 20, offset = 0 } = {}) {
  const conditions = []
  const params = []

  if (supplierId !== undefined) {
    params.push(supplierId)
    conditions.push(`supplier_id = $${params.length}`)
  }
  if (isCentral !== undefined) {
    params.push(isCentral)
    conditions.push(`is_central = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  params.push(Math.min(100, limit), offset)
  const result = await db.query(
    `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
  return result.rows
}

module.exports = { findById, list }
