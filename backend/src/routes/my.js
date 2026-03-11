'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAudit } = require('../config/audit');

const router = express.Router();

// ─── GET /api/my/orders ────────────────────────────────────────────────────────
// Returns paginated orders where the authenticated user is the buyer.

router.get('/orders', authenticate, async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const conditions = ['buyer_id = $1'];
    const params = [req.user.id];
    let idx = 2;

    if (status) {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) FROM orders ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('my orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/my/store/products ──────────────────────────────────────────────
// Seller adds a global catalogue product to their own store via shop_products.
// The store is determined automatically from the authenticated user's active store.

router.post(
  '/store/products',
  authenticate,
  [
    body('store_id').isUUID(),
    body('product_id').isUUID(),
    body('custom_title').optional().trim(),
    body('custom_description').optional().trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_value').optional().isFloat({ min: 0 }),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const {
      store_id,
      product_id,
      custom_title = null,
      custom_description = null,
      margin_type = 'percent',
      margin_value = 0,
      sort_order = 0,
    } = req.body;

    try {
      // Verify store ownership
      const storeResult = await db.query(
        'SELECT id, owner_id, margin FROM stores WHERE id = $1',
        [store_id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      // Verify product exists in central catalogue
      const productResult = await db.query(
        'SELECT id, price_net, price_gross, selling_price, name, sku, description, image_url, stock, category FROM products WHERE id = $1',
        [product_id]
      );
      const product = productResult.rows[0];
      if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony w katalogu' });

      // Calculate selling_price based on margin
      const basePrice = parseFloat(product.selling_price);
      let sellingPrice;
      if (margin_type === 'fixed') {
        sellingPrice = parseFloat((basePrice + parseFloat(margin_value)).toFixed(2));
      } else {
        sellingPrice = parseFloat((basePrice * (1 + parseFloat(margin_value) / 100)).toFixed(2));
      }

      // Snapshot of the product at listing time
      const sourceSnapshot = {
        name: product.name,
        sku: product.sku,
        price_net: product.price_net,
        price_gross: product.price_gross,
        selling_price: product.selling_price,
        description: product.description,
        image_url: product.image_url,
        stock: product.stock,
        category: product.category,
        snapshotAt: new Date().toISOString(),
      };

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO shop_products
           (id, store_id, product_id, custom_title, custom_description,
            margin_type, margin_value, selling_price, source_snapshot,
            active, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, NOW())
         ON CONFLICT (store_id, product_id) DO UPDATE SET
           custom_title       = EXCLUDED.custom_title,
           custom_description = EXCLUDED.custom_description,
           margin_type        = EXCLUDED.margin_type,
           margin_value       = EXCLUDED.margin_value,
           selling_price      = EXCLUDED.selling_price,
           source_snapshot    = EXCLUDED.source_snapshot,
           sort_order         = EXCLUDED.sort_order,
           active             = true,
           updated_at         = NOW()
         RETURNING *`,
        [
          id, store_id, product_id, custom_title, custom_description,
          margin_type, margin_value, sellingPrice, JSON.stringify(sourceSnapshot), sort_order,
        ]
      );

      await logAudit({
        userId: req.user.id,
        action: 'shop_product.created',
        entityType: 'shop_product',
        entityId: result.rows[0].id,
        payload: { store_id, product_id, selling_price: sellingPrice },
        ip: req.ip,
      });

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('my store add product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/my/store/products/:id ─────────────────────────────────────────
// Seller updates their shop product entry.

router.patch(
  '/store/products/:id',
  authenticate,
  [
    param('id').isUUID(),
    body('custom_title').optional().trim(),
    body('custom_description').optional().trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_value').optional().isFloat({ min: 0 }),
    body('active').optional().isBoolean(),
    body('sort_order').optional().isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { custom_title, custom_description, margin_type, margin_value, active, sort_order } = req.body;

    try {
      const spResult = await db.query(
        `SELECT sp.*, s.owner_id, p.selling_price AS base_price
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

      // Recalculate selling_price if margin params changed
      const newMarginType  = margin_type  !== undefined ? margin_type  : sp.margin_type;
      const newMarginValue = margin_value !== undefined ? parseFloat(margin_value) : parseFloat(sp.margin_value);
      const basePrice = parseFloat(sp.base_price);
      let newSellingPrice;
      if (newMarginType === 'fixed') {
        newSellingPrice = parseFloat((basePrice + newMarginValue).toFixed(2));
      } else {
        newSellingPrice = parseFloat((basePrice * (1 + newMarginValue / 100)).toFixed(2));
      }

      const result = await db.query(
        `UPDATE shop_products SET
           custom_title       = COALESCE($1, custom_title),
           custom_description = COALESCE($2, custom_description),
           margin_type        = $3,
           margin_value       = $4,
           selling_price      = $5,
           active             = COALESCE($6, active),
           sort_order         = COALESCE($7, sort_order),
           updated_at         = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          custom_title       ?? null,
          custom_description ?? null,
          newMarginType,
          newMarginValue,
          newSellingPrice,
          active     ?? null,
          sort_order ?? null,
          req.params.id,
        ]
      );

      await logAudit({
        userId: req.user.id,
        action: 'shop_product.updated',
        entityType: 'shop_product',
        entityId: req.params.id,
        payload: req.body,
        ip: req.ip,
      });

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('my store update product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/my/store/products/:id ────────────────────────────────────────
// Seller removes a product from their store (deletes shop_products row).

router.delete(
  '/store/products/:id',
  authenticate,
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.id, sp.store_id, sp.product_id, s.owner_id
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

      await logAudit({
        userId: req.user.id,
        action: 'shop_product.deleted',
        entityType: 'shop_product',
        entityId: req.params.id,
        payload: { store_id: sp.store_id, product_id: sp.product_id },
        ip: req.ip,
      });

      return res.json({ message: 'Produkt usunięty ze sklepu' });
    } catch (err) {
      console.error('my store delete product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
