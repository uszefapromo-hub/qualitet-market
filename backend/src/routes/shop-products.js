'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── List shop products for a store ───────────────────────────────────────────
// Public endpoint – anyone can browse a store's product listing.

router.get('/', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(422).json({ error: 'Wymagany parametr: store_id' });

  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM shop_products WHERE store_id = $1 AND active = true`,
      [store_id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT sp.id, sp.store_id, sp.product_id, sp.active, sp.sort_order, sp.created_at,
              p.name, p.sku, p.description, p.category, p.image_url, p.stock,
              COALESCE(sp.price_override, p.selling_price) AS price,
              COALESCE(sp.margin_override, p.margin) AS margin
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       WHERE sp.store_id = $1 AND sp.active = true
       ORDER BY sp.sort_order ASC, sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [store_id, limit, offset]
    );
    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('list shop products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Add product to shop ──────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('store_id').isUUID(),
    body('product_id').isUUID(),
    body('price_override').optional().isFloat({ min: 0 }),
    body('margin_override').optional().isFloat({ min: 0, max: 100 }),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const {
      store_id,
      product_id,
      price_override = null,
      margin_override = null,
      sort_order = 0,
    } = req.body;

    try {
      // Verify store ownership
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      // Verify product exists in central catalogue
      const productResult = await db.query('SELECT id, min_selling_price FROM products WHERE id = $1', [product_id]);
      if (!productResult.rows[0]) {
        return res.status(404).json({ error: 'Produkt nie znaleziony' });
      }

      // Enforce minimum selling price set by the platform
      const minPrice = productResult.rows[0].min_selling_price;
      if (price_override != null && minPrice != null && price_override < minPrice) {
        return res.status(422).json({ error: 'Cena nie może być niższa od ceny minimalnej platformy' });
      }

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO shop_products
           (id, store_id, product_id, price_override, margin_override, active, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           price_override  = EXCLUDED.price_override,
           margin_override = EXCLUDED.margin_override,
           sort_order      = EXCLUDED.sort_order,
           active          = true,
           updated_at      = NOW()
         RETURNING *`,
        [id, store_id, product_id, price_override, margin_override, sort_order]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('add shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update shop product ──────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    param('id').isUUID(),
    body('price_override').optional().isFloat({ min: 0 }),
    body('margin_override').optional().isFloat({ min: 0, max: 100 }),
    body('active').optional().isBoolean(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { price_override, margin_override, active, sort_order } = req.body;

    try {
      const spResult = await db.query(
        `SELECT sp.*, s.owner_id, p.min_selling_price
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

      // Enforce minimum selling price set by the platform
      if (price_override != null && sp.min_selling_price != null && price_override < sp.min_selling_price) {
        return res.status(422).json({ error: 'Cena nie może być niższa od ceny minimalnej platformy' });
      }

      const result = await db.query(
        `UPDATE shop_products SET
           price_override  = COALESCE($1, price_override),
           margin_override = COALESCE($2, margin_override),
           active          = COALESCE($3, active),
           sort_order      = COALESCE($4, sort_order),
           updated_at      = NOW()
         WHERE id = $5
         RETURNING *`,
        [
          price_override !== undefined ? price_override : null,
          margin_override !== undefined ? margin_override : null,
          active !== undefined ? active : null,
          sort_order !== undefined ? sort_order : null,
          req.params.id,
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Remove product from shop ──────────────────────────────────────────────────

router.delete(
  '/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.id, s.owner_id FROM shop_products sp
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
      console.error('delete shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
