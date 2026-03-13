'use strict';

/**
 * Creator Referral System – mounted at /api/creator/referrals.
 *
 *   POST /api/creator/referrals/generate-link  – generate (or return existing) creator referral code
 *   GET  /api/creator/referrals                – list creators invited by the authenticated creator
 *   GET  /api/creator/referrals/stats          – referral stats (invited count, active count, earnings, link)
 */

const crypto  = require('crypto');
const express = require('express');
const { query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// 2 % commission rate applied to invited creators' confirmed affiliate sales
const REFERRAL_COMMISSION_RATE = 0.02;

// Base URL for building invite links
const BASE_URL = process.env.FRONTEND_URL || 'https://uszefaqualitet.pl';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Generates a URL-safe unique code using an unambiguous character set.
// Rejection sampling ensures each character is picked without bias.
function generateReferralCode() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const MAX_VALID = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let code = 'REF-';
  while (code.length < 12) { // 'REF-' + 8 chars
    const byte = crypto.randomBytes(1)[0];
    if (byte < MAX_VALID) code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

// ─── POST /generate-link ──────────────────────────────────────────────────────
// Returns the creator's unique referral code (and full invite URL).
// Generates and persists a new code on first call.

router.post(
  '/generate-link',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  async (req, res) => {
    const creatorId = req.user.id;

    try {
      const userResult = await db.query(
        'SELECT creator_referral_code FROM users WHERE id = $1',
        [creatorId]
      );
      const user = userResult.rows[0];
      if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

      let code = user.creator_referral_code;

      if (!code) {
        // Generate a collision-free code (up to 10 attempts)
        let attempts = 0;
        while (!code && attempts < 10) {
          const candidate = generateReferralCode();
          const existsResult = await db.query(
            'SELECT id FROM users WHERE creator_referral_code = $1',
            [candidate]
          );
          if (existsResult.rows.length === 0) code = candidate;
          attempts++;
        }

        if (!code) {
          return res.status(500).json({ error: 'Nie można wygenerować kodu polecającego' });
        }

        await db.query(
          'UPDATE users SET creator_referral_code = $1 WHERE id = $2',
          [code, creatorId]
        );
      }

      const baseUrl = BASE_URL;
      return res.status(200).json({
        code,
        link: `${baseUrl}/invite/${code}`,
      });
    } catch (err) {
      console.error('creator referral generate-link error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET / ─────────────────────────────────────────────────────────────────────
// Paginated list of creators invited by the authenticated creator.

router.get(
  '/',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const page      = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit     = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset    = (page - 1) * limit;
    const inviterId = req.user.id;

    try {
      const [countResult, rowsResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) FROM creator_referrals WHERE inviter_id = $1',
          [inviterId]
        ),
        db.query(
          `SELECT cr.id, cr.created_at,
                  u.id AS invited_id, u.name AS invited_name, u.email AS invited_email,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM affiliate_conversions ac
                    JOIN affiliate_links al ON al.id = ac.link_id
                    WHERE al.creator_id = u.id AND ac.status = 'confirmed'
                  ) THEN true ELSE false END AS is_active
           FROM creator_referrals cr
           JOIN users u ON u.id = cr.invited_id
           WHERE cr.inviter_id = $1
           ORDER BY cr.created_at DESC
           LIMIT $2 OFFSET $3`,
          [inviterId, limit, offset]
        ),
      ]);

      return res.json({
        total:    parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        creators: rowsResult.rows,
      });
    } catch (err) {
      console.error('creator referrals list error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /stats ────────────────────────────────────────────────────────────────
// Aggregate referral stats for the authenticated creator:
//   invited_count     – total creators invited
//   active_count      – invited creators with ≥1 confirmed affiliate conversion
//   referral_earnings – 2 % of invited creators' confirmed affiliate commissions
//   referral_code     – the creator's own referral code (null if not yet generated)
//   referral_link     – full invite URL

router.get(
  '/stats',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  async (req, res) => {
    const inviterId = req.user.id;

    try {
      const [invitedResult, activeResult, earningsResult, userResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) AS total FROM creator_referrals WHERE inviter_id = $1',
          [inviterId]
        ),
        db.query(
          `SELECT COUNT(DISTINCT cr.invited_id) AS active
           FROM creator_referrals cr
           WHERE cr.inviter_id = $1
             AND EXISTS (
               SELECT 1 FROM affiliate_conversions ac
               JOIN affiliate_links al ON al.id = ac.link_id
               WHERE al.creator_id = cr.invited_id AND ac.status = 'confirmed'
             )`,
          [inviterId]
        ),
        db.query(
          `SELECT COALESCE(
             SUM(ac.commission_amount * $2), 0
           ) AS referral_earnings
           FROM affiliate_conversions ac
           JOIN affiliate_links al ON al.id = ac.link_id
           JOIN creator_referrals cr ON cr.invited_id = al.creator_id
           WHERE cr.inviter_id = $1 AND ac.status = 'confirmed'`,
          [inviterId, REFERRAL_COMMISSION_RATE]
        ),
        db.query(
          'SELECT creator_referral_code FROM users WHERE id = $1',
          [inviterId]
        ),
      ]);

      const code    = userResult.rows[0]?.creator_referral_code || null;

      return res.json({
        invited_count:     parseInt(invitedResult.rows[0].total, 10),
        active_count:      parseInt(activeResult.rows[0].active, 10),
        referral_earnings: parseFloat(earningsResult.rows[0].referral_earnings),
        referral_code:     code,
        referral_link:     code ? `${BASE_URL}/invite/${code}` : null,
      });
    } catch (err) {
      console.error('creator referrals stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
