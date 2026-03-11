'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../../config/database');
const { validate } = require('../../middleware/validate');
const { logAudit } = require('./audit');

const router = express.Router();

const VALID_TYPES = ['own', 'supplier', 'producer'];

// ─── GET /api/admin/products ──────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : null;

  try {
    let countSql = 'SELECT COUNT(*) FROM products';
    let listSql  =
      `SELECT p.*, s.name AS store_name
       FROM products p
       LEFT JOIN stores s ON s.id = p.store_id`;
    const params = [];

    if (search) {
      countSql += ' WHERE name ILIKE $1 OR sku ILIKE $1';
      listSql  += ' WHERE p.name ILIKE $1 OR p.sku ILIKE $1';
      params.push(search);
    }

    const countResult = await db.query(countSql, params);
    const total = parseInt(countResult.rows[0].count, 10);

    listSql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await db.query(listSql, [...params, limit, offset]);

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin list products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/admin/products ─────────────────────────────────────────────────

router.post(
  '/',
  [
    body('store_id').isUUID(),
    body('name').trim().notEmpty(),
    body('price_net').isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('type').optional().isIn(VALID_TYPES),
    body('category').optional().trim(),
    body('stock').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const {
      store_id,
      supplier_id = null,
      name,
      sku = null,
      price_net,
      tax_rate = 23,
      margin = 15,
      category = null,
      description = null,
      stock = 0,
      image_url = null,
      type = 'own',
    } = req.body;

    try {
      const priceGross   = price_net * (1 + tax_rate / 100);
      const sellingPrice = priceGross * (1 + margin / 100);
      const id = uuidv4();

      const result = await db.query(
        `INSERT INTO products
           (id, store_id, supplier_id, name, sku, price_net, tax_rate, price_gross, selling_price,
            margin, category, description, stock, image_url, type, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
         RETURNING *`,
        [id, store_id, supplier_id, name, sku,
         price_net, tax_rate, priceGross.toFixed(2), sellingPrice.toFixed(2),
         margin, category, description, stock, image_url, type]
      );
      await logAudit(req.user.id, 'product.create', 'product', id, { name, store_id }, req);
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('admin create product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/products/:id ───────────────────────────────────────────

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('price_net').optional().isFloat({ min: 0 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('type').optional().isIn(VALID_TYPES),
    body('category').optional().trim(),
    body('stock').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { name, price_net, tax_rate, margin, category, description, stock, image_url, type } = req.body;

    try {
      // Recalculate derived prices if price_net / tax_rate / margin changed
      let priceGross   = null;
      let sellingPrice = null;

      if (price_net !== undefined || tax_rate !== undefined || margin !== undefined) {
        const current = await db.query(
          'SELECT price_net, tax_rate, margin FROM products WHERE id = $1',
          [req.params.id]
        );
        if (!current.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });

        const pn = price_net !== undefined ? price_net : parseFloat(current.rows[0].price_net);
        const tr = tax_rate  !== undefined ? tax_rate  : parseFloat(current.rows[0].tax_rate);
        const mg = margin    !== undefined ? margin    : parseFloat(current.rows[0].margin);

        priceGross   = (pn * (1 + tr / 100)).toFixed(2);
        sellingPrice = (pn * (1 + tr / 100) * (1 + mg / 100)).toFixed(2);
      }

      const result = await db.query(
        `UPDATE products SET
           name          = COALESCE($1, name),
           price_net     = COALESCE($2, price_net),
           tax_rate      = COALESCE($3, tax_rate),
           price_gross   = COALESCE($4, price_gross),
           selling_price = COALESCE($5, selling_price),
           margin        = COALESCE($6, margin),
           category      = COALESCE($7, category),
           description   = COALESCE($8, description),
           stock         = COALESCE($9, stock),
           image_url     = COALESCE($10, image_url),
           type          = COALESCE($11, type),
           updated_at    = NOW()
         WHERE id = $12
         RETURNING *`,
        [name || null, price_net !== undefined ? price_net : null,
         tax_rate !== undefined ? tax_rate : null,
         priceGross, sellingPrice,
         margin !== undefined ? margin : null,
         category !== undefined ? category : null,
         description !== undefined ? description : null,
         stock !== undefined ? stock : null,
         image_url !== undefined ? image_url : null,
         type || null,
         req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      await logAudit(req.user.id, 'product.update', 'product', req.params.id, { changes: req.body }, req);
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/products/:id ──────────────────────────────────────────

router.delete(
  '/:id',
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM products WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      await logAudit(req.user.id, 'product.delete', 'product', req.params.id, {}, req);
      return res.json({ message: 'Produkt usunięty' });
    } catch (err) {
      console.error('admin delete product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
