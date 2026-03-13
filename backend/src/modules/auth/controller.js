'use strict'

/**
 * Auth Module – Controller
 *
 * Thin request/response handlers.  Business logic lives in service.js.
 * The actual Express router is in ../../routes/auth.js (legacy flat routes).
 * New code should prefer this controller for direct imports.
 */

const AuthService = require('./service')

async function login(req, res, next) {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'Email i hasło są wymagane' })
  }
  try {
    const result = await AuthService.login(email, password)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

module.exports = { login }
