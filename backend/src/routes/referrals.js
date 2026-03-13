'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const VALID_DISCOUNT_TYPES = ['none', 'percent', 'fixed'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ─── User Referral System constants ───────────────────────────────────────────

// Percentage of invited user's order commission credited to the inviter
const USER_REFERRAL_REWARD_RATE = 0.02; // 2 %
const BASE_URL = process.env.FRONTEND_URL || 'https://uszefaqualitet.pl';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Generate a URL-safe user referral code using unbiased rejection sampling. */
function generateUserReferralCode() {
  const MAX_VALID = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let code = 'USR-';
  while (code.length < 12) { // 'USR-' + 8 chars
    const byte = crypto.randomBytes(1)[0];
    if (byte < MAX_VALID) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

/** Generate a random alphanumeric referral code of given length. */
function generateCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

// ─── POST /api/referrals/generate – generate or return user's invite link ─────
// Any authenticated user may call this to get their personal referral link.
// The code is persisted in users.user_referral_code; subsequent calls return
// the same code.

router.post(
  '/generate',
  authenticate,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const userResult = await db.query(
        'SELECT user_referral_code FROM users WHERE id = $1',
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

      let code = user.user_referral_code;

      if (!code) {
        // Generate a collision-free code (up to 10 attempts)
        let attempts = 0;
        while (!code && attempts < 10) {
          const candidate = generateUserReferralCode();
          const existsResult = await db.query(
            'SELECT id FROM users WHERE user_referral_code = $1',
            [candidate]
          );
          if (existsResult.rows.length === 0) code = candidate;
          attempts++;
        }

        if (!code) {
          return res.status(500).json({ error: 'Nie można wygenerować kodu polecającego' });
        }

        await db.query(
          'UPDATE users SET user_referral_code = $1 WHERE id = $2',
          [code, userId]
        );
      }

      return res.status(200).json({
        code,
        link: `${BASE_URL}/invite/${code}`,
      });
    } catch (err) {
      console.error('user referral generate error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/referrals/stats – user referral stats ───────────────────────────
// Returns the authenticated user's referral summary:
//   invited_count     – total users invited
//   total_earnings    – total rewards earned from invited users' activity
//   referral_code     – user's own invite code (null if not yet generated)
//   referral_link     – full invite URL

router.get(
  '/stats',
  authenticate,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const [invitedResult, earningsResult, userResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) AS total FROM user_referrals WHERE inviter_id = $1',
          [userId]
        ),
        db.query(
          `SELECT COALESCE(SUM(amount), 0) AS total_earnings
           FROM referral_rewards
           WHERE inviter_id = $1`,
          [userId]
        ),
        db.query(
          'SELECT user_referral_code FROM users WHERE id = $1',
          [userId]
        ),
      ]);

      const code = userResult.rows[0]?.user_referral_code || null;

      return res.json({
        invited_count:  parseInt(invitedResult.rows[0].total, 10),
        total_earnings: parseFloat(earningsResult.rows[0].total_earnings),
        referral_code:  code,
        referral_link:  code ? `${BASE_URL}/invite/${code}` : null,
      });
    } catch (err) {
      console.error('user referral stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/referrals/invites – paginated list of invited users ──────────────
// Returns users who registered via the authenticated user's referral link.

router.get(
  '/invites',
  authenticate,
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
          'SELECT COUNT(*) FROM user_referrals WHERE inviter_id = $1',
          [inviterId]
        ),
        db.query(
          `SELECT ur.id, ur.created_at,
                  u.id AS invited_id, u.name AS invited_name, u.email AS invited_email,
                  COALESCE(
                    (SELECT SUM(rr.amount) FROM referral_rewards rr
                     WHERE rr.inviter_id = $1 AND rr.invited_id = u.id), 0
                  ) AS earned_from_user
           FROM user_referrals ur
           JOIN users u ON u.id = ur.invited_id
           WHERE ur.inviter_id = $1
           ORDER BY ur.created_at DESC
           LIMIT $2 OFFSET $3`,
          [inviterId, limit, offset]
        ),
      ]);

      return res.json({
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        users: rowsResult.rows,
      });
    } catch (err) {
      console.error('user referral invites error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/referrals – list own referral codes ─────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const isAdmin = ['owner', 'admin'].includes(req.user.role);
  try {
    const result = isAdmin
      ? await db.query(
          `SELECT rc.*, u.email AS owner_email
           FROM referral_codes rc
           JOIN users u ON rc.owner_id = u.id
           ORDER BY rc.created_at DESC`
        )
      : await db.query(
          `SELECT rc.*
           FROM referral_codes rc
           WHERE rc.owner_id = $1
           ORDER BY rc.created_at DESC`,
          [req.user.id]
        );
    return res.json(result.rows);
  } catch (err) {
    console.error('list referral codes error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/referrals/:id – get single referral code ────────────────────────

router.get(
  '/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM referral_codes WHERE id = $1',
        [req.params.id]
      );
      const code = result.rows[0];
      if (!code) return res.status(404).json({ error: 'Kod polecający nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && code.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }
      return res.json(code);
    } catch (err) {
      console.error('get referral code error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/referrals/:id/uses – list redemptions for a code ────────────────

router.get(
  '/:id/uses',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const codeResult = await db.query(
        'SELECT owner_id FROM referral_codes WHERE id = $1',
        [req.params.id]
      );
      if (!codeResult.rows[0]) {
        return res.status(404).json({ error: 'Kod polecający nie znaleziony' });
      }

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && codeResult.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      const result = await db.query(
        `SELECT ru.*, u.email AS user_email
         FROM referral_uses ru
         LEFT JOIN users u ON ru.used_by_user_id = u.id
         WHERE ru.code_id = $1
         ORDER BY ru.used_at DESC`,
        [req.params.id]
      );
      return res.json(result.rows);
    } catch (err) {
      console.error('list referral uses error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/referrals – create referral code ───────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('store_id').optional().isUUID(),
    body('code').optional().trim().isLength({ min: 3, max: 40 })
      .matches(/^[A-Za-z0-9_-]+$/),
    body('description').optional().trim(),
    body('discount_type').optional().isIn(VALID_DISCOUNT_TYPES),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('max_uses').optional().isInt({ min: 1 }),
    body('expires_at').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const {
      store_id = null,
      description = null,
      discount_type = 'none',
      discount_value = 0,
      max_uses = null,
      expires_at = null,
    } = req.body;

    // Use the supplied code or auto-generate one
    let code = req.body.code ? req.body.code.toUpperCase() : generateCode();

    try {
      // Verify store ownership when store_id is provided
      if (store_id) {
        const storeResult = await db.query(
          'SELECT owner_id FROM stores WHERE id = $1',
          [store_id]
        );
        const store = storeResult.rows[0];
        if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

        const isAdmin = ['owner', 'admin'].includes(req.user.role);
        if (!isAdmin && store.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
        }
      }

      // Ensure code uniqueness – regenerate once on collision
      const existing = await db.query(
        'SELECT id FROM referral_codes WHERE code = $1',
        [code]
      );
      if (existing.rows.length > 0) {
        code = generateCode(10);
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO referral_codes
           (id, owner_id, store_id, code, description,
            discount_type, discount_value, max_uses, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         RETURNING *`,
        [id, req.user.id, store_id, code, description,
         discount_type, discount_value, max_uses, expires_at || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Kod już istnieje' });
      }
      console.error('create referral code error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/referrals/:id – update referral code ─────────────────────────

router.patch(
  '/:id',
  authenticate,
  [
    param('id').isUUID(),
    body('description').optional().trim(),
    body('discount_type').optional().isIn(VALID_DISCOUNT_TYPES),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('max_uses').optional().isInt({ min: 1 }),
    body('expires_at').optional().isISO8601(),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { description, discount_type, discount_value, max_uses, expires_at, active } = req.body;

    try {
      const existing = await db.query(
        'SELECT owner_id FROM referral_codes WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) {
        return res.status(404).json({ error: 'Kod polecający nie znaleziony' });
      }

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && existing.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      const result = await db.query(
        `UPDATE referral_codes SET
           description    = COALESCE($1, description),
           discount_type  = COALESCE($2, discount_type),
           discount_value = COALESCE($3, discount_value),
           max_uses       = COALESCE($4, max_uses),
           expires_at     = COALESCE($5, expires_at),
           active         = COALESCE($6, active),
           updated_at     = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          description !== undefined ? description : null,
          discount_type || null,
          discount_value !== undefined ? discount_value : null,
          max_uses !== undefined ? max_uses : null,
          expires_at !== undefined ? expires_at : null,
          active !== undefined ? active : null,
          req.params.id,
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update referral code error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/referrals/:id – deactivate referral code ────────────────────

router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const existing = await db.query(
        'SELECT owner_id FROM referral_codes WHERE id = $1',
        [req.params.id]
      );
      if (!existing.rows[0]) {
        return res.status(404).json({ error: 'Kod polecający nie znaleziony' });
      }

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && existing.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      await db.query(
        'UPDATE referral_codes SET active = FALSE, updated_at = NOW() WHERE id = $1',
        [req.params.id]
      );
      return res.status(204).end();
    } catch (err) {
      console.error('delete referral code error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/referrals/redeem – redeem a code during checkout ───────────────
// Called from the order creation flow to validate and record a redemption.

router.post(
  '/redeem',
  authenticate,
  [
    body('code').trim().notEmpty(),
    body('order_id').optional().isUUID(),
  ],
  validate,
  async (req, res) => {
    const { code, order_id = null } = req.body;

    try {
      const result = await db.query(
        `SELECT * FROM referral_codes
         WHERE code = $1
           AND active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
           AND (max_uses IS NULL OR uses_count < max_uses)`,
        [code.toUpperCase()]
      );
      const rc = result.rows[0];
      if (!rc) {
        return res.status(404).json({ error: 'Kod polecający nieważny lub wygasł' });
      }

      // Prevent self-referral
      if (rc.owner_id === req.user.id) {
        return res.status(422).json({ error: 'Nie możesz użyć własnego kodu polecającego' });
      }

      const useId = uuidv4();
      await db.query(
        `INSERT INTO referral_uses (id, code_id, used_by_user_id, order_id, reward_amount, used_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [useId, rc.id, req.user.id, order_id, 0]
      );

      // Increment uses counter
      await db.query(
        'UPDATE referral_codes SET uses_count = uses_count + 1, updated_at = NOW() WHERE id = $1',
        [rc.id]
      );

      return res.json({
        ok: true,
        code: rc.code,
        discount_type: rc.discount_type,
        discount_value: parseFloat(rc.discount_value),
        use_id: useId,
      });
    } catch (err) {
      console.error('redeem referral code error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
