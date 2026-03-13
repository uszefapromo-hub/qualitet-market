'use strict'

/**
 * Users Module – Routes
 *
 * GET  /api/users/profile  – get full user profile (user + user_profiles row)
 * PUT  /api/users/profile  – update user and extended profile
 */

const { Router } = require('express')
const rateLimit = require('express-rate-limit')
const { authenticate } = require('../../middleware/auth')
const ctrl = require('./controller')

const router = Router()

const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele żądań. Spróbuj ponownie za chwilę.' },
})

router.use(profileLimiter)
router.use(authenticate)

router.get('/profile', ctrl.getProfile)
router.put('/profile', ctrl.updateProfileValidators, ctrl.updateProfile)

module.exports = router
