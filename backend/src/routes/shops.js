'use strict';

/**
 * Public and seller shop routes.
 *
 * POST /api/shops                   – create a new shop (authenticated seller)
 * GET  /api/shops/:slug             – public store profile
 * GET  /api/shops/:slug/products    – public product listing for a store
 */

const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, sanitizeText } = require('../middleware/validate');
const { PLAN_CONFIG } = require('./subscriptions');
const { nameToSlug, uniqueSlug } = require('../helpers/slug');

const router = express.Router();

// ─── Helper: create a free subscription for a shop ────────────────────────────

async function createFreeSubscription(shopId) {
  const freeConfig = PLAN_CONFIG['free'];
  await db.query(
    `INSERT INTO subscriptions
       (id, shop_id, plan, status, product_limit, commission_rate, started_at, expires_at, created_at)
     VALUES ($1, $2, 'free', 'active', $3, $4, NOW(), NULL, NOW())`,
    [uuidv4(), shopId, freeConfig.product_limit, freeConfig.commission_rate]
  );
}



router.post(
  '/',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('slug').optional().trim().matches(/^[a-z0-9-]+$/i).isLength({ max: 80 }),
    body('description').optional().trim(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('plan').optional().isIn(['basic', 'pro', 'elite']),
  ],
  validate,
  async (req, res) => {
    const {
      name,
      description = null,
      margin = 30,   // default 30 % margin for new shops
      plan = 'basic',
    } = req.body;
    // Sanitize free-text fields to prevent stored XSS
    const safeName = sanitizeText(name);
    const safeDescription = description ? sanitizeText(description) : null;

    try {
      // Auto-generate slug from name if not provided; ensure uniqueness
      const baseSlug = req.body.slug ? req.body.slug.toLowerCase() : nameToSlug(safeName);
      const slug = await uniqueSlug(baseSlug);
      const subdomain = `${slug}.qualitetmarket.pl`;

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO stores (id, owner_id, name, slug, subdomain, description, margin, plan, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW())
         RETURNING *`,
        [id, req.user.id, safeName, slug, subdomain, safeDescription, margin, plan]
      );

      // Auto-create free subscription for the new shop (no expiry)
      await createFreeSubscription(id);

      return res.status(201).json({
        ...result.rows[0],
        next_step: 'add_products',
        message: 'Sklep utworzony. Dodaj pierwsze produkty!',
      });
    } catch (err) {
      console.error('create shop error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/shops/:slug – public store profile ───────────────────────────────

router.get('/:slug', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, description, logo_url, plan, margin, created_at
       FROM stores
       WHERE slug = $1 AND status IN ('active', 'pending')`,
      [req.params.slug]
    );
    const store = result.rows[0];
    if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });
    return res.json(store);
  } catch (err) {
    console.error('get shop by slug error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/shops/:slug/products – public product listing ───────────────────

router.get('/:slug/products', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const search   = req.query.search   || null;
  const category = req.query.category || null;

  try {
    // Resolve store by slug
    const storeResult = await db.query(
      `SELECT id, margin FROM stores WHERE slug = $1 AND status IN ('active', 'pending')`,
      [req.params.slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

    const conditions = ['sp.store_id = $1', 'sp.active = true'];
    const params = [store.id];
    let idx = 2;

    if (category) { conditions.push(`p.category = $${idx++}`); params.push(category); }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM shop_products sp JOIN products p ON sp.product_id = p.id ${where}`,
      params
    );
    let total = parseInt(countResult.rows[0].count, 10);

    // If the shop has no assigned products, auto-assign up to 20 from the central catalogue
    // using a single bulk INSERT…SELECT to avoid N+1 queries.
    if (total === 0 && !search && !category) {
      await db.query(
        `INSERT INTO shop_products (id, store_id, product_id, active, margin_override, sort_order, created_at)
         SELECT gen_random_uuid(), $1, p.id, true, $2, 0, NOW()
         FROM products p
         WHERE p.is_central = true AND p.stock > 0 AND p.status = 'active'
         ORDER BY p.created_at DESC
         LIMIT 20
         ON CONFLICT (store_id, product_id) DO NOTHING`,
        [store.id, store.margin]
      );
    }

    const result = await db.query(
      `SELECT sp.id, sp.store_id, sp.product_id, sp.active, sp.sort_order, sp.created_at,
              COALESCE(sp.custom_title, p.name)              AS name,
              COALESCE(sp.custom_description, p.description) AS description,
              p.sku, p.category, p.image_url, p.stock,
              COALESCE(sp.price_override, p.selling_price)   AS price,
              COALESCE(sp.margin_override, p.margin)         AS margin
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       ${where}
       ORDER BY sp.sort_order ASC, sp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    // After auto-assign, use the number of returned rows as the total (all fit on first page)
    if (total === 0) {
      total = result.rows.length;
    }

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('get shop products by slug error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/shops/quick-setup – create shop + auto-import products ─────────
// "Sklep w 60 sekund": seller provides name + category, system auto-creates shop,
// imports first products from central catalogue, and sets default margin.

router.post(
  '/quick-setup',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('category').optional().trim(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const {
      name,
      category = null,
      margin = 20,
    } = req.body;
    const safeName = sanitizeText(name);

    try {
      // 1. Create store
      const baseSlug = nameToSlug(safeName);
      const slug = await uniqueSlug(baseSlug);
      const subdomain = `${slug}.qualitetmarket.pl`;
      const storeId = uuidv4();

      const storeResult = await db.query(
        `INSERT INTO stores (id, owner_id, name, slug, subdomain, description, margin, plan, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'free', 'active', NOW())
         RETURNING *`,
        [storeId, req.user.id, safeName, slug, subdomain, null, margin]
      );

      // 2. Create free subscription (no expiry)
      await createFreeSubscription(storeId);

      // 3. Auto-import first products from central catalogue (up to 5)
      const conditions = ['p.is_central = true', 'p.stock > 0'];
      const params = [];
      if (category) {
        conditions.push(`p.category ILIKE $${params.length + 1}`);
        params.push(`%${category}%`);
      }
      const where = `WHERE ${conditions.join(' AND ')}`;
      const productResult = await db.query(
        `SELECT id, selling_price, margin FROM products p ${where} ORDER BY p.created_at DESC LIMIT 5`,
        params
      );

      const importedProducts = [];
      for (const product of productResult.rows) {
        const spId = uuidv4();
        await db.query(
          `INSERT INTO shop_products (id, store_id, product_id, active, margin_override, sort_order, created_at)
           VALUES ($1, $2, $3, true, $4, 0, NOW())
           ON CONFLICT (store_id, product_id) DO NOTHING`,
          [spId, storeId, product.id, margin]
        );
        importedProducts.push(product.id);
      }

      return res.status(201).json({
        ...storeResult.rows[0],
        imported_products: importedProducts.length,
        next_step: 'add_products',
        message: `Sklep "${safeName}" utworzony! Zaimportowano ${importedProducts.length} produktów.`,
      });
    } catch (err) {
      console.error('quick-setup error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;

