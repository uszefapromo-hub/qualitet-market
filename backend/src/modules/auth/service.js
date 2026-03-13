'use strict'

/**
 * Auth Module – Service (business-logic layer)
 *
 * Password hashing, token signing, and credential verification.
 * Delegates DB access to the model layer.
 */

const bcrypt = require('bcryptjs')
const { signToken } = require('../../middleware/auth')
const AuthModel = require('./model')

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

/**
 * Verify credentials and return a signed JWT.
 * Throws with err.status if login fails.
 */
async function login(email, password) {
  const user = await AuthModel.findUserByEmail(email)
  if (!user) {
    const err = new Error('Nieprawidłowy email lub hasło')
    err.status = 401
    throw err
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    const err = new Error('Nieprawidłowy email lub hasło')
    err.status = 401
    throw err
  }

  const token = signToken(user)
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } }
}

module.exports = { hashPassword, verifyPassword, login }
