'use strict'

/**
 * Creator Referral System – mounted at /api/creator/referrals
 *
 *   GET  /api/creator/referrals/my-code  – get or generate own referral code
 *   POST /api/creator/referrals/use      – use a referral code
 *   GET  /api/creator/referrals/stats    – referral statistics
 *   GET  /api/creator/referrals/list     – list invited creators
 */

const crypto  = require('crypto')
const express = require('express')
const { body } = require('express-validator')
const { v4: uuidv4 } = require('uuid')

const db = require('../config/database')
const { authenticate, requireRole } = require('../middleware/auth')
const { validate } = require('../middleware/validate')

const router = express.Router()

const BASE_URL = process.env.APP_URL || 'https://uszefaqualitet.pl'

// ─── GET /api/creator/referrals/my-code ──────────────────────────────────────

router.get('/my-code', authenticate, requireRole('creator', 'owner', 'admin'), async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT creator_referral_code FROM users WHERE id = $1',
      [req.user.id]
    )
    const user = userResult.rows[0]
    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' })

    let code = user.creator_referral_code

    if (!code) {
      code = 'CRF-' + crypto.randomBytes(4).toString('hex').toUpperCase()
      await db.query(
        'UPDATE users SET creator_referral_code = $1 WHERE id = $2',
        [code, req.user.id]
      )
    }

    return res.json({
      referral_code: code,
      referral_url: `${BASE_URL}/register?ref=${code}`,
    })
  } catch (err) {
    console.error('creator referral my-code error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── POST /api/creator/referrals/use ─────────────────────────────────────────

router.post(
  '/use',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    body('code').notEmpty().isString(),
  ],
  validate,
  async (req, res) => {
    const { code } = req.body

    try {
      // Prevent self-referral
      const selfCheck = await db.query(
        'SELECT creator_referral_code FROM users WHERE id = $1',
        [req.user.id]
      )
      if (selfCheck.rows[0] && selfCheck.rows[0].creator_referral_code === code) {
        return res.status(400).json({ error: 'Nie możesz użyć własnego kodu polecającego' })
      }

      // Check if user already referred
      const alreadyReferred = await db.query(
        'SELECT id FROM creator_referrals WHERE invited_id = $1',
        [req.user.id]
      )
      if (alreadyReferred.rows[0]) {
        return res.status(409).json({ error: 'Już zostałeś polecony przez innego twórcę' })
      }

      // Find inviter
      const inviterResult = await db.query(
        'SELECT id, name, email FROM users WHERE creator_referral_code = $1',
        [code]
      )
      const inviter = inviterResult.rows[0]
      if (!inviter) {
        return res.status(404).json({ error: 'Nieprawidłowy kod polecający' })
      }

      await db.query(
        `INSERT INTO creator_referrals (id, inviter_id, invited_id, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [uuidv4(), inviter.id, req.user.id]
      )

      return res.json({
        success: true,
        inviter: { name: inviter.name, email: inviter.email },
      })
    } catch (err) {
      console.error('creator referral use error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

// ─── GET /api/creator/referrals/stats ────────────────────────────────────────

router.get('/stats', authenticate, requireRole('creator', 'owner', 'admin'), async (req, res) => {
  try {
    const [invitedResult, commissionsResult, pendingResult] = await Promise.all([
      db.query(
        'SELECT COUNT(*) FROM creator_referrals WHERE inviter_id = $1',
        [req.user.id]
      ),
      db.query(
        `SELECT COALESCE(SUM(commission_amount), 0) AS total_earned
         FROM referral_commissions
         WHERE inviter_id = $1 AND status IN ('confirmed', 'paid')`,
        [req.user.id]
      ),
      db.query(
        `SELECT COALESCE(SUM(commission_amount), 0) AS pending_earnings
         FROM referral_commissions
         WHERE inviter_id = $1 AND status = 'pending'`,
        [req.user.id]
      ),
    ])

    return res.json({
      invited_count:    parseInt(invitedResult.rows[0].count, 10),
      total_earned:     parseFloat(commissionsResult.rows[0].total_earned),
      pending_earnings: parseFloat(pendingResult.rows[0].pending_earnings),
    })
  } catch (err) {
    console.error('creator referral stats error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── GET /api/creator/referrals/list ─────────────────────────────────────────

router.get('/list', authenticate, requireRole('creator', 'owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cr.id, cr.created_at,
              u.id AS invited_user_id, u.name AS invited_name, u.email AS invited_email
       FROM creator_referrals cr
       JOIN users u ON u.id = cr.invited_id
       WHERE cr.inviter_id = $1
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    )

    return res.json({ referrals: result.rows })
  } catch (err) {
    console.error('creator referral list error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

module.exports = router
