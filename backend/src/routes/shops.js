'use strict';

const express = require('express');

const db = require('../config/database');

const router = express.Router();

// ─── GET /api/shops/:slug/products ─────────────────────────────────────────────
// Public endpoint: list active products in a store identified by its slug.
// Includes computed selling_price and merged product details.

router.get('/:slug/products', async (req, res) => {
  const { slug } = req.params;
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const storeResult = await db.query(
      'SELECT id, name, slug, description, logo_url, status FROM stores WHERE slug = $1',
      [slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });
    if (store.status !== 'active') return res.status(404).json({ error: 'Sklep niedostępny' });

    const countResult = await db.query(
      'SELECT COUNT(*) FROM shop_products WHERE store_id = $1 AND active = true',
      [store.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT
         sp.id            AS shop_product_id,
         sp.store_id,
         sp.product_id,
         COALESCE(sp.custom_title, p.name)              AS name,
         COALESCE(sp.custom_description, p.description) AS description,
         sp.margin_type,
         sp.margin_value,
         COALESCE(sp.selling_price, p.selling_price)    AS price,
         sp.active,
         sp.sort_order,
         p.sku,
         p.stock,
         p.image_url,
         p.category,
         p.category_id
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       WHERE sp.store_id = $1 AND sp.active = true
       ORDER BY sp.sort_order ASC, sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [store.id, limit, offset]
    );

    return res.json({
      store: { id: store.id, name: store.name, slug: store.slug, description: store.description, logo_url: store.logo_url },
      total,
      page,
      limit,
      products: result.rows,
    });
  } catch (err) {
    console.error('shops/:slug/products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
