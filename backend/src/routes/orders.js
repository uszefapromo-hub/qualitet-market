'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { PLAN_CONFIG } = require('./subscriptions');

const router = express.Router();

// Default commission rate: use trial plan's commission_rate as fallback
const PLATFORM_COMMISSION_DEFAULT = PLAN_CONFIG['trial'].commission_rate;

// ─── List orders ───────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const isAdmin = ['owner', 'admin'].includes(req.user.role);

  try {
    const countResult = isAdmin
      ? await db.query('SELECT COUNT(*) FROM orders')
      : await db.query('SELECT COUNT(*) FROM orders WHERE buyer_id = $1 OR store_owner_id = $2', [req.user.id, req.user.id]);

    const total = parseInt(countResult.rows[0].count, 10);

    const result = isAdmin
      ? await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset])
      : await db.query(
          `SELECT * FROM orders
           WHERE buyer_id = $1 OR store_owner_id = $2
           ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
          [req.user.id, req.user.id, limit, offset]
        );

    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('list orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get single order ──────────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req, res) => {
  try {
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

    const isAdmin = ['owner', 'admin'].includes(req.user.role);
    if (!isAdmin && order.buyer_id !== req.user.id && order.store_owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Brak uprawnień' });
    }

    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
    return res.json({ ...order, items: itemsResult.rows });
  } catch (err) {
    console.error('get order error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create order ──────────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  [
    body('store_id').isUUID(),
    body('items').isArray({ min: 1 }),
    body('items.*.product_id').isUUID(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('shipping_address').notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { store_id, items, shipping_address, notes = '' } = req.body;

    try {
      // Validate store exists
      const storeResult = await db.query('SELECT id, owner_id, margin FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      // Get commission rate from active subscription
      const subResult = await db.query(
        `SELECT commission_rate FROM subscriptions
         WHERE shop_id = $1 AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC LIMIT 1`,
        [store_id]
      );
      const commissionRate = subResult.rows[0]
        ? parseFloat(subResult.rows[0].commission_rate)
        : PLATFORM_COMMISSION_DEFAULT;

      // Fetch products and verify stock
      const productIds = items.map((i) => i.product_id);
      const productResult = await db.query(
        `SELECT id, name, selling_price, stock, margin FROM products WHERE id = ANY($1::uuid[]) AND store_id = $2`,
        [productIds, store_id]
      );
      const productMap = Object.fromEntries(productResult.rows.map((p) => [p.id, p]));

      // Validate all products found and have stock
      for (const item of items) {
        const product = productMap[item.product_id];
        if (!product) {
          return res.status(422).json({ error: `Produkt ${item.product_id} nie znaleziony w tym sklepie` });
        }
        if (product.stock < item.quantity) {
          return res.status(422).json({ error: `Niewystarczający stan magazynowy dla: ${product.name}` });
        }
      }

      const createdOrderId = await db.transaction(async (client) => {
        const orderId = uuidv4();
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
          const product = productMap[item.product_id];
          const unitPrice = parseFloat(product.selling_price);
          const lineTotal = unitPrice * item.quantity;
          subtotal += lineTotal;

          orderItems.push({
            id: uuidv4(),
            product_id: item.product_id,
            name: product.name,
            quantity: item.quantity,
            unit_price: unitPrice,
            line_total: lineTotal,
            margin: parseFloat(product.margin),
          });
        }

        const platformMargin = store.margin || parseFloat(process.env.PLATFORM_MARGIN_DEFAULT || '15');
        const platformFee = parseFloat((subtotal * (platformMargin / 100)).toFixed(2));
        const total = parseFloat(subtotal.toFixed(2));

        const platform_commission = parseFloat((subtotal * commissionRate).toFixed(2));
        const seller_revenue = parseFloat((subtotal - platform_commission).toFixed(2));

        await client.query(
          `INSERT INTO orders
             (id, store_id, store_owner_id, buyer_id, status, subtotal, platform_fee,
              platform_commission, seller_revenue, total,
              shipping_address, notes, created_at)
           VALUES ($1,$2,$3,$4,'created',$5,$6,$7,$8,$9,$10,$11,NOW())`,
          [orderId, store_id, store.owner_id, req.user.id, subtotal.toFixed(2), platformFee,
           platform_commission, seller_revenue, total, shipping_address, notes]
        );

        for (const oi of orderItems) {
          await client.query(
            `INSERT INTO order_items (id, order_id, product_id, name, quantity, unit_price, line_total, margin)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [oi.id, orderId, oi.product_id, oi.name, oi.quantity, oi.unit_price, oi.line_total, oi.margin]
          );

          // Decrement stock
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [oi.quantity, oi.product_id]
          );
        }

        return orderId;
      });

      const newOrder = await db.query('SELECT * FROM orders WHERE id = $1', [createdOrderId]);
      const newItems = await db.query('SELECT * FROM order_items WHERE order_id = $1', [createdOrderId]);
      return res.status(201).json({ ...newOrder.rows[0], items: newItems.rows });
    } catch (err) {
      console.error('create order error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update order status ───────────────────────────────────────────────────────

router.patch(
  '/:id/status',
  authenticate,
  [
    param('id').isUUID(),
    body('status').isIn(['created', 'pending', 'paid', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled']),
  ],
  validate,
  async (req, res) => {
    try {
      const orderResult = await db.query('SELECT store_owner_id, status FROM orders WHERE id = $1', [req.params.id]);
      const order = orderResult.rows[0];
      if (!order) return res.status(404).json({ error: 'Zamówienie nie znalezione' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && order.store_owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień' });
      }

      const result = await db.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update order status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
