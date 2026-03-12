'use strict';

/**
 * Auth routes – short canonical aliases used by the onboarding flow.
 *
 * POST /api/auth/register  – create a new account (default role: seller)
 * POST /api/auth/login     – obtain a JWT
 * GET  /api/auth/me        – return the authenticated user's profile
 * PUT  /api/auth/me        – update the authenticated user's profile
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, signToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { PLAN_CONFIG } = require('./subscriptions');
const { nameToSlug, uniqueSlug } = require('../helpers/slug');
const { ensureReferralCode } = require('./referral');

const router = express.Router();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ─── Promotional tier configuration ──────────────────────────────────────────
// Registrations  1-10 → 12 months gratis (tier 1)
// Registrations 11-20 →  6 months gratis (tier 2)
// Registrations 21-30 →  3 months gratis (tier 3)
// Registrations  > 30 → standard 14-day trial (tier 0)
const PROMO_TIERS = [
  { maxCount: 10,  durationDays: 365, tier: 1, label: '12 miesięcy gratis' },
  { maxCount: 20,  durationDays: 180, tier: 2, label: '6 miesięcy gratis' },
  { maxCount: 30,  durationDays: 90,  tier: 3, label: '3 miesiące gratis' },
];

/**
 * Determine the promotional subscription duration for a new seller.
 * @param {number} sellerCount – number of sellers already in the DB (before this registration)
 * @returns {{ durationDays: number, tier: number, label: string }}
 */
function getPromoTier(sellerCount) {
  for (const pt of PROMO_TIERS) {
    if (sellerCount < pt.maxCount) {
      return pt;
    }
  }
  // Beyond the promo window – use the standard trial duration
  return { durationDays: PLAN_CONFIG['trial'].duration_days, tier: 0, label: 'Trial 14 dni' };
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
    body('role').optional().isIn(['seller', 'buyer']),
    body('ref').optional().trim(),
  ],
  validate,
  async (req, res) => {
    // Default role for new sign-ups through this endpoint is 'seller'
    const { email, password, name, role = 'seller', ref } = req.body;
    // Normalize referral code once
    const normalizedRef = ref ? ref.toUpperCase() : null;
    try {
      const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Użytkownik z tym e-mailem już istnieje' });
      }

      // ── Determine promotional subscription tier ────────────────────────────
      // Count existing sellers to determine which promo tier applies
      const sellerCountResult = await db.query(`SELECT COUNT(*) FROM users WHERE role = 'seller'`);
      const sellerCount = parseInt(sellerCountResult.rows[0].count, 10);
      const promo = getPromoTier(sellerCount);

      // Validate referral code (if provided)
      let referrerUser = null;
      if (normalizedRef) {
        const refRow = await db.query(
          'SELECT rc.user_id FROM referral_codes rc WHERE rc.code = $1',
          [normalizedRef]
        );
        if (refRow.rows.length > 0) {
          referrerUser = refRow.rows[0];
        }
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const id = uuidv4();
      const trialEndsAt = new Date(Date.now() + promo.durationDays * MS_PER_DAY);

      await db.query(
        `INSERT INTO users (id, email, password_hash, name, role, plan, trial_ends_at, promo_tier, referred_by_code, created_at)
         VALUES ($1, $2, $3, $4, $5, 'trial', $6, $7, $8, NOW())`,
        [id, email, passwordHash, name, role, trialEndsAt, promo.tier, normalizedRef]
      );

      // ── Auto-create shop for sellers ──────────────────────────────────────
      let shop = null;
      if (role === 'seller' || role === 'owner') {
        const shopId   = uuidv4();
        const shopName = name;
        const slug     = await uniqueSlug(nameToSlug(shopName));
        const subdomain = `${slug}.qualitetmarket.pl`;

        const shopResult = await db.query(
          `INSERT INTO stores (id, owner_id, name, slug, subdomain, margin, plan, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 30, 'trial', 'active', NOW())
           RETURNING *`,
          [shopId, id, shopName, slug, subdomain]
        );
        shop = shopResult.rows[0];

        // Auto-create subscription for the new shop using promo duration
        const trialConfig = PLAN_CONFIG['trial'];
        const subExpiresAt = new Date(Date.now() + promo.durationDays * MS_PER_DAY);
        await db.query(
          `INSERT INTO subscriptions
             (id, shop_id, plan, status, product_limit, commission_rate, started_at, expires_at, created_at)
           VALUES ($1, $2, 'trial', 'active', $3, $4, NOW(), $5, NOW())`,
          [uuidv4(), shopId, trialConfig.product_limit, trialConfig.commission_rate, subExpiresAt]
        );
      }

      // ── Create referral code for the new user ──────────────────────────────
      await ensureReferralCode(id);

      // ── Record referral use and grant bonus to referrer ───────────────────
      if (referrerUser) {
        const REFERRAL_BONUS_DAYS = 30;
        await db.query(
          `INSERT INTO referral_uses (id, code, referrer_id, new_user_id, bonus_days, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [uuidv4(), normalizedRef, referrerUser.user_id, id, REFERRAL_BONUS_DAYS]
        );

        // Extend referrer's active shop subscription by bonus_days
        await db.query(
          `UPDATE subscriptions
              SET expires_at  = COALESCE(expires_at, NOW()) + ($1 || ' days')::INTERVAL,
                  updated_at  = NOW()
            WHERE shop_id IN (SELECT id FROM stores WHERE owner_id = $2)
              AND status = 'active'`,
          [REFERRAL_BONUS_DAYS, referrerUser.user_id]
        );
      }

      const token = signToken({ id, email, role });
      return res.status(201).json({
        token,
        user: { id, email, name, role, plan: 'trial', promo_tier: promo.tier, promo_label: promo.label },
        shop,
        promo: { tier: promo.tier, duration_days: promo.durationDays, label: promo.label },
      });
    } catch (err) {
      console.error('auth register error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
// Accepts either { email, password } or { phone, password }.

router.post(
  '/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().isMobilePhone(),
    body('password').notEmpty(),
    body().custom((_, { req }) => {
      if (!req.body.email && !req.body.phone) {
        throw new Error('Podaj e-mail lub numer telefonu');
      }
      return true;
    }),
  ],
  validate,
  async (req, res) => {
    const { email, phone, password } = req.body;
    try {
      let result;
      if (email) {
        result = await db.query(
          'SELECT id, email, password_hash, name, role, plan, trial_ends_at FROM users WHERE email = $1',
          [email]
        );
      } else {
        result = await db.query(
          'SELECT id, email, password_hash, name, role, plan, trial_ends_at FROM users WHERE phone = $1',
          [phone]
        );
      }
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ error: 'Nieprawidłowy e-mail/telefon lub hasło' });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Nieprawidłowy e-mail/telefon lub hasło' });
      }

      const token = signToken({ id: user.id, email: user.email, role: user.role });
      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          trialEndsAt: user.trial_ends_at,
        },
      });
    } catch (err) {
      console.error('auth login error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, name, role, plan, trial_ends_at, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('auth me error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PUT /api/auth/me ─────────────────────────────────────────────────────────

router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional().isMobilePhone(),
  ],
  validate,
  async (req, res) => {
    const { name, phone } = req.body;
    try {
      const result = await db.query(
        `UPDATE users SET
           name       = COALESCE($1, name),
           phone      = COALESCE($2, phone),
           updated_at = NOW()
         WHERE id = $3
         RETURNING id, email, name, phone, role, plan`,
        [name || null, phone || null, req.user.id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('auth update me error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
