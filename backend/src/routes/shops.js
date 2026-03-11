'use strict';

/**
 * Public shop routes – browsing stores by slug without authentication.
 *
 * GET /api/shops/:slug          – store profile
 * GET /api/shops/:slug/products – product listing for a store
 */

const express = require('express');

const db = require('../config/database');

const router = express.Router();

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

  try {
    // Resolve store by slug
    const storeResult = await db.query(
      `SELECT id FROM stores WHERE slug = $1 AND status IN ('active', 'pending')`,
      [req.params.slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

    const countResult = await db.query(
      'SELECT COUNT(*) FROM shop_products WHERE store_id = $1 AND active = true',
      [store.id]
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
       WHERE sp.store_id = $1 AND sp.active = true
       ORDER BY sp.sort_order ASC, sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [store.id, limit, offset]
    );

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('get shop products by slug error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
