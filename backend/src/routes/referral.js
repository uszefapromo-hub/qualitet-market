'use strict';

/**
 * Referral system routes.
 *
 * GET  /api/referral/my           – get (or auto-create) the authenticated user's referral code
 * GET  /api/admin/referrals       – admin: paginated list of all referral codes with stats
 * POST /api/referral/use          – record a referral use when a new user registers with a ref_code
 */

const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── GET /api/referral/my ─────────────────────────────────────────────────────
// Returns the referral code for the authenticated user.
// Creates one automatically if it does not exist yet.

router.get('/my', authenticate, async (req, res) => {
  try {
    let result = await db.query(
      `SELECT rc.id, rc.code, rc.user_id,
              COUNT(ru.id)::int AS total_referred,
              COALESCE(SUM(CASE WHEN ru.bonus_months > 0 THEN ru.bonus_months ELSE 0 END), 0)::int AS bonus_months_given
       FROM referral_codes rc
       LEFT JOIN referral_uses ru ON ru.referral_code_id = rc.id
       WHERE rc.user_id = $1
       GROUP BY rc.id`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Auto-create a referral code
      const code = _generateCode(req.user.id);
      const id = uuidv4();
      await db.query(
        `INSERT INTO referral_codes (id, user_id, code, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [id, req.user.id, code]
      );
      result = await db.query(
        `SELECT rc.id, rc.code, rc.user_id,
                0::int AS total_referred,
                0::int AS bonus_months_given
         FROM referral_codes rc
         WHERE rc.id = $1`,
        [id]
      );
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('referral my error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/referral/use ───────────────────────────────────────────────────
// Called internally during registration to record that a new user used a referral code.
// Can also be called explicitly with { ref_code, new_user_id, bonus_months }.

router.post(
  '/use',
  authenticate,
  [
    body('ref_code').trim().notEmpty(),
    body('new_user_id').isUUID(),
    body('bonus_months').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { ref_code, new_user_id, bonus_months = 0 } = req.body;
    try {
      const codeResult = await db.query(
        'SELECT id, user_id FROM referral_codes WHERE code = $1',
        [ref_code.toUpperCase()]
      );
      if (!codeResult.rows[0]) {
        return res.status(404).json({ error: 'Kod polecający nie istnieje' });
      }
      const { id: referral_code_id, user_id: referrer_id } = codeResult.rows[0];

      // Prevent self-referral
      if (referrer_id === new_user_id) {
        return res.status(400).json({ error: 'Nie można polecić samego siebie' });
      }

      // Prevent double-use by the same new user
      const existing = await db.query(
        'SELECT id FROM referral_uses WHERE new_user_id = $1',
        [new_user_id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Użytkownik już użył kodu polecającego' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO referral_uses (id, referral_code_id, referrer_id, new_user_id, bonus_months, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [id, referral_code_id, referrer_id, new_user_id, bonus_months]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('referral use error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/referrals ─────────────────────────────────────────────────
// Admin: paginated list of all referral codes with per-referrer stats.

router.get('/admin', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM referral_codes');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT rc.id, rc.code, rc.user_id,
              u.name AS referrer_name, u.email AS referrer_email,
              COUNT(ru.id)::int AS total_referred,
              COUNT(CASE WHEN s.status = 'active' THEN 1 END)::int AS active_stores,
              COALESCE(SUM(ru.bonus_months), 0)::int AS total_bonus_months,
              rc.created_at
       FROM referral_codes rc
       LEFT JOIN users u ON u.id = rc.user_id
       LEFT JOIN referral_uses ru ON ru.referral_code_id = rc.id
       LEFT JOIN stores st ON st.owner_id = ru.new_user_id
       LEFT JOIN subscriptions s ON s.shop_id = st.id AND s.status = 'active'
       GROUP BY rc.id, u.name, u.email
       ORDER BY total_referred DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ total, page, limit, referrals: result.rows });
  } catch (err) {
    console.error('admin referrals error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a short alphanumeric referral code derived from the user ID.
 * Format: QM-XXXXXX  (6 uppercase chars)
 */
function _generateCode(userId) {
  const raw = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const suffix = Date.now().toString(36).slice(-3).toUpperCase();
  return `QM-${raw}${suffix}`;
}

module.exports = router;
