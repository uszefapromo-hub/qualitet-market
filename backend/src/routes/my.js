'use strict';

/**
 * "My" routes – user-facing endpoints for the currently authenticated user.
 *
 * GET    /api/my/store                       – seller's primary store
 * GET    /api/my/store/stats                 – seller's store dashboard stats (incl. click/ref data)
 * GET    /api/my/store/orders                – orders for the seller's store
 * GET    /api/my/orders                      – buyer's order history
 * GET    /api/my/store/products              – list my store's shop products
 * POST   /api/my/store/products              – add a product to my store
 * POST   /api/my/store/products/bulk         – add multiple products to my store at once
 * PATCH  /api/my/store/products/:id          – update a shop product in my store
 * DELETE /api/my/store/products/:id          – remove a product from my store
 * GET    /api/my/links                       – seller's product sales links with click/sale stats
 * POST   /api/my/track-click                 – record a click on a seller ref link (no auth)
 * GET    /api/my/dashboard                   – full automation dashboard (earnings, clicks, top products)
 */

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole, requireActiveSubscription } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { parsePagination } = require('../helpers/pagination');

const router = express.Router();

// ─── GET /api/my/store – seller's primary store ───────────────────────────────

router.get(
  '/store',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('my store error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/store/stats – seller's store dashboard stats ────────────────

router.get(
  '/store/stats',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }
      const storeId = store.id;
      const sellerId = req.user.id;

      const [orderStats, productCount, customerCount, clickCount, refOrderStats, topProducts] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS order_count,
                  COALESCE(SUM(total), 0) AS revenue,
                  COALESCE(SUM(platform_commission), 0) AS platform_commission,
                  COALESCE(SUM(seller_revenue), 0) AS seller_earnings
           FROM orders WHERE store_id = $1`,
          [storeId]
        ),
        db.query(
          'SELECT COUNT(*) FROM shop_products WHERE store_id = $1',
          [storeId]
        ),
        db.query(
          'SELECT COUNT(DISTINCT buyer_id) FROM orders WHERE store_id = $1',
          [storeId]
        ),
        db.query(
          'SELECT COUNT(*) FROM seller_clicks WHERE seller_id = $1',
          [sellerId]
        ),
        db.query(
          `SELECT COUNT(*) AS ref_sale_count,
                  COALESCE(SUM(seller_revenue), 0) AS ref_earnings
           FROM orders WHERE ref_seller_id = $1`,
          [sellerId]
        ),
        db.query(
          `SELECT p.id, p.name, p.image_url,
                  COUNT(sc.id) AS click_count,
                  COUNT(DISTINCT o.id) AS sale_count,
                  COALESCE(SUM(o.seller_revenue), 0) AS earnings
           FROM shop_products sp
           JOIN products p ON p.id = sp.product_id
           LEFT JOIN seller_clicks sc ON sc.product_id = p.id AND sc.seller_id = $1
           LEFT JOIN orders o ON o.ref_seller_id = $1
             AND EXISTS (
               SELECT 1 FROM order_items oi
               WHERE oi.order_id = o.id AND oi.product_id = p.id
             )
           WHERE sp.store_id = $2
           GROUP BY p.id, p.name, p.image_url
           ORDER BY click_count DESC, sale_count DESC
           LIMIT 5`,
          [sellerId, storeId]
        ),
      ]);

      const stats = orderStats.rows[0];
      const refStats = refOrderStats.rows[0];
      const baseUrl = process.env.APP_URL || 'https://uszefaqualitet.pl';
      return res.json({
        order_count:         parseInt(stats.order_count, 10),
        revenue:             parseFloat(stats.revenue),
        platform_commission: parseFloat(stats.platform_commission),
        seller_earnings:     parseFloat(stats.seller_earnings),
        product_count:       parseInt(productCount.rows[0].count, 10),
        customer_count:      parseInt(customerCount.rows[0].count, 10),
        click_count:         parseInt(clickCount.rows[0].count, 10),
        ref_sale_count:      parseInt(refStats.ref_sale_count, 10),
        ref_earnings:        parseFloat(refStats.ref_earnings),
        top_products:        topProducts.rows.map((p) => ({
          id:          p.id,
          name:        p.name,
          image_url:   p.image_url,
          click_count: parseInt(p.click_count, 10),
          sale_count:  parseInt(p.sale_count, 10),
          earnings:    parseFloat(p.earnings),
          link:        `${baseUrl}/product.html?id=${p.id}&ref=${sellerId}`,
        })),
      });
    } catch (err) {
      console.error('my store stats error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/store/orders – store orders for seller ───────────────────────

router.get(
  '/store/orders',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }
      const storeId = store.id;

      const { page, limit, offset } = parsePagination(req);

      const countResult = await db.query(
        'SELECT COUNT(*) FROM orders WHERE store_id = $1',
        [storeId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT o.id, o.order_number, o.status, o.total, o.created_at,
                o.buyer_id, o.shipping_address, o.notes,
                o.seller_revenue, o.platform_commission
         FROM orders o
         WHERE o.store_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2 OFFSET $3`,
        [storeId, limit, offset]
      );

      return res.json({ total, page, limit, orders: result.rows });
    } catch (err) {
      console.error('my store orders error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/my/store – update seller's primary store ─────────────────────

router.patch(
  '/store',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('logo_url').optional().isURL(),
    body('banner_url').optional().isURL(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }

      const { name, description, logo_url, banner_url, margin } = req.body;

      const result = await db.query(
        `UPDATE stores SET
           name        = COALESCE($1, name),
           description = COALESCE($2, description),
           logo_url    = COALESCE($3, logo_url),
           banner_url  = COALESCE($4, banner_url),
           margin      = COALESCE($5, margin),
           updated_at  = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          name        !== undefined ? name        : null,
          description !== undefined ? description : null,
          logo_url    !== undefined ? logo_url    : null,
          banner_url  !== undefined ? banner_url  : null,
          margin      !== undefined ? margin      : null,
          store.id,
        ]
      );

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('my store update error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/orders – buyer's order history ────────────────────────────────

router.get('/orders', authenticate, async (req, res) => {
  const { page, limit, offset } = parsePagination(req);

  try {
    const countResult = await db.query(
      'SELECT COUNT(*) FROM orders WHERE buyer_id = $1',
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT * FROM orders
       WHERE buyer_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('my orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/my/store/products – list my store's shop products ────────────────

router.get(
  '/store/products',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const { store_id } = req.query;
    if (!store_id) return res.status(422).json({ error: 'Wymagany parametr: store_id' });

    const { page, limit, offset } = parsePagination(req);

    try {
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      const countResult = await db.query(
        'SELECT COUNT(*) FROM shop_products WHERE store_id = $1',
        [store_id]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT sp.id, sp.store_id, sp.product_id, sp.active, sp.sort_order,
                sp.custom_title, sp.custom_description, sp.margin_type,
                sp.price_override, sp.margin_override, sp.created_at, sp.updated_at,
                p.name, p.sku, p.description, p.category, p.image_url, p.stock,
                p.selling_price AS base_price, p.margin AS base_margin,
                p.supplier_price, p.platform_price, p.min_selling_price,
                COALESCE(sp.price_override, p.platform_price, p.selling_price) AS price
         FROM shop_products sp
         JOIN products p ON sp.product_id = p.id
         WHERE sp.store_id = $1
         ORDER BY sp.sort_order ASC, sp.created_at DESC
         LIMIT $2 OFFSET $3`,
        [store_id, limit, offset]
      );

      return res.json({ total, page, limit, products: result.rows });
    } catch (err) {
      console.error('my store products list error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/my/store/products – add product to my store ────────────────────

router.post(
  '/store/products',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('store_id').isUUID(),
    body('product_id').isUUID(),
    body('custom_title').optional().trim(),
    body('custom_description').optional().trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_override').optional().isFloat({ min: 0 }),
    body('price_override').optional().isFloat({ min: 0 }),
    body('active').optional().isBoolean(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  requireActiveSubscription,
  async (req, res) => {
    const {
      store_id,
      product_id,
      custom_title      = null,
      custom_description = null,
      margin_type       = 'percent',
      margin_override   = null,
      price_override    = null,
      active            = true,
      sort_order        = 0,
    } = req.body;

    try {
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      // ── Product-limit gate (capped plan: N products, unlimited plan: null) ──────
      // req.subscription is set by requireActiveSubscription middleware above.
      // • null → no subscription record → open access (new seller, no cap applied)
      // • product_limit null → paid plan → no cap applied
      // • product_limit N → capped plan (e.g., free plan) → enforce the limit
      const sub = req.subscription;
      if (sub && sub.product_limit !== null && sub.product_limit !== undefined) {
        const countResult = await db.query(
          'SELECT COUNT(*) FROM shop_products WHERE store_id = $1',
          [store_id]
        );
        const currentCount = parseInt(countResult.rows[0].count, 10);
        if (currentCount >= sub.product_limit) {
          return res.status(403).json({ error: 'product_limit_reached' });
        }
      }

      const productResult = await db.query(
        'SELECT id, platform_price, min_selling_price, selling_price FROM products WHERE id = $1',
        [product_id]
      );
      if (!productResult.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });

      const product = productResult.rows[0];
      const basePlatformPrice = parseFloat(product.platform_price || product.selling_price || 0);
      const minPrice = parseFloat(product.min_selling_price || product.platform_price || product.selling_price || 0);

      if (price_override !== null && price_override < minPrice) {
        return res.status(422).json({ error: 'Cena nie może być niższa niż cena platformy', min_selling_price: minPrice });
      }
      if (margin_type === 'fixed' && margin_override !== null) {
        const computedPrice = parseFloat((basePlatformPrice + parseFloat(margin_override)).toFixed(2));
        if (computedPrice < minPrice) {
          return res.status(422).json({ error: 'Cena sprzedaży nie może być niższa niż cena platformy', min_selling_price: minPrice });
        }
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO shop_products
           (id, store_id, product_id, custom_title, custom_description, margin_type,
            margin_override, price_override, active, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           custom_title       = EXCLUDED.custom_title,
           custom_description = EXCLUDED.custom_description,
           margin_type        = EXCLUDED.margin_type,
           margin_override    = EXCLUDED.margin_override,
           price_override     = EXCLUDED.price_override,
           active             = EXCLUDED.active,
           sort_order         = EXCLUDED.sort_order,
           updated_at         = NOW()
         RETURNING *`,
        [id, store_id, product_id, custom_title, custom_description, margin_type,
         margin_override, price_override, active, sort_order]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('my store add product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/my/store/products/bulk – add multiple products to my store ──────

router.post(
  '/store/products/bulk',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('store_id').isUUID(),
    body('product_ids').isArray({ min: 1 }),
    body('product_ids.*').isUUID(),
  ],
  validate,
  requireActiveSubscription,
  async (req, res) => {
    const { store_id, product_ids } = req.body;

    try {
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      // ── Product-limit gate (capped plan: N products, unlimited plan: null) ──────
      // req.subscription is set by requireActiveSubscription middleware above.
      // • null → no subscription record → open access (new seller, no cap applied)
      // • product_limit null → paid plan → no cap applied
      // • product_limit N → capped plan (e.g., free plan) → enforce the limit (bulk-aware)
      const sub = req.subscription;
      if (sub && sub.product_limit !== null && sub.product_limit !== undefined) {
        const countResult = await db.query(
          'SELECT COUNT(*) FROM shop_products WHERE store_id = $1',
          [store_id]
        );
        const currentCount = parseInt(countResult.rows[0].count, 10);
        if (currentCount + product_ids.length > sub.product_limit) {
          return res.status(403).json({ error: 'product_limit_reached' });
        }
      }

      const DEFAULT_MARGIN = 20;
      const added = [];
      const skipped = [];

      // Fetch all requested products in one query to avoid N+1 lookups
      const productsResult = await db.query(
        'SELECT id, selling_price FROM products WHERE id = ANY($1)',
        [product_ids]
      );
      const foundProducts = new Set(productsResult.rows.map((p) => p.id));

      for (const product_id of product_ids) {
        if (!foundProducts.has(product_id)) {
          skipped.push({ product_id, reason: 'not_found' });
          continue;
        }

        const id = uuidv4();
        const result = await db.query(
          `INSERT INTO shop_products
             (id, store_id, product_id, margin_type, margin_override, active, sort_order, created_at)
           VALUES ($1, $2, $3, 'percent', $4, true, 0, NOW())
           ON CONFLICT (store_id, product_id) DO UPDATE SET
             margin_type     = EXCLUDED.margin_type,
             margin_override = EXCLUDED.margin_override,
             updated_at      = NOW()
           RETURNING *`,
          [id, store_id, product_id, DEFAULT_MARGIN]
        );
        added.push(result.rows[0]);
      }

      return res.status(201).json({
        added: added.length,
        skipped: skipped.length,
        results: added,
        skipped_ids: skipped,
      });
    } catch (err) {
      console.error('my store bulk add products error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/my/store/products/:id – update a shop product ─────────────────

router.patch(
  '/store/products/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    param('id').isUUID(),
    body('custom_title').optional().trim(),
    body('custom_description').optional().trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_override').optional().isFloat({ min: 0 }),
    body('price_override').optional().isFloat({ min: 0 }),
    body('active').optional().isBoolean(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.*, s.owner_id,
                p.platform_price, p.min_selling_price, p.selling_price AS product_selling_price
         FROM shop_products sp
         JOIN stores s ON sp.store_id = s.id
         JOIN products p ON sp.product_id = p.id
         WHERE sp.id = $1`,
        [req.params.id]
      );
      const sp = spResult.rows[0];
      if (!sp) return res.status(404).json({ error: 'Produkt sklepu nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && sp.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      const {
        custom_title, custom_description, margin_type,
        margin_override, price_override, active, sort_order,
      } = req.body;

      const basePlatformPrice = parseFloat(sp.platform_price || sp.product_selling_price || 0);
      const minPrice = parseFloat(sp.min_selling_price || sp.platform_price || sp.product_selling_price || 0);

      if (price_override !== undefined && price_override !== null && price_override < minPrice) {
        return res.status(422).json({ error: 'Cena nie może być niższa niż cena platformy', min_selling_price: minPrice });
      }
      const effectiveMarginType = margin_type ?? sp.margin_type;
      if (effectiveMarginType === 'fixed' && margin_override !== undefined && margin_override !== null) {
        const computedPrice = parseFloat((basePlatformPrice + parseFloat(margin_override)).toFixed(2));
        if (computedPrice < minPrice) {
          return res.status(422).json({ error: 'Cena sprzedaży nie może być niższa niż cena platformy', min_selling_price: minPrice });
        }
      }

      const result = await db.query(
        `UPDATE shop_products SET
           custom_title       = COALESCE($1, custom_title),
           custom_description = COALESCE($2, custom_description),
           margin_type        = COALESCE($3, margin_type),
           margin_override    = COALESCE($4, margin_override),
           price_override     = COALESCE($5, price_override),
           active             = COALESCE($6, active),
           sort_order         = COALESCE($7, sort_order),
           updated_at         = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          custom_title       ?? null,
          custom_description ?? null,
          margin_type        ?? null,
          margin_override    ?? null,
          price_override     ?? null,
          active             ?? null,
          sort_order         ?? null,
          req.params.id,
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('my store update product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/my/store/products/:id – remove product from my store ─────────

router.delete(
  '/store/products/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.id, s.owner_id
         FROM shop_products sp
         JOIN stores s ON sp.store_id = s.id
         WHERE sp.id = $1`,
        [req.params.id]
      );
      const sp = spResult.rows[0];
      if (!sp) return res.status(404).json({ error: 'Produkt sklepu nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && sp.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      await db.query('DELETE FROM shop_products WHERE id = $1', [req.params.id]);
      return res.json({ message: 'Produkt usunięty ze sklepu' });
    } catch (err) {
      console.error('my store delete product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/my/store/generate – AI-style store generator ──────────────────

router.post(
  '/store/generate',
  authenticate,
  [
    body('interests').optional().trim().isLength({ max: 200 }),
    body('product_types').optional().trim().isLength({ max: 200 }),
    body('style').optional().isIn(['modern', 'premium', 'market']),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { interests = '', product_types = '', style = 'modern', margin = 15 } = req.body;

    const content = generateStoreContent({ interests, productTypes: product_types, style });

    // Look up a few products from the central catalog matching the interests
    let suggestedProducts = [];
    try {
      const keyword = (interests || product_types || '').split(/[,\s]+/)[0] || '';
      const limit = 5;
      const q = keyword
        ? await db.query(
            `SELECT id, name, selling_price FROM products
              WHERE is_central = TRUE AND name ILIKE $1
              ORDER BY created_at DESC LIMIT $2`,
            [`%${keyword}%`, limit]
          )
        : await db.query(
            `SELECT id, name, selling_price FROM products
              WHERE is_central = TRUE
              ORDER BY RANDOM() LIMIT $1`,
            [limit]
          );
      suggestedProducts = q.rows;
    } catch (_err) {
      // Non-critical — skip if products table isn't available
    }

    const base = process.env.APP_URL || 'https://uszefaqualitet.pl';
    const salesLink = `${base}/sklep.html?slug=${content.slug}`;

    return res.json({
      name:               content.name,
      slug:               content.slug,
      description:        content.description,
      primary_color:      content.primaryColor,
      style:              content.style,
      margin,
      suggested_products: suggestedProducts,
      sales_link:         salesLink,
    });
  }
);

// ─── POST /api/my/promotion/generate – promotion content generator ────────────

router.post(
  '/promotion/generate',
  authenticate,
  [
    body('product_name').trim().notEmpty().isLength({ max: 255 }),
    body('price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('store_url').optional().trim().isURL({ require_tld: false }),
    body('platform').optional().isIn(['facebook', 'instagram', 'tiktok', 'twitter']),
  ],
  validate,
  async (req, res) => {
    const { product_name, price = null, store_url = '', platform = 'facebook' } = req.body;

    const content = generatePromotionContent({ productName: product_name, price, storeUrl: store_url, platform });

    return res.json(content);
  }
);

// ─── Store generator & promotion helpers (exported for testing) ──────────────

// ─── Store generator constants ───────────────────────────────────────────────

const STORE_ADJ_PL   = ['Prestiżowy', 'Elegancki', 'Nowoczesny', 'Wyjątkowy', 'Premium', 'Unikalny'];
const STORE_NOUNS_PL = ['Sklep', 'Market', 'Boutique', 'Store', 'Shop', 'Hub'];
const STORE_THEMES   = { modern: '#35d9ff', premium: '#c9a84c', market: '#22c55e' };
const PL_CHARS       = { ą:'a', ć:'c', ę:'e', ł:'l', ń:'n', ó:'o', ś:'s', ź:'z', ż:'z' };
const PLATFORM_EMOJI = { facebook: '🛍️', instagram: '✨', tiktok: '🎬', twitter: '🔥' };

/**
 * Generate store name, description and theme suggestions based on user input.
 * Pure function – no DB access, so it can run offline / in tests.
 */
function generateStoreContent({ interests = '', productTypes = '', style = 'modern' }) {
  const adj  = STORE_ADJ_PL[Math.floor(Math.random() * STORE_ADJ_PL.length)];
  const noun = STORE_NOUNS_PL[Math.floor(Math.random() * STORE_NOUNS_PL.length)];

  const topic  = (interests || productTypes || 'produktów').split(/[,\s]+/)[0];
  const topicCapitalized = topic.charAt(0).toUpperCase() + topic.slice(1).toLowerCase();

  const name = `${adj} ${topicCapitalized} ${noun}`;
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[ąćęłńóśźż]/g, (c) => PL_CHARS[c] || c)
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);

  const description = `Witaj w ${name}! Oferujemy starannie wyselekcjonowane ${productTypes || interests || 'produkty'} najwyższej jakości. Szybka wysyłka, bezpieczne zakupy i doskonała obsługa klienta.`;

  const primaryColor = STORE_THEMES[style] || STORE_THEMES.modern;

  return { name, slug, description, primaryColor, style };
}

/**
 * Generate social-media post and product description copy.
 */
function generatePromotionContent({ productName = '', price = null, storeUrl = '', platform = 'facebook' }) {
  const emoji    = PLATFORM_EMOJI[platform] || '🛍️';
  const priceStr = price != null ? ` za jedyne ${price} zł` : '';
  const urlLine  = storeUrl ? `\n🔗 Kup teraz: ${storeUrl}` : '';

  const post = `${emoji} ${productName}${priceStr}!\n\nSprawdź naszą ofertę – szybka wysyłka, najlepsza jakość!${urlLine}\n\n#qualitet #dropshipping #uszefa`;
  const productDescription = `${productName} to doskonały wybór dla wymagających klientów. Wysoka jakość wykonania, atrakcyjna cena${priceStr}. Zamów już dziś i ciesz się szybką dostawą!`;

  return { post, productDescription, platform, emoji };
}

// ─── GET /api/my/onboarding – seller onboarding checklist ────────────────────
// Returns a checklist of steps a new seller should complete to go live.
// Each step has a `done` flag so the frontend can render a progress guide.

router.get(
  '/onboarding',
  authenticate,
  requireRole('seller', 'owner'),
  async (req, res) => {
    try {
      const userId = req.user.id;

      const [storeResult, productResult, subResult, referralResult] = await Promise.all([
        db.query(
          'SELECT id, name, slug FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
          [userId]
        ),
        db.query(
          `SELECT COUNT(*) FROM shop_products sp
           JOIN stores s ON sp.store_id = s.id
           WHERE s.owner_id = $1`,
          [userId]
        ),
        db.query(
          `SELECT sub.status FROM subscriptions sub
           JOIN stores s ON sub.shop_id = s.id
           WHERE s.owner_id = $1
             AND sub.status = 'active'
           LIMIT 1`,
          [userId]
        ),
        db.query(
          'SELECT id, code FROM referral_codes WHERE user_id = $1 LIMIT 1',
          [userId]
        ),
      ]);

      const store      = storeResult.rows[0]    || null;
      const products   = parseInt(productResult.rows[0]?.count || '0', 10);
      const activeSub  = subResult.rows[0]      || null;
      const refCode    = referralResult.rows[0]  || null;

      const storeSlug    = store ? store.slug    : null;
      const storeId      = store ? store.id      : null;
      const baseUrl      = process.env.APP_URL || 'https://uszefaqualitet.pl';
      const storeFrontUrl = storeSlug ? `${baseUrl}/sklep.html?slug=${storeSlug}` : null;

      const steps = [
        {
          key:         'account_created',
          label:       'Konto sprzedawcy założone',
          done:        true,
          description: 'Twoje konto jest aktywne.',
        },
        {
          key:         'store_created',
          label:       'Sklep utworzony',
          done:        Boolean(store),
          description: store
            ? `Twój sklep: ${store.name} (${storeFrontUrl})`
            : 'Utwórz swój sklep w panelu sprzedawcy.',
          action_url:  store ? null : `${baseUrl}/dashboard.html`,
          store_id:    storeId,
          store_slug:  storeSlug,
          store_url:   storeFrontUrl,
        },
        {
          key:         'product_added',
          label:       'Pierwszy produkt dodany',
          done:        products > 0,
          description: products > 0
            ? `Masz ${products} produkt(ów) w sklepie.`
            : 'Dodaj produkty do swojego sklepu z katalogu platformy.',
          action_url:  `${baseUrl}/dashboard.html#products`,
          product_count: products,
        },
        {
          key:         'subscription_active',
          label:       'Subskrypcja aktywna',
          done:        Boolean(activeSub),
          description: activeSub
            ? 'Twoja subskrypcja jest aktywna.'
            : 'Aktywuj subskrypcję, aby Twój sklep był widoczny publicznie.',
          action_url:  `${baseUrl}/pricing.html`,
        },
        {
          key:         'referral_code_ready',
          label:       'Kod polecający gotowy',
          done:        Boolean(refCode),
          description: refCode
            ? `Twój kod polecający: ${refCode.code}`
            : 'Wygeneruj swój kod polecający i zarabiaj na każdym nowym sprzedawcy.',
          action_url:  `${baseUrl}/affiliate.html`,
          referral_code: refCode ? refCode.code : null,
        },
      ];

      const completedCount = steps.filter((s) => s.done).length;
      const allDone = completedCount === steps.length;

      return res.json({
        completed: completedCount,
        total:     steps.length,
        all_done:  allDone,
        steps,
      });
    } catch (err) {
      console.error('my onboarding error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/opportunities – products with best seller profit potential ────
// Returns central-catalogue products sorted by expected_reseller_profit DESC.
// Sellers use this to discover products worth adding to their store.
// NOTE: supplier_price, cost_price and supplier identity are intentionally omitted
//       so sellers cannot see wholesale pricing or supplier details.

router.get(
  '/opportunities',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const { page, limit, offset } = parsePagination(req);

    try {
      const countResult = await db.query(
        `SELECT COUNT(*) FROM products
         WHERE is_central = true AND status = 'active' AND stock > 0
           AND expected_reseller_profit IS NOT NULL AND expected_reseller_profit > 0`
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT p.id, p.name, p.sku, p.category, p.image_url,
                p.platform_price, p.min_selling_price,
                p.recommended_reseller_price,
                p.expected_reseller_profit, p.quality_score, p.is_featured,
                p.stock, p.description
           FROM products p
          WHERE p.is_central = true AND p.status = 'active' AND p.stock > 0
            AND p.expected_reseller_profit IS NOT NULL AND p.expected_reseller_profit > 0
          ORDER BY p.expected_reseller_profit DESC, p.quality_score DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      return res.json({ total, page, limit, opportunities: result.rows });
    } catch (err) {
      console.error('my opportunities error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/catalog – central platform catalog for sellers ───────────────
// Returns all active central-catalogue products that sellers can add to their
// shop.  Wholesale pricing (supplier_price, cost_price) and supplier identity
// are intentionally hidden from sellers (business rule).

router.get(
  '/catalog',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const { page, limit, offset } = parsePagination(req);
    const search   = req.query.search   || null;
    const category = req.query.category || null;

    const conditions = ["p.is_central = true", "p.status = 'active'", "p.stock > 0"];
    const params = [];
    let nextParamIndex = 1;

    if (search) {
      conditions.push(`(p.name ILIKE $${nextParamIndex} OR p.description ILIKE $${nextParamIndex})`);
      params.push(`%${search}%`);
      nextParamIndex++;
    }
    if (category) {
      conditions.push(`p.category = $${nextParamIndex++}`);
      params.push(category);
    }

    const where = conditions.join(' AND ');

    try {
      const countResult = await db.query(
        `SELECT COUNT(*) FROM products p WHERE ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await db.query(
        `SELECT p.id, p.name, p.sku, p.category, p.image_url,
                p.platform_price, p.min_selling_price,
                p.recommended_reseller_price,
                p.expected_reseller_profit, p.quality_score, p.is_featured,
                p.stock, p.description
           FROM products p
          WHERE ${where}
          ORDER BY p.is_featured DESC, p.quality_score DESC, p.name ASC
          LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
        [...params, limit, offset]
      );

      return res.json({ total, page, limit, products: result.rows });
    } catch (err) {
      console.error('my catalog error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/my/seller-products – add a central catalog product to seller's shop
// Simplified "Add to my store" endpoint.  The seller provides a product_id and
// an optional seller_price; the platform resolves the seller's primary store.
// Uses shop_products under the hood (same table, simpler interface).

router.post(
  '/seller-products',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('product_id').isUUID(),
    body('seller_price').optional({ nullable: true }).isFloat({ min: 0 }),
    body('active').optional().isBoolean(),
  ],
  validate,
  requireActiveSubscription,
  async (req, res) => {
    const { product_id, seller_price = null, active = true } = req.body;

    try {
      // Resolve seller's primary store
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });

      // Verify product is a central-catalog product
      const productResult = await db.query(
        `SELECT id, min_selling_price, platform_price FROM products
         WHERE id = $1 AND is_central = true AND status = 'active'`,
        [product_id]
      );
      const product = productResult.rows[0];
      if (!product) return res.status(404).json({ error: 'Produkt nie istnieje w katalogu platformy' });

      // Enforce minimum price
      const minPrice = parseFloat(product.min_selling_price || product.platform_price || 0);
      if (seller_price !== null && parseFloat(seller_price) < minPrice) {
        return res.status(422).json({ error: 'Cena sprzedaży nie może być niższa niż cena platformy', min_selling_price: minPrice });
      }

      // Product-limit gate
      const sub = req.subscription;
      if (sub && sub.product_limit !== null && sub.product_limit !== undefined) {
        const countResult = await db.query(
          'SELECT COUNT(*) FROM shop_products WHERE store_id = $1',
          [store.id]
        );
        const currentCount = parseInt(countResult.rows[0].count, 10);
        if (currentCount >= sub.product_limit) {
          return res.status(403).json({ error: 'product_limit_reached' });
        }
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO shop_products
           (id, store_id, product_id, price_override, active, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           price_override = EXCLUDED.price_override,
           active         = EXCLUDED.active,
           updated_at     = NOW()
         RETURNING *`,
        [id, store.id, product_id, seller_price, active]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('my seller-products add error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/links – seller's product sales links with stats ──────────────
// Returns all active shop products for the seller's store, each with an
// auto-generated sales link (/product.html?id={id}&ref={seller_id}) plus
// click counts and ref-sale counts so the seller can see what's working.

router.get(
  '/links',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }
      const sellerId = req.user.id;
      const baseUrl = process.env.APP_URL || 'https://uszefaqualitet.pl';

      const result = await db.query(
        `SELECT p.id, p.name, p.image_url, p.category,
                COALESCE(sp.price_override, p.recommended_reseller_price, p.min_selling_price) AS selling_price,
                COUNT(DISTINCT sc.id)   AS click_count,
                COUNT(DISTINCT o.id)    AS sale_count,
                COALESCE(SUM(o.seller_revenue), 0) AS earnings
           FROM shop_products sp
           JOIN products p ON p.id = sp.product_id
           LEFT JOIN seller_clicks sc ON sc.product_id = p.id AND sc.seller_id = $1
           LEFT JOIN orders o ON o.ref_seller_id = $1
             AND EXISTS (
               SELECT 1 FROM order_items oi
               WHERE oi.order_id = o.id AND oi.product_id = p.id
             )
          WHERE sp.store_id = $2 AND sp.active = true
          GROUP BY p.id, p.name, p.image_url, p.category, sp.price_override,
                   p.recommended_reseller_price, p.min_selling_price
          ORDER BY click_count DESC, p.name ASC`,
        [sellerId, store.id]
      );

      const links = result.rows.map((row) => ({
        product_id:   row.id,
        name:         row.name,
        image_url:    row.image_url,
        category:     row.category,
        selling_price: row.selling_price !== null ? parseFloat(row.selling_price) : null,
        click_count:  parseInt(row.click_count, 10),
        sale_count:   parseInt(row.sale_count, 10),
        earnings:     parseFloat(row.earnings),
        link:         `${baseUrl}/product.html?id=${row.id}&ref=${sellerId}`,
      }));

      return res.json({ seller_id: sellerId, links });
    } catch (err) {
      console.error('my links error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/my/track-click – record a seller ref link click ────────────────
// Called by the product page when it detects a ?ref= parameter.
// No authentication required – this is a public tracking endpoint.
// Rate-limited by IP hash (max 5 clicks per IP per seller+product per hour).

router.post(
  '/track-click',
  [
    body('product_id').isUUID(),
    body('seller_id').isUUID(),
  ],
  validate,
  async (req, res) => {
    const { product_id, seller_id } = req.body;

    // Hash the IP to avoid storing PII while still enabling rate-limiting
    const crypto = require('crypto');
    const rawIp = req.ip || req.headers['x-forwarded-for'] || '';
    const ipHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    try {
      // Rate limit: max 5 recorded clicks per ip_hash + seller + product per hour
      const recentCount = await db.query(
        `SELECT COUNT(*) FROM seller_clicks
         WHERE seller_id = $1 AND product_id = $2 AND ip_hash = $3
           AND created_at > NOW() - INTERVAL '1 hour'`,
        [seller_id, product_id, ipHash]
      );
      if (parseInt(recentCount.rows[0].count, 10) >= 5) {
        // Silent success – don't reveal rate limiting to avoid gaming
        return res.json({ recorded: false });
      }

      await db.query(
        `INSERT INTO seller_clicks (seller_id, product_id, ip_hash) VALUES ($1, $2, $3)`,
        [seller_id, product_id, ipHash]
      );

      return res.json({ recorded: true });
    } catch (err) {
      console.error('track-click error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/my/dashboard – full automation dashboard ───────────────────────
// One-stop endpoint returning everything needed for the seller automation
// dashboard: overall stats + top products + active product links.

router.get(
  '/dashboard',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const storeResult = await db.query(
        'SELECT id, name, slug FROM stores WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) {
        return res.status(404).json({ error: 'Nie masz jeszcze sklepu' });
      }
      const storeId = store.id;
      const sellerId = req.user.id;
      const baseUrl = process.env.APP_URL || 'https://uszefaqualitet.pl';

      const [orderStats, clickCount, refOrderStats, topProducts] = await Promise.all([
        db.query(
          `SELECT COUNT(*) AS order_count,
                  COALESCE(SUM(seller_revenue), 0) AS seller_earnings
           FROM orders WHERE store_id = $1`,
          [storeId]
        ),
        db.query(
          'SELECT COUNT(*) FROM seller_clicks WHERE seller_id = $1',
          [sellerId]
        ),
        db.query(
          `SELECT COUNT(*) AS ref_sale_count,
                  COALESCE(SUM(seller_revenue), 0) AS ref_earnings
           FROM orders WHERE ref_seller_id = $1`,
          [sellerId]
        ),
        db.query(
          `SELECT p.id, p.name, p.image_url,
                  COUNT(DISTINCT sc.id)  AS click_count,
                  COUNT(DISTINCT o.id)   AS sale_count,
                  COALESCE(SUM(o.seller_revenue), 0) AS earnings
           FROM shop_products sp
           JOIN products p ON p.id = sp.product_id
           LEFT JOIN seller_clicks sc ON sc.product_id = p.id AND sc.seller_id = $1
           LEFT JOIN orders o ON o.ref_seller_id = $1
             AND EXISTS (
               SELECT 1 FROM order_items oi
               WHERE oi.order_id = o.id AND oi.product_id = p.id
             )
           WHERE sp.store_id = $2 AND sp.active = true
           GROUP BY p.id, p.name, p.image_url
           ORDER BY sale_count DESC, click_count DESC
           LIMIT 10`,
          [sellerId, storeId]
        ),
      ]);

      const os = orderStats.rows[0];
      const rs = refOrderStats.rows[0];

      return res.json({
        seller_id:      sellerId,
        store_id:       storeId,
        store_name:     store.name,
        store_url:      `${baseUrl}/sklep.html?slug=${store.slug}`,
        order_count:    parseInt(os.order_count, 10),
        seller_earnings: parseFloat(os.seller_earnings),
        click_count:    parseInt(clickCount.rows[0].count, 10),
        ref_sale_count: parseInt(rs.ref_sale_count, 10),
        ref_earnings:   parseFloat(rs.ref_earnings),
        top_products:   topProducts.rows.map((p) => ({
          id:          p.id,
          name:        p.name,
          image_url:   p.image_url,
          click_count: parseInt(p.click_count, 10),
          sale_count:  parseInt(p.sale_count, 10),
          earnings:    parseFloat(p.earnings),
          link:        `${baseUrl}/product.html?id=${p.id}&ref=${sellerId}`,
        })),
      });
    } catch (err) {
      console.error('my dashboard error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;

