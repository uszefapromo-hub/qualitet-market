'use strict'

/**
 * Auth Module – Model (data-access layer)
 *
 * SQL helpers for the users table scoped to authentication operations.
 */

const db = require('../../config/database')

async function findUserByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email])
  return result.rows[0] || null
}

async function findUserById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] || null
}

async function createUser({ id, email, passwordHash, name, role }) {
  const result = await db.query(
    `INSERT INTO users (id, email, password_hash, name, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, email, passwordHash, name, role]
  )
  return result.rows[0]
}

module.exports = { findUserByEmail, findUserById, createUser }
