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

// ─── POST /api/shops – create a new shop (seller onboarding) ─────────────────

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

      // Auto-create trial subscription for the new shop
      const trialConfig = PLAN_CONFIG['trial'];
      const trialExpiresAt = new Date(Date.now() + trialConfig.duration_days * 24 * 60 * 60 * 1000);
      await db.query(
        `INSERT INTO subscriptions
           (id, shop_id, plan, status, product_limit, commission_rate, started_at, expires_at, created_at)
         VALUES ($1, $2, 'trial', 'active', $3, $4, NOW(), $5, NOW())`,
        [uuidv4(), id, trialConfig.product_limit, trialConfig.commission_rate, trialExpiresAt]
      );

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
      `SELECT id, name, slug, description, logo_url, created_at
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
      `SELECT id FROM stores WHERE slug = $1 AND status IN ('active', 'pending')`,
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
    const total = parseInt(countResult.rows[0].count, 10);

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

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('get shop products by slug error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;

