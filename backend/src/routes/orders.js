'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate, sanitizeText } = require('../middleware/validate');
const { auditLog } = require('../helpers/audit');

const router = express.Router();

// Default commission rate: 8% (used when platform_settings row is missing)
const PLATFORM_COMMISSION_DEFAULT = parseFloat(process.env.PLATFORM_COMMISSION_DEFAULT || '0.08');

// ─── List orders ───────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const isAdmin = ['owner', 'admin'].includes(req.user.role);

  try {
    const result = isAdmin
      ? await db.query(
          `SELECT *, COUNT(*) OVER() AS total_count FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        )
      : await db.query(
          `SELECT *, COUNT(*) OVER() AS total_count FROM orders
           WHERE buyer_id = $1 OR store_owner_id = $2
           ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
          [req.user.id, req.user.id, limit, offset]
        );

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const orders = result.rows.map(({ total_count, ...rest }) => rest);
    return res.json({ total, page, limit, orders });
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
    // Sanitize user-supplied free-text to prevent stored XSS
    const safeAddress = sanitizeText(shipping_address);
    const safeNotes = sanitizeText(notes);

    try {
      // Validate store exists
      const storeResult = await db.query('SELECT id, owner_id, margin FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      // Get global commission rate from platform settings
      const settingsResult = await db.query(
        `SELECT value FROM platform_settings WHERE key = 'commission_rate'`
      );
      const commissionRate = settingsResult.rows[0]
        ? parseFloat(settingsResult.rows[0].value)
        : PLATFORM_COMMISSION_DEFAULT;

      // Fetch products via shop_products (supports central catalog and store-scoped products).
      // The effective selling_price respects any per-store price_override / margin_override.
      const productIds = items.map((item) => item.product_id);
      const productResult = await db.query(
        `SELECT p.id, p.name, p.stock,
                COALESCE(sp.margin_override, p.margin) AS margin,
                CASE
                  WHEN sp.price_override IS NOT NULL THEN sp.price_override
                  WHEN sp.margin_override IS NOT NULL AND COALESCE(sp.margin_type,'percent') = 'fixed'
                    THEN p.price_gross + sp.margin_override
                  WHEN sp.margin_override IS NOT NULL
                    THEN p.price_gross * (1 + sp.margin_override / 100)
                  ELSE p.selling_price
                END AS selling_price
         FROM products p
         JOIN shop_products sp ON sp.product_id = p.id
         WHERE sp.store_id = $2 AND sp.active = true AND p.id = ANY($1::uuid[])`,
        [productIds, store_id]
      );
      const productMap = Object.fromEntries(productResult.rows.map((product) => [product.id, product]));

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

      const { createdOrder, createdItems } = await db.transaction(async (client) => {
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
        const orderTotal = parseFloat(subtotal.toFixed(2));

        const platform_commission = parseFloat((orderTotal * commissionRate).toFixed(2));
        const seller_revenue = parseFloat((orderTotal - platform_commission).toFixed(2));

        const orderResult = await client.query(
          `INSERT INTO orders
             (id, store_id, store_owner_id, buyer_id, status, subtotal, platform_fee,
              order_total, platform_commission, seller_revenue, total,
              shipping_address, notes, created_at)
           VALUES ($1,$2,$3,$4,'created',$5,$6,$7,$8,$9,$10,$11,$12,NOW())
           RETURNING *`,
          [orderId, store_id, store.owner_id, req.user.id, subtotal.toFixed(2), platformFee,
           orderTotal, platform_commission, seller_revenue, orderTotal, safeAddress, safeNotes]
        );

        // Batch INSERT all order_items in a single query
        const ORDER_ITEM_COLUMN_COUNT = 8; // id, order_id, product_id, name, quantity, unit_price, line_total, margin
        const itemPlaceholders = [];
        const itemValues = [];
        orderItems.forEach((oi, i) => {
          const base = i * ORDER_ITEM_COLUMN_COUNT;
          itemPlaceholders.push(
            `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`
          );
          itemValues.push(oi.id, orderId, oi.product_id, oi.name, oi.quantity, oi.unit_price, oi.line_total, oi.margin);
        });
        const itemsResult = await client.query(
          `INSERT INTO order_items (id, order_id, product_id, name, quantity, unit_price, line_total, margin)
           VALUES ${itemPlaceholders.join(', ')}
           RETURNING *`,
          itemValues
        );

        // Batch UPDATE product stock in a single query using unnest
        const productIds = orderItems.map((oi) => oi.product_id);
        const quantities = orderItems.map((oi) => oi.quantity);
        await client.query(
          `UPDATE products SET stock = stock - updates.qty
           FROM unnest($1::uuid[], $2::int[]) AS updates(pid, qty)
           WHERE products.id = updates.pid`,
          [productIds, quantities]
        );

        return { createdOrder: orderResult.rows[0], createdItems: itemsResult.rows };
      });

      auditLog({
        actorUserId: req.user.id,
        action: 'order.created',
        resource: 'order',
        resourceId: createdOrder.id,
        payload: { store_id, total: createdOrder.total },
        ipAddress: req.ip,
      });
      return res.status(201).json({ ...createdOrder, items: createdItems });
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
