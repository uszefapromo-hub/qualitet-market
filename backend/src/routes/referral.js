'use strict';

/**
 * Referral program routes.
 *
 * GET  /api/referral/my-code   – return (or create) the authenticated user's referral code
 * GET  /api/referral/stats     – stats for the authenticated user's referral activity
 * GET  /api/admin/referrals    – admin: full referral stats for all users (in admin.js)
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a short unique referral code from a user's id.
 * Format: 8 upper-case alphanumeric characters.
 */
function generateCode(userId) {
  // Use first 8 chars of uuid (without hyphens) uppercased
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Ensure a referral code exists for the given userId.
 * Returns the code string.
 */
async function ensureReferralCode(userId) {
  const existing = await db.query(
    'SELECT code FROM referral_codes WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].code;
  }

  // Generate a unique code; retry with increasing suffix length on collision
  let code = generateCode(userId);
  let attempts = 0;
  while (attempts < 5) {
    const collision = await db.query('SELECT id FROM referral_codes WHERE code = $1', [code]);
    if (collision.rows.length === 0) break;
    // Append random alphanumeric suffix (grows with each retry)
    const suffix = Math.random().toString(36).slice(2, 4 + attempts).toUpperCase();
    code = generateCode(userId).slice(0, 8 - suffix.length) + suffix;
    attempts++;
  }

  await db.query(
    'INSERT INTO referral_codes (id, user_id, code, created_at) VALUES ($1, $2, $3, NOW())',
    [uuidv4(), userId, code]
  );
  return code;
}

// ─── GET /api/referral/my-code ────────────────────────────────────────────────

router.get('/my-code', authenticate, async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user.id);
    const base = process.env.APP_URL || 'https://uszefaqualitetmarket.pl';
    return res.json({
      code,
      referral_link: `${base}/register?ref=${code}`,
    });
  } catch (err) {
    console.error('referral my-code error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/referral/stats ──────────────────────────────────────────────────

router.get('/stats', authenticate, async (req, res) => {
  try {
    const code = await ensureReferralCode(req.user.id);

    const usesResult = await db.query(
      `SELECT ru.new_user_id, ru.bonus_days, ru.created_at,
              u.name AS new_user_name, u.email AS new_user_email,
              s.status AS store_status
         FROM referral_uses ru
         JOIN users u  ON u.id  = ru.new_user_id
    LEFT JOIN stores s ON s.owner_id = ru.new_user_id AND s.status = 'active'
        WHERE ru.referrer_id = $1
        ORDER BY ru.created_at DESC`,
      [req.user.id]
    );

    const totalReferred = usesResult.rows.length;
    const activeStores  = usesResult.rows.filter((r) => r.store_status === 'active').length;
    const totalBonusDays = usesResult.rows.reduce((s, r) => s + (r.bonus_days || 0), 0);

    return res.json({
      code,
      referral_link: `${process.env.APP_URL || 'https://uszefaqualitetmarket.pl'}/register?ref=${code}`,
      total_referred: totalReferred,
      active_stores: activeStores,
      total_bonus_days: totalBonusDays,
      referred_users: usesResult.rows.map((r) => ({
        user_id:   r.new_user_id,
        name:      r.new_user_name,
        email:     r.new_user_email,
        bonus_days: r.bonus_days,
        joined_at: r.created_at,
        has_active_store: r.store_status === 'active',
      })),
    });
  } catch (err) {
    console.error('referral stats error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = { router, ensureReferralCode };
