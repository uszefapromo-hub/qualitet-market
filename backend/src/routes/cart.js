'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── Helper: get or create active cart ────────────────────────────────────────

async function getOrCreateCart(userId, storeId) {
  const existing = await db.query(
    `SELECT * FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'active' LIMIT 1`,
    [userId, storeId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const id = uuidv4();
  const result = await db.query(
    `INSERT INTO carts (id, user_id, store_id, status, created_at)
     VALUES ($1, $2, $3, 'active', NOW())
     RETURNING *`,
    [id, userId, storeId]
  );
  return result.rows[0];
}

// ─── Helper: build cart response with items ────────────────────────────────────

async function cartWithItems(cartId) {
  const cartResult = await db.query('SELECT * FROM carts WHERE id = $1', [cartId]);
  const cart = cartResult.rows[0];
  if (!cart) return null;

  const itemsResult = await db.query(
    `SELECT ci.*, p.name, p.image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at ASC`,
    [cartId]
  );
  const items = itemsResult.rows;
  const total = items.reduce((sum, i) => sum + parseFloat(i.unit_price) * i.quantity, 0);
  return { ...cart, items, total: parseFloat(total.toFixed(2)) };
}

// ─── GET /api/cart – get active cart (requires store_id query param) ──────────

router.get('/', authenticate, async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(422).json({ error: 'Wymagany parametr: store_id' });

  try {
    const cartResult = await db.query(
      `SELECT * FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'active' LIMIT 1`,
      [req.user.id, store_id]
    );
    if (!cartResult.rows[0]) {
      return res.json({ items: [], total: 0 });
    }
    const cart = await cartWithItems(cartResult.rows[0].id);
    return res.json(cart);
  } catch (err) {
    console.error('get cart error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/cart – add item by shop_product_id (simplified cart flow) ──────
// This is the primary cart endpoint for the customer purchase flow.
// It accepts a shop_product_id instead of a raw product_id.

router.post(
  '/',
  authenticate,
  [
    body('shop_product_id').isUUID(),
    body('quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { shop_product_id, quantity } = req.body;

    try {
      // Resolve shop product to get store, product, and effective price
      const spResult = await db.query(
        `SELECT sp.id, sp.store_id, sp.product_id, sp.active,
                COALESCE(sp.price_override, p.selling_price) AS effective_price,
                p.stock, p.name
         FROM shop_products sp
         JOIN products p ON sp.product_id = p.id
         WHERE sp.id = $1 AND sp.active = true`,
        [shop_product_id]
      );
      const sp = spResult.rows[0];
      if (!sp) {
        return res.status(404).json({ error: 'Produkt nie znaleziony' });
      }

      if (sp.stock < quantity) {
        return res.status(422).json({ error: `Niewystarczający stan magazynowy: ${sp.name}` });
      }

      const cart = await getOrCreateCart(req.user.id, sp.store_id);

      // Upsert cart item
      const existing = await db.query(
        'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cart.id, sp.product_id]
      );

      if (existing.rows[0]) {
        const newQty = existing.rows[0].quantity + quantity;
        if (sp.stock < newQty) {
          return res.status(422).json({ error: `Niewystarczający stan magazynowy: ${sp.name}` });
        }
        await db.query(
          'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
          [newQty, existing.rows[0].id]
        );
      } else {
        const itemId = uuidv4();
        await db.query(
          `INSERT INTO cart_items (id, cart_id, product_id, quantity, unit_price, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [itemId, cart.id, sp.product_id, quantity, sp.effective_price]
        );
      }

      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);
      const updatedCart = await cartWithItems(cart.id);
      return res.status(201).json(updatedCart);
    } catch (err) {
      console.error('post cart error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/cart/:itemId – remove a specific cart item by item UUID ──────

router.delete(
  '/items/:itemId',
  authenticate,
  [param('itemId').isUUID()],
  validate,
  async (req, res) => {
    const { itemId } = req.params;

    try {
      // Ensure the item belongs to the authenticated user
      const itemResult = await db.query(
        `SELECT ci.id, ci.cart_id
         FROM cart_items ci
         JOIN carts c ON ci.cart_id = c.id
         WHERE ci.id = $1 AND c.user_id = $2 AND c.status = 'active'`,
        [itemId, req.user.id]
      );
      const item = itemResult.rows[0];
      if (!item) return res.status(404).json({ error: 'Element koszyka nie znaleziony' });

      await db.query('DELETE FROM cart_items WHERE id = $1', [item.id]);
      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [item.cart_id]);

      const updatedCart = await cartWithItems(item.cart_id);
      return res.json(updatedCart);
    } catch (err) {
      console.error('delete cart item error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

router.post(
  '/items',
  authenticate,
  [
    body('store_id').isUUID(),
    body('product_id').isUUID(),
    body('quantity').isInt({ min: 1 }),
  ],
  validate,
  async (req, res) => {
    const { store_id, product_id, quantity } = req.body;

    try {
      // Resolve product: first try store-scoped, then central catalogue via shop_products
      let product = null;
      let unitPrice = null;

      const directResult = await db.query(
        'SELECT id, selling_price, stock, name FROM products WHERE id = $1 AND store_id = $2',
        [product_id, store_id]
      );

      if (directResult.rows[0]) {
        product = directResult.rows[0];
        unitPrice = product.selling_price;
      } else {
        // Central catalogue: product must be linked to store via shop_products
        const spResult = await db.query(
          `SELECT p.id, p.stock, p.name, p.selling_price,
                  COALESCE(sp.price_override, p.selling_price) AS effective_price
           FROM shop_products sp
           JOIN products p ON sp.product_id = p.id
           WHERE sp.store_id = $1 AND sp.product_id = $2 AND sp.active = true`,
          [store_id, product_id]
        );
        if (spResult.rows[0]) {
          product = spResult.rows[0];
          unitPrice = spResult.rows[0].effective_price;
        }
      }

      if (!product) {
        return res.status(404).json({ error: 'Produkt nie znaleziony w tym sklepie' });
      }
      if (product.stock < quantity) {
        return res.status(422).json({ error: `Niewystarczający stan magazynowy: ${product.name}` });
      }

      const cart = await getOrCreateCart(req.user.id, store_id);

      // Upsert cart item
      const existing = await db.query(
        'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
        [cart.id, product_id]
      );

      if (existing.rows[0]) {
        const newQty = existing.rows[0].quantity + quantity;
        if (product.stock < newQty) {
          return res.status(422).json({ error: `Niewystarczający stan magazynowy: ${product.name}` });
        }
        await db.query(
          'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2',
          [newQty, existing.rows[0].id]
        );
      } else {
        const itemId = uuidv4();
        await db.query(
          `INSERT INTO cart_items (id, cart_id, product_id, quantity, unit_price, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [itemId, cart.id, product_id, quantity, unitPrice]
        );
      }

      // Touch cart updated_at
      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);

      const updatedCart = await cartWithItems(cart.id);
      return res.status(201).json(updatedCart);
    } catch (err) {
      console.error('add cart item error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PUT /api/cart/items/:productId – update item quantity ────────────────────

router.put(
  '/items/:productId',
  authenticate,
  [
    param('productId').isUUID(),
    body('store_id').isUUID(),
    body('quantity').isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { store_id, quantity } = req.body;
    const { productId } = req.params;

    try {
      const cartResult = await db.query(
        `SELECT * FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'active' LIMIT 1`,
        [req.user.id, store_id]
      );
      const cart = cartResult.rows[0];
      if (!cart) return res.status(404).json({ error: 'Koszyk nie znaleziony' });

      if (quantity === 0) {
        await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart.id, productId]);
      } else {
        const productResult = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
        const product = productResult.rows[0];
        if (product && product.stock < quantity) {
          return res.status(422).json({ error: 'Niewystarczający stan magazynowy' });
        }
        await db.query(
          'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE cart_id = $2 AND product_id = $3',
          [quantity, cart.id, productId]
        );
      }

      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);
      const updatedCart = await cartWithItems(cart.id);
      return res.json(updatedCart);
    } catch (err) {
      console.error('update cart item error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/cart/items/:productId – remove item ─────────────────────────

router.delete(
  '/items/:productId',
  authenticate,
  [
    param('productId').isUUID(),
    body('store_id').isUUID(),
  ],
  validate,
  async (req, res) => {
    const { store_id } = req.body;
    const { productId } = req.params;

    try {
      const cartResult = await db.query(
        `SELECT id FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'active' LIMIT 1`,
        [req.user.id, store_id]
      );
      const cart = cartResult.rows[0];
      if (!cart) return res.status(404).json({ error: 'Koszyk nie znaleziony' });

      await db.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart.id, productId]);
      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);

      const updatedCart = await cartWithItems(cart.id);
      return res.json(updatedCart);
    } catch (err) {
      console.error('delete cart item error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/cart – clear cart ────────────────────────────────────────────

router.delete(
  '/',
  authenticate,
  [body('store_id').isUUID()],
  validate,
  async (req, res) => {
    const { store_id } = req.body;

    try {
      const cartResult = await db.query(
        `SELECT id FROM carts WHERE user_id = $1 AND store_id = $2 AND status = 'active' LIMIT 1`,
        [req.user.id, store_id]
      );
      const cart = cartResult.rows[0];
      if (!cart) return res.json({ items: [], total: 0 });

      await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.id]);
      await db.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.id]);

      return res.json({ items: [], total: 0 });
    } catch (err) {
      console.error('clear cart error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;
