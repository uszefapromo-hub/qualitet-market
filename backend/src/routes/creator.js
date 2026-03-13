'use strict';

/**
 * Creator / Partner module routes – mounted at /api/creator.
 *
 *   POST /api/creator/register          – register current user as a creator (updates role)
 *   GET  /api/creator/links             – list creator's affiliate links
 *   POST /api/creator/links             – generate a new affiliate link for a shop_product
 *   POST /api/creator/click             – record an affiliate link click
 *   GET  /api/creator/stats             – dashboard stats (clicks, conversions, balance)
 *   GET  /api/creator/commissions       – commission history
 *   GET  /api/creator/payouts           – payout / withdrawal history
 *   POST /api/creator/payouts           – request a new payout
 */

const crypto  = require('crypto');
const express = require('express');
const { body, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateCreatorCode() {
  return 'CR-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex').slice(0, 64);
}

// ─── POST /api/creator/register ───────────────────────────────────────────────
// Upgrade the authenticated user's role to 'creator' so they can generate
// affiliate links and earn commissions.

router.post('/register', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const userResult = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

    if (user.role === 'creator') {
      return res.status(409).json({ error: 'Użytkownik jest już twórcą' });
    }

    await db.query(
      'UPDATE users SET role = $1 WHERE id = $2',
      ['creator', userId]
    );

    return res.status(200).json({
      message: 'Konto twórcy aktywowane pomyślnie',
      user: { id: user.id, email: user.email, name: user.name, role: 'creator' },
    });
  } catch (err) {
    console.error('creator register error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/creator/links ────────────────────────────────────────────────────
// List all affiliate links belonging to the authenticated creator.

router.get(
  '/links',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    try {
      const [countResult, linksResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) FROM affiliate_links WHERE creator_id = $1',
          [req.user.id]
        ),
        db.query(
          `SELECT al.id, al.code, al.is_active, al.created_at,
                  p.name AS product_name, s.name AS store_name,
                  COUNT(DISTINCT ac.id)::int AS clicks
           FROM affiliate_links al
           LEFT JOIN products p ON p.id = al.product_id
           LEFT JOIN stores   s ON s.id = al.store_id
           LEFT JOIN affiliate_clicks ac ON ac.link_id = al.id
           WHERE al.creator_id = $1
           GROUP BY al.id, p.name, s.name
           ORDER BY al.created_at DESC
           LIMIT $2 OFFSET $3`,
          [req.user.id, limit, offset]
        ),
      ]);

      return res.json({
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        links: linksResult.rows,
      });
    } catch (err) {
      console.error('creator get links error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/creator/links ───────────────────────────────────────────────────
// Generate a new affiliate link for a shop_product (product within a store).

router.post(
  '/links',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    body('product_id').optional().isUUID(),
    body('store_id').optional().isUUID(),
  ],
  validate,
  async (req, res) => {
    const { product_id, store_id } = req.body;

    if (!product_id && !store_id) {
      return res.status(400).json({ error: 'Wymagane jest product_id lub store_id' });
    }

    try {
      // Verify affiliate is enabled for this product/store when product_id is set
      if (product_id && store_id) {
        const settingResult = await db.query(
          `SELECT is_affiliate_enabled FROM product_affiliate_settings
           WHERE product_id = $1 AND store_id = $2`,
          [product_id, store_id]
        );
        const setting = settingResult.rows[0];
        if (setting && !setting.is_affiliate_enabled) {
          return res.status(403).json({ error: 'Program partnerski dla tego produktu jest wyłączony' });
        }
      }

      const code = generateCreatorCode();
      const id   = uuidv4();

      await db.query(
        `INSERT INTO affiliate_links (id, creator_id, product_id, store_id, code, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW())`,
        [id, req.user.id, product_id || null, store_id || null, code]
      );

      return res.status(201).json({ id, code, product_id, store_id });
    } catch (err) {
      console.error('creator create link error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/creator/click ───────────────────────────────────────────────────
// Record a click on an affiliate link identified by its code.

router.post(
  '/click',
  [
    body('code').notEmpty().isString(),
  ],
  validate,
  async (req, res) => {
    const { code } = req.body;
    const ipHash   = hashIp(req.ip);
    const userAgent = req.headers['user-agent'] || '';
    const referrer  = req.headers['referer'] || '';

    try {
      const linkResult = await db.query(
        'SELECT id, is_active FROM affiliate_links WHERE code = $1',
        [code]
      );
      const link = linkResult.rows[0];
      if (!link || !link.is_active) {
        return res.status(404).json({ error: 'Nieznany lub nieaktywny link partnerski' });
      }

      await db.query(
        `INSERT INTO affiliate_clicks (id, link_id, ip_hash, user_agent, referrer, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), link.id, ipHash, userAgent, referrer]
      );

      return res.status(201).json({ recorded: true });
    } catch (err) {
      console.error('creator click error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/creator/stats ────────────────────────────────────────────────────
// Creator dashboard: aggregate stats for the authenticated creator.

router.get(
  '/stats',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  async (req, res) => {
    try {
      const creatorId = req.user.id;

      const [linksResult, clicksResult, convResult, balResult, withdrawnResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) FROM affiliate_links WHERE creator_id = $1 AND is_active = TRUE',
          [creatorId]
        ),
        db.query(
          `SELECT COUNT(*) FROM affiliate_clicks ac
           JOIN affiliate_links al ON al.id = ac.link_id
           WHERE al.creator_id = $1`,
          [creatorId]
        ),
        db.query(
          `SELECT COUNT(*) AS conversions,
                  COALESCE(SUM(commission_amount), 0) AS total_earned
           FROM affiliate_conversions
           WHERE creator_id = $1`,
          [creatorId]
        ),
        db.query(
          `SELECT COALESCE(SUM(commission_amount), 0) AS confirmed_balance
           FROM affiliate_conversions
           WHERE creator_id = $1 AND status = 'confirmed'`,
          [creatorId]
        ),
        db.query(
          `SELECT COALESCE(SUM(amount), 0) AS withdrawn
           FROM affiliate_withdrawals
           WHERE creator_id = $1 AND status IN ('pending', 'approved')`,
          [creatorId]
        ),
      ]);

      const confirmed   = parseFloat(balResult.rows[0].confirmed_balance);
      const withdrawn   = parseFloat(withdrawnResult.rows[0].withdrawn);
      const balance     = Math.max(0, confirmed - withdrawn);

      return res.json({
        active_links: parseInt(linksResult.rows[0].count, 10),
        total_clicks: parseInt(clicksResult.rows[0].count, 10),
        conversions:  parseInt(convResult.rows[0].conversions, 10),
        total_earned: parseFloat(convResult.rows[0].total_earned),
        balance,
      });
    } catch (err) {
      console.error('creator stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/creator/commissions ─────────────────────────────────────────────
// Paginated list of commissions (conversions) earned by the creator.

router.get(
  '/commissions',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    query('status').optional().isIn(['pending', 'confirmed', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const page         = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit        = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset       = (page - 1) * limit;
    const statusFilter = req.query.status || null;

    try {
      const conditions = ['aconv.creator_id = $1'];
      const params     = [req.user.id];

      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`aconv.status = $${params.length}`);
      }

      const where = conditions.join(' AND ');

      const [countResult, rowsResult] = await Promise.all([
        db.query(`SELECT COUNT(*) FROM affiliate_conversions aconv WHERE ${where}`, params),
        db.query(
          `SELECT aconv.id, aconv.order_amount, aconv.commission_amount,
                  aconv.status, aconv.created_at,
                  al.code AS link_code,
                  p.name  AS product_name
           FROM affiliate_conversions aconv
           JOIN affiliate_links al ON al.id = aconv.link_id
           LEFT JOIN products p ON p.id = al.product_id
           WHERE ${where}
           ORDER BY aconv.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        ),
      ]);

      return res.json({
        total:       parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        commissions: rowsResult.rows,
      });
    } catch (err) {
      console.error('creator commissions error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/creator/payouts ──────────────────────────────────────────────────
// Paginated list of withdrawal (payout) requests for the creator.

router.get(
  '/payouts',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    try {
      const [countResult, rowsResult] = await Promise.all([
        db.query(
          'SELECT COUNT(*) FROM affiliate_withdrawals WHERE creator_id = $1',
          [req.user.id]
        ),
        db.query(
          `SELECT id, amount, status, notes, created_at, processed_at
           FROM affiliate_withdrawals
           WHERE creator_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [req.user.id, limit, offset]
        ),
      ]);

      return res.json({
        total:   parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        payouts: rowsResult.rows,
      });
    } catch (err) {
      console.error('creator payouts error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/creator/payouts ─────────────────────────────────────────────────
// Request a new payout (withdrawal) of the creator's confirmed balance.

router.post(
  '/payouts',
  authenticate,
  requireRole('creator', 'owner', 'admin'),
  [
    body('amount').isFloat({ min: 0.01 }),
  ],
  validate,
  async (req, res) => {
    const { amount } = req.body;
    const creatorId  = req.user.id;

    try {
      // Calculate available balance
      const [earnedResult, withdrawnResult] = await Promise.all([
        db.query(
          `SELECT COALESCE(SUM(commission_amount), 0) AS confirmed_balance
           FROM affiliate_conversions
           WHERE creator_id = $1 AND status = 'confirmed'`,
          [creatorId]
        ),
        db.query(
          `SELECT COALESCE(SUM(amount), 0) AS withdrawn
           FROM affiliate_withdrawals
           WHERE creator_id = $1 AND status IN ('pending', 'approved')`,
          [creatorId]
        ),
      ]);

      const confirmed = parseFloat(earnedResult.rows[0].confirmed_balance);
      const withdrawn = parseFloat(withdrawnResult.rows[0].withdrawn);
      const balance   = Math.max(0, confirmed - withdrawn);

      if (parseFloat(amount) > balance) {
        return res.status(400).json({
          error: 'Kwota wypłaty przekracza dostępne saldo',
          balance,
        });
      }

      const id = uuidv4();
      await db.query(
        `INSERT INTO affiliate_withdrawals (id, creator_id, amount, status, created_at)
         VALUES ($1, $2, $3, 'pending', NOW())`,
        [id, creatorId, amount]
      );

      return res.status(201).json({ id, amount: parseFloat(amount), status: 'pending' });
    } catch (err) {
      console.error('creator payout request error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
