'use strict';

/**
 * Affiliate Creator System routes.
 *
 * Creator endpoints:
 *   GET  /api/affiliate/dashboard             – creator stats (clicks, conversions, balance)
 *   GET  /api/affiliate/links                 – list my affiliate links
 *   POST /api/affiliate/links                 – create an affiliate link for a product/store
 *   DELETE /api/affiliate/links/:id           – remove an affiliate link
 *   GET  /api/affiliate/earnings              – conversion & commission history
 *   GET  /api/affiliate/balance               – current withdrawable balance
 *   POST /api/affiliate/withdraw              – request a payout
 *   GET  /api/affiliate/products              – browse products open for affiliation
 *
 * Seller endpoints:
 *   GET  /api/affiliate/seller/settings       – list affiliate settings for seller's products
 *   PUT  /api/affiliate/seller/products/:pid  – set commission % and enable/disable for a product
 *   GET  /api/affiliate/seller/creators       – top creators promoting seller's products
 *   GET  /api/affiliate/seller/stats          – affiliate sales stats for seller
 *
 * Public endpoints:
 *   GET  /api/affiliate/click/:code           – record click, redirect to product (anti-fraud)
 *
 * Admin endpoints:
 *   GET  /api/affiliate/admin/withdrawals     – list all withdrawal requests
 *   PATCH /api/affiliate/admin/withdrawals/:id – approve or reject a withdrawal
 *   GET  /api/affiliate/admin/stats           – platform-wide affiliate overview
 */

const crypto  = require('crypto');
const express = require('express');
const { body, param, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../helpers/pagination');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateAffiliateCode() {
  return 'AFF-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function hashIp(ip) {
  return crypto.createHash('sha256').update(ip || '').digest('hex').slice(0, 64);
}

// ─── GET /api/affiliate/dashboard ────────────────────────────────────────────
// Creator dashboard: clicks, conversions, total earned, pending balance

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const creatorId = req.user.id;

    const [linksResult, clicksResult, convResult, balResult] = await Promise.all([
      db.query('SELECT COUNT(*) FROM affiliate_links WHERE creator_id = $1 AND is_active = TRUE', [creatorId]),
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
    ]);

    const withdrawn = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS withdrawn
       FROM affiliate_withdrawals
       WHERE creator_id = $1 AND status = 'approved'`,
      [creatorId]
    );

    const confirmed  = parseFloat(balResult.rows[0].confirmed_balance);
    const withdrawnAmt = parseFloat(withdrawn.rows[0].withdrawn);
    const balance    = Math.max(0, confirmed - withdrawnAmt);

    return res.json({
      active_links:  parseInt(linksResult.rows[0].count, 10),
      total_clicks:  parseInt(clicksResult.rows[0].count, 10),
      conversions:   parseInt(convResult.rows[0].conversions, 10),
      total_earned:  parseFloat(convResult.rows[0].total_earned),
      balance,
    });
  } catch (err) {
    console.error('affiliate dashboard error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/affiliate/links ─────────────────────────────────────────────────
// List all affiliate links for the authenticated creator

router.get('/links', authenticate, async (req, res) => {
  const { page, limit, offset } = parsePagination(req);

  try {
    const total = await db.query(
      'SELECT COUNT(*) FROM affiliate_links WHERE creator_id = $1',
      [req.user.id]
    );
    const result = await db.query(
      `SELECT al.id, al.code, al.product_id, al.store_id, al.is_active, al.created_at,
              p.name AS product_name, p.price_gross AS product_price,
              s.name AS store_name,
              COUNT(DISTINCT ac.id)::int AS clicks,
              COUNT(DISTINCT aconv.id)::int AS conversions
       FROM affiliate_links al
       LEFT JOIN products p   ON p.id = al.product_id
       LEFT JOIN stores   s   ON s.id = al.store_id
       LEFT JOIN affiliate_clicks ac       ON ac.link_id = al.id
       LEFT JOIN affiliate_conversions aconv ON aconv.link_id = al.id
       WHERE al.creator_id = $1
       GROUP BY al.id, p.name, p.price_gross, s.name
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return res.json({
      total: parseInt(total.rows[0].count, 10),
      page,
      limit,
      links: result.rows,
    });
  } catch (err) {
    console.error('affiliate links error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/affiliate/links ────────────────────────────────────────────────
// Create a new affiliate link for a product (optionally scoped to a store)

router.post(
  '/links',
  authenticate,
  [
    body('product_id').isUUID().withMessage('product_id must be a valid UUID'),
    body('store_id').optional({ nullable: true }).isUUID(),
  ],
  validate,
  async (req, res) => {
    const { product_id, store_id = null } = req.body;
    const creatorId = req.user.id;

    try {
      // Verify product exists and affiliation is enabled (if store_id given)
      const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [product_id]);
      if (!productCheck.rows[0]) {
        return res.status(404).json({ error: 'Produkt nie istnieje' });
      }

      if (store_id) {
        const settingsCheck = await db.query(
          `SELECT is_affiliate_enabled FROM product_affiliate_settings
           WHERE product_id = $1 AND store_id = $2`,
          [product_id, store_id]
        );
        if (settingsCheck.rows[0] && !settingsCheck.rows[0].is_affiliate_enabled) {
          return res.status(403).json({ error: 'Afiliacja dla tego produktu jest wyłączona' });
        }
      }

      // Prevent duplicates
      const existing = await db.query(
        'SELECT id, code FROM affiliate_links WHERE creator_id = $1 AND product_id = $2 AND (store_id = $3 OR ($3::uuid IS NULL AND store_id IS NULL))',
        [creatorId, product_id, store_id]
      );
      if (existing.rows[0]) {
        return res.status(409).json({ error: 'Link afiliacyjny dla tego produktu już istnieje', link: existing.rows[0] });
      }

      const id   = uuidv4();
      const code = generateAffiliateCode();
      const result = await db.query(
        `INSERT INTO affiliate_links (id, creator_id, product_id, store_id, code, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
         RETURNING *`,
        [id, creatorId, product_id, store_id, code]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create affiliate link error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/affiliate/links/:id ─────────────────────────────────────────
// Deactivate (soft-delete) an affiliate link owned by the caller

router.delete(
  '/links/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE affiliate_links SET is_active = FALSE
         WHERE id = $1 AND creator_id = $2
         RETURNING id`,
        [req.params.id, req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Link nie istnieje lub nie masz do niego dostępu' });
      }
      return res.json({ success: true });
    } catch (err) {
      console.error('delete affiliate link error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/earnings ──────────────────────────────────────────────
// Paginated list of conversions (earnings) for the creator

router.get('/earnings', authenticate, async (req, res) => {
  const { page, limit, offset } = parsePagination(req);

  try {
    const total = await db.query(
      'SELECT COUNT(*) FROM affiliate_conversions WHERE creator_id = $1',
      [req.user.id]
    );
    const result = await db.query(
      `SELECT ac.id, ac.order_id, ac.order_amount, ac.commission_amount, ac.status, ac.created_at,
              al.code AS link_code, p.name AS product_name
       FROM affiliate_conversions ac
       JOIN affiliate_links al ON al.id = ac.link_id
       LEFT JOIN products p ON p.id = al.product_id
       WHERE ac.creator_id = $1
       ORDER BY ac.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return res.json({
      total: parseInt(total.rows[0].count, 10),
      page,
      limit,
      earnings: result.rows,
    });
  } catch (err) {
    console.error('affiliate earnings error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/affiliate/balance ───────────────────────────────────────────────
// Returns the creator's current withdrawable balance

router.get('/balance', authenticate, async (req, res) => {
  try {
    const confirmed = await db.query(
      `SELECT COALESCE(SUM(commission_amount), 0) AS total
       FROM affiliate_conversions WHERE creator_id = $1 AND status = 'confirmed'`,
      [req.user.id]
    );
    const withdrawn = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM affiliate_withdrawals WHERE creator_id = $1 AND status = 'approved'`,
      [req.user.id]
    );
    const balance = Math.max(0, parseFloat(confirmed.rows[0].total) - parseFloat(withdrawn.rows[0].total));
    return res.json({ balance });
  } catch (err) {
    console.error('affiliate balance error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/affiliate/withdraw ─────────────────────────────────────────────
// Creator requests a payout of their confirmed commission balance

router.post(
  '/withdraw',
  authenticate,
  [body('amount').isFloat({ min: 1 }).withMessage('Kwota musi być większa od 0')],
  validate,
  async (req, res) => {
    const amount = parseFloat(req.body.amount);
    const creatorId = req.user.id;

    try {
      // Calculate available balance
      const confirmed = await db.query(
        `SELECT COALESCE(SUM(commission_amount), 0) AS total
         FROM affiliate_conversions WHERE creator_id = $1 AND status = 'confirmed'`,
        [creatorId]
      );
      const withdrawn = await db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM affiliate_withdrawals WHERE creator_id = $1 AND status IN ('pending', 'approved')`,
        [creatorId]
      );
      const balance = Math.max(0, parseFloat(confirmed.rows[0].total) - parseFloat(withdrawn.rows[0].total));

      if (amount > balance) {
        return res.status(400).json({ error: 'Niewystarczające saldo do wypłaty', balance });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO affiliate_withdrawals (id, creator_id, amount, status, created_at)
         VALUES ($1, $2, $3, 'pending', NOW())
         RETURNING *`,
        [id, creatorId, amount]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('affiliate withdraw error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/products ──────────────────────────────────────────────
// Browse products that have affiliate enabled; shows commission rates

router.get(
  '/products',
  authenticate,
  [
    query('store_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('page').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { page, limit, offset } = parsePagination(req);
    const storeId = req.query.store_id || null;

    try {
      const result = await db.query(
        `SELECT p.id, p.name, p.price_gross, p.image_url,
                s.id AS store_id, s.name AS store_name,
                pas.commission_percent
         FROM product_affiliate_settings pas
         JOIN products p ON p.id = pas.product_id
         JOIN stores   s ON s.id = pas.store_id
         WHERE pas.is_affiliate_enabled = TRUE
           AND ($1::uuid IS NULL OR pas.store_id = $1)
         ORDER BY pas.commission_percent DESC, p.name ASC
         LIMIT $2 OFFSET $3`,
        [storeId, limit, offset]
      );
      const countResult = await db.query(
        `SELECT COUNT(*) FROM product_affiliate_settings
         WHERE is_affiliate_enabled = TRUE
           AND ($1::uuid IS NULL OR store_id = $1)`,
        [storeId]
      );
      return res.json({
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit,
        products: result.rows,
      });
    } catch (err) {
      console.error('affiliate products error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/click/:code ───────────────────────────────────────────
// Public: record a click on an affiliate link; returns redirect URL
// Anti-fraud: max 5 clicks per IP per link per hour

router.get('/click/:code', async (req, res) => {
  const { code } = req.params;
  const ip       = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ipHash   = hashIp(ip);

  try {
    const linkResult = await db.query(
      `SELECT al.id, al.product_id, al.store_id, al.is_active
       FROM affiliate_links al WHERE al.code = $1`,
      [code]
    );
    const link = linkResult.rows[0];
    if (!link || !link.is_active) {
      return res.status(404).json({ error: 'Link afiliacyjny nie istnieje lub jest nieaktywny' });
    }

    // Anti-fraud: rate-limit per IP per link (5 clicks / hour)
    const recentClicks = await db.query(
      `SELECT COUNT(*) FROM affiliate_clicks
       WHERE link_id = $1 AND ip_hash = $2 AND created_at > NOW() - INTERVAL '1 hour'`,
      [link.id, ipHash]
    );
    if (parseInt(recentClicks.rows[0].count, 10) >= 5) {
      // Still redirect but don't count the click
      return res.redirect(302, _buildRedirectUrl(link));
    }

    // Record click
    await db.query(
      `INSERT INTO affiliate_clicks (id, link_id, ip_hash, user_agent, referrer, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        uuidv4(),
        link.id,
        ipHash,
        (req.headers['user-agent'] || '').slice(0, 512),
        (req.headers['referer'] || '').slice(0, 512),
      ]
    );

    return res.redirect(302, _buildRedirectUrl(link));
  } catch (err) {
    console.error('affiliate click error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

function _buildRedirectUrl(link) {
  // link.product_id and link.store_id are UUIDs fetched from the database;
  // they are never derived from user input, so there is no open-redirect risk.
  const base = process.env.FRONTEND_URL || 'https://uszefaqualitet.pl';
  if (link.product_id) {
    const store = link.store_id ? `?store=${link.store_id}` : '';
    return `${base}/sklep.html${store}#product-${link.product_id}`;
  }
  if (link.store_id) {
    return `${base}/sklep.html?store=${link.store_id}`;
  }
  return base;
}

// ─── GET /api/affiliate/seller/settings ───────────────────────────────────────
// Seller: list affiliate settings for products in their store

router.get(
  '/seller/settings',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });

      const result = await db.query(
        `SELECT pas.id, pas.product_id, pas.commission_percent, pas.is_affiliate_enabled,
                p.name AS product_name, p.price_gross
         FROM product_affiliate_settings pas
         JOIN products p ON p.id = pas.product_id
         WHERE pas.store_id = $1
         ORDER BY p.name ASC`,
        [store.id]
      );
      return res.json({ store_id: store.id, settings: result.rows });
    } catch (err) {
      console.error('seller affiliate settings error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PUT /api/affiliate/seller/products/:pid ──────────────────────────────────
// Seller: set commission % and enable/disable affiliate for a specific product

router.put(
  '/seller/products/:pid',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    param('pid').isUUID(),
    body('commission_percent').isFloat({ min: 0, max: 80 }).withMessage('commission_percent must be between 0 and 80'),
    // Max 80% commission prevents sellers from setting unsustainable rates that
    // exceed their own margin. Platform-wide cap enforced here alongside the
    // subscription plan's own margin constraints.
    body('is_affiliate_enabled').isBoolean(),
  ],
  validate,
  async (req, res) => {
    const productId = req.params.pid;
    const { commission_percent, is_affiliate_enabled } = req.body;

    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });

      // Verify the product exists in seller's store
      const prodCheck = await db.query(
        'SELECT id FROM shop_products WHERE store_id = $1 AND product_id = $2 LIMIT 1',
        [store.id, productId]
      );
      if (!prodCheck.rows[0]) {
        return res.status(404).json({ error: 'Produkt nie należy do Twojego sklepu' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO product_affiliate_settings
           (id, product_id, store_id, commission_percent, is_affiliate_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (product_id, store_id) DO UPDATE
           SET commission_percent   = EXCLUDED.commission_percent,
               is_affiliate_enabled = EXCLUDED.is_affiliate_enabled,
               updated_at           = NOW()
         RETURNING *`,
        [id, productId, store.id, commission_percent, is_affiliate_enabled]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('seller affiliate product update error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/seller/creators ───────────────────────────────────────
// Seller: top creators promoting the seller's products, sorted by conversions

router.get(
  '/seller/creators',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit || '10', 10));

    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });

      const result = await db.query(
        `SELECT u.id AS creator_id, u.name AS creator_name,
                COUNT(DISTINCT al.id)::int AS links,
                COUNT(DISTINCT ac.id)::int AS clicks,
                COUNT(DISTINCT aconv.id)::int AS conversions,
                COALESCE(SUM(aconv.commission_amount), 0) AS total_commission
         FROM affiliate_links al
         JOIN users u ON u.id = al.creator_id
         LEFT JOIN affiliate_clicks      ac    ON ac.link_id    = al.id
         LEFT JOIN affiliate_conversions aconv ON aconv.link_id = al.id
         WHERE al.store_id = $1 AND al.is_active = TRUE
         GROUP BY u.id, u.name
         ORDER BY conversions DESC, clicks DESC
         LIMIT $2`,
        [store.id, limit]
      );
      return res.json({ creators: result.rows });
    } catch (err) {
      console.error('seller top creators error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/seller/stats ──────────────────────────────────────────
// Seller: aggregate affiliate sales statistics for their store

router.get(
  '/seller/stats',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });

      const [linkCount, clickCount, convResult] = await Promise.all([
        db.query('SELECT COUNT(*) FROM affiliate_links WHERE store_id = $1 AND is_active = TRUE', [store.id]),
        db.query(
          `SELECT COUNT(*) FROM affiliate_clicks ac
           JOIN affiliate_links al ON al.id = ac.link_id
           WHERE al.store_id = $1`,
          [store.id]
        ),
        db.query(
          `SELECT COUNT(*) AS conversions,
                  COALESCE(SUM(order_amount), 0) AS affiliate_revenue,
                  COALESCE(SUM(commission_amount), 0) AS total_commissions_paid
           FROM affiliate_conversions aconv
           JOIN affiliate_links al ON al.id = aconv.link_id
           WHERE al.store_id = $1`,
          [store.id]
        ),
      ]);

      return res.json({
        store_id:              store.id,
        active_links:          parseInt(linkCount.rows[0].count, 10),
        total_clicks:          parseInt(clickCount.rows[0].count, 10),
        conversions:           parseInt(convResult.rows[0].conversions, 10),
        affiliate_revenue:     parseFloat(convResult.rows[0].affiliate_revenue),
        total_commissions_paid: parseFloat(convResult.rows[0].total_commissions_paid),
      });
    } catch (err) {
      console.error('seller affiliate stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/admin/withdrawals ─────────────────────────────────────
// Admin: paginated list of all withdrawal requests

router.get(
  '/admin/withdrawals',
  authenticate,
  requireRole('owner', 'admin'),
  [
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { page, limit, offset } = parsePagination(req);
    const statusFilter = req.query.status || null;

    try {
      const total = await db.query(
        `SELECT COUNT(*) FROM affiliate_withdrawals
         WHERE ($1::text IS NULL OR status = $1)`,
        [statusFilter]
      );
      const result = await db.query(
        `SELECT aw.id, aw.creator_id, aw.amount, aw.status, aw.notes,
                aw.created_at, aw.processed_at,
                u.name AS creator_name, u.email AS creator_email
         FROM affiliate_withdrawals aw
         JOIN users u ON u.id = aw.creator_id
         WHERE ($1::text IS NULL OR aw.status = $1)
         ORDER BY aw.created_at DESC
         LIMIT $2 OFFSET $3`,
        [statusFilter, limit, offset]
      );
      return res.json({
        total: parseInt(total.rows[0].count, 10),
        page,
        limit,
        withdrawals: result.rows,
      });
    } catch (err) {
      console.error('admin withdrawals error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/affiliate/admin/withdrawals/:id ────────────────────────────────
// Admin: approve or reject a withdrawal request

router.patch(
  '/admin/withdrawals/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['approved', 'rejected']),
    body('notes').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { status, notes = null } = req.body;
    try {
      const result = await db.query(
        `UPDATE affiliate_withdrawals
         SET status = $1, notes = $2, processed_at = NOW()
         WHERE id = $3 AND status = 'pending'
         RETURNING *`,
        [status, notes, req.params.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Wniosek nie istnieje lub już został rozpatrzony' });
      }
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin withdrawal update error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/affiliate/admin/stats ───────────────────────────────────────────
// Admin: platform-wide affiliate overview

router.get(
  '/admin/stats',
  authenticate,
  requireRole('owner', 'admin'),
  async (_req, res) => {
    try {
      const [links, clicks, convs, pending] = await Promise.all([
        db.query('SELECT COUNT(*) FROM affiliate_links WHERE is_active = TRUE'),
        db.query('SELECT COUNT(*) FROM affiliate_clicks'),
        db.query(
          `SELECT COUNT(*) AS count,
                  COALESCE(SUM(commission_amount), 0) AS total_paid
           FROM affiliate_conversions WHERE status = 'confirmed'`
        ),
        db.query(
          `SELECT COUNT(*) AS count,
                  COALESCE(SUM(amount), 0) AS total_amount
           FROM affiliate_withdrawals WHERE status = 'pending'`
        ),
      ]);
      return res.json({
        active_links:               parseInt(links.rows[0].count, 10),
        total_clicks:               parseInt(clicks.rows[0].count, 10),
        confirmed_conversions:      parseInt(convs.rows[0].count, 10),
        total_commissions_paid:     parseFloat(convs.rows[0].total_paid),
        pending_withdrawals:        parseInt(pending.rows[0].count, 10),
        pending_withdrawal_amount:  parseFloat(pending.rows[0].total_amount),
      });
    } catch (err) {
      console.error('admin affiliate stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
