'use strict';

/**
 * Subdomain store routes – accessed via slug.qualitetmarket.pl.
 *
 * All three endpoints require the resolveStoreFromSubdomain middleware to have
 * resolved req.store from the Host header before the handler runs.
 *
 * GET /api/store            – public store profile
 * GET /api/store/products   – paginated product listing for the store
 * GET /api/store/categories – distinct product categories stocked by the store
 */

const express = require('express');

const db = require('../config/database');
const { resolveStoreFromSubdomain } = require('../middleware/subdomain');
const { parsePagination } = require('../helpers/pagination');

const router = express.Router();

// Apply subdomain resolution to every /api/store request
router.use(resolveStoreFromSubdomain);

// ─── GET /api/store – public store profile ────────────────────────────────────

router.get('/', (req, res) => {
  if (!req.store) {
    return res.status(404).json({ error: 'Sklep nie znaleziony' });
  }
  return res.json(req.store);
});

// ─── GET /api/store/products – paginated product listing ─────────────────────

router.get('/products', async (req, res) => {
  if (!req.store) {
    return res.status(404).json({ error: 'Sklep nie znaleziony' });
  }

  const { page, limit, offset } = parsePagination(req);
  const search   = req.query.search   || null;
  const category = req.query.category || null;

  try {
    const conditions = ['sp.store_id = $1', 'sp.active = true'];
    const params = [req.store.id];
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
    console.error('store products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/store/categories – distinct categories stocked by this store ────

router.get('/categories', async (req, res) => {
  if (!req.store) {
    return res.status(404).json({ error: 'Sklep nie znaleziony' });
  }

  try {
    const result = await db.query(
      `SELECT DISTINCT p.category AS name
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       WHERE sp.store_id = $1
         AND sp.active = true
         AND p.category IS NOT NULL
       ORDER BY p.category`,
      [req.store.id]
    );

    return res.json({ categories: result.rows.map((r) => r.name) });
  } catch (err) {
    console.error('store categories error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
