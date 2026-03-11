'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../helpers/audit');

const router = express.Router();

// ─── GET /api/my/orders ────────────────────────────────────────────────────────
// Buyer's own order history.

router.get('/my', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query(
      'SELECT COUNT(*) FROM orders WHERE buyer_id = $1',
      [req.user.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT o.*, s.name AS shop_name, s.slug AS shop_slug
       FROM orders o JOIN stores s ON o.store_id = s.id
       WHERE o.buyer_id = $1
       ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('my orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

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
// Supports two modes:
//   1. cart_id   – checkout an existing open cart (recommended)
//   2. items[]   – legacy: array of { shop_product_id, quantity }

router.post(
  '/',
  authenticate,
  [
    body('shipping_address').notEmpty(),
    body('cart_id').optional({ nullable: true }).isUUID(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.shop_product_id').optional().isUUID(),
    body('items.*.quantity').optional().isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { cart_id, items: rawItems, shipping_address, notes = '' } = req.body;

    if (!cart_id && (!rawItems || rawItems.length === 0)) {
      return res.status(422).json({ error: 'Podaj cart_id lub items[]' });
    }

    try {
      let shopId;
      let lineItems; // [{ shop_product_id, product_id, name, quantity, unit_price, margin_value }]

      if (cart_id) {
        // ── Cart-based checkout ──
        const cartResult = await db.query(
          `SELECT c.*, s.owner_id, s.margin AS store_margin
           FROM carts c JOIN stores s ON c.shop_id = s.id
           WHERE c.id = $1 AND c.user_id = $2 AND c.status = 'open'`,
          [cart_id, req.user.id]
        );
        const cart = cartResult.rows[0];
        if (!cart) return res.status(404).json({ error: 'Koszyk nie znaleziony lub już zamknięty' });

        shopId = cart.shop_id;

        const cartItemsResult = await db.query(
          `SELECT ci.*, sp.selling_price, sp.margin_value,
                  COALESCE(sp.custom_title, p.name) AS name,
                  p.stock
           FROM cart_items ci
           JOIN shop_products sp ON ci.shop_product_id = sp.id
           JOIN products p ON ci.product_id = p.id
           WHERE ci.cart_id = $1`,
          [cart_id]
        );
        if (cartItemsResult.rows.length === 0) {
          return res.status(422).json({ error: 'Koszyk jest pusty' });
        }

        lineItems = cartItemsResult.rows.map((r) => ({
          shop_product_id: r.shop_product_id,
          product_id: r.product_id,
          name: r.name,
          quantity: r.quantity,
          unit_price: parseFloat(r.unit_price),
          margin_value: parseFloat(r.margin_value || 0),
          stock: r.stock,
        }));
      } else {
        // ── Direct items checkout ──
        const spIds = rawItems.map((i) => i.shop_product_id);
        const spResult = await db.query(
          `SELECT sp.id AS shop_product_id, sp.shop_id, sp.selling_price, sp.margin_value,
                  COALESCE(sp.custom_title, p.name) AS name,
                  p.id AS product_id, p.stock
           FROM shop_products sp
           JOIN products p ON sp.product_id = p.id
           WHERE sp.id = ANY($1::uuid[]) AND sp.active = TRUE`,
          [spIds]
        );
        const spMap = Object.fromEntries(spResult.rows.map((r) => [r.shop_product_id, r]));

        // All shop_products must belong to the same shop
        const shopIds = [...new Set(spResult.rows.map((r) => r.shop_id))];
        if (shopIds.length !== 1) {
          return res.status(422).json({ error: 'Wszystkie produkty muszą pochodzić z jednego sklepu' });
        }
        shopId = shopIds[0];

        lineItems = rawItems.map((item) => {
          const sp = spMap[item.shop_product_id];
          if (!sp) throw Object.assign(new Error('Produkt niedostępny lub nie należy do tego sklepu'), { status: 422 });
          return {
            shop_product_id: sp.shop_product_id,
            product_id: sp.product_id,
            name: sp.name,
            quantity: parseInt(item.quantity, 10),
            unit_price: parseFloat(sp.selling_price),
            margin_value: parseFloat(sp.margin_value || 0),
            stock: sp.stock,
          };
        });
      }

      // Validate stock for all items
      for (const item of lineItems) {
        if (item.stock < item.quantity) {
          return res.status(422).json({ error: `Niewystarczający stan magazynowy dla: ${item.name}` });
        }
      }

      // Fetch store info for platform fee calculation
      const storeResult = await db.query(
        'SELECT id, owner_id, margin FROM stores WHERE id = $1',
        [shopId]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      let createdOrderId;

      await db.transaction(async (client) => {
        const orderId = uuidv4();
        let subtotal = 0;

        for (const item of lineItems) {
          const lineTotal = item.unit_price * item.quantity;
          subtotal += lineTotal;

          await client.query(
            `INSERT INTO order_items
               (id, order_id, product_id, shop_product_id, name, quantity, unit_price, line_total, margin)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              uuidv4(), orderId, item.product_id, item.shop_product_id,
              item.name, item.quantity, item.unit_price, lineTotal, item.margin_value,
            ]
          );

          // Decrement global product stock
          await client.query(
            'UPDATE products SET stock = stock - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }

        const platformMargin = parseFloat(store.margin) || parseFloat(process.env.PLATFORM_MARGIN_DEFAULT || '15');
        const platformFee = parseFloat((subtotal * (platformMargin / 100)).toFixed(2));
        const total = parseFloat(subtotal.toFixed(2));

        await client.query(
          `INSERT INTO orders
             (id, store_id, store_owner_id, buyer_id, status, payment_status, subtotal,
              platform_fee, total, shipping_address, notes, created_at)
           VALUES ($1,$2,$3,$4,'pending','unpaid',$5,$6,$7,$8,$9,NOW())`,
          [orderId, store.id, store.owner_id, req.user.id, subtotal.toFixed(2), platformFee, total, shipping_address, notes]
        );

        // Mark cart as checked_out
        if (cart_id) {
          await client.query(
            `UPDATE carts SET status = 'checked_out', updated_at = NOW() WHERE id = $1`,
            [cart_id]
          );
        }

        createdOrderId = orderId;
      });

      // Audit log
      await auditLog({
        actorUserId: req.user.id,
        entityType: 'order',
        entityId: createdOrderId,
        action: 'create',
        payload: { store_id: store.id },
      });

      const newOrder = await db.query(
        `SELECT o.*, s.name AS shop_name FROM orders o JOIN stores s ON o.store_id = s.id WHERE o.id = $1`,
        [createdOrderId]
      );
      const newItems = await db.query('SELECT * FROM order_items WHERE order_id = $1', [createdOrderId]);
      return res.status(201).json({ ...newOrder.rows[0], items: newItems.rows });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
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
    body('status').isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']),
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

      await auditLog({
        actorUserId: req.user.id,
        entityType: 'order',
        entityId: req.params.id,
        action: 'status_change',
        payload: { previous: order.status, next: req.body.status },
      });

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update order status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
