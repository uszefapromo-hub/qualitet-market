'use strict'

/**
 * User Profiles – mounted at /api/users/profile
 *
 *   GET  /api/users/profile  – get own profile
 *   PUT  /api/users/profile  – upsert own profile
 */

const express = require('express')
const { body } = require('express-validator')

const db = require('../config/database')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')

const router = express.Router()

// ─── GET /api/users/profile ───────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    )

    if (!result.rows[0]) {
      return res.json({ profile: { user_id: req.user.id } })
    }

    return res.json({ profile: result.rows[0] })
  } catch (err) {
    console.error('profile get error:', err.message)
    return res.status(500).json({ error: 'Błąd serwera' })
  }
})

// ─── PUT /api/users/profile ───────────────────────────────────────────────────

router.put(
  '/',
  authenticate,
  [
    body('bio').optional().isString().isLength({ max: 1000 }),
    body('avatar_url').optional().isURL(),
    body('website_url').optional().isURL(),
    body('facebook_url').optional().isURL(),
    body('instagram_url').optional().isURL(),
    body('tiktok_url').optional().isURL(),
    body('youtube_url').optional().isURL(),
  ],
  validate,
  async (req, res) => {
    const { bio, avatar_url, website_url, facebook_url, instagram_url, tiktok_url, youtube_url } = req.body

    try {
      const result = await db.query(
        `INSERT INTO user_profiles
           (user_id, bio, avatar_url, website_url, facebook_url, instagram_url, tiktok_url, youtube_url, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           bio           = EXCLUDED.bio,
           avatar_url    = EXCLUDED.avatar_url,
           website_url   = EXCLUDED.website_url,
           facebook_url  = EXCLUDED.facebook_url,
           instagram_url = EXCLUDED.instagram_url,
           tiktok_url    = EXCLUDED.tiktok_url,
           youtube_url   = EXCLUDED.youtube_url,
           updated_at    = NOW()
         RETURNING *`,
        [req.user.id, bio || null, avatar_url || null, website_url || null,
         facebook_url || null, instagram_url || null, tiktok_url || null, youtube_url || null]
      )

      return res.json({ profile: result.rows[0] })
    } catch (err) {
      console.error('profile update error:', err.message)
      return res.status(500).json({ error: 'Błąd serwera' })
    }
  }
)

module.exports = router
