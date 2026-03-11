'use strict';

const express = require('express');
const { body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// ─── GET /api/cart ─────────────────────────────────────────────────────────────
// Returns the active (open) cart for the current user, with items enriched.

router.get('/', authenticate, async (req, res) => {
  try {
    const cartResult = await db.query(
      `SELECT c.*, s.name AS shop_name, s.slug AS shop_slug
       FROM carts c
       JOIN stores s ON c.shop_id = s.id
       WHERE c.user_id = $1 AND c.status = 'open'
       ORDER BY c.created_at DESC LIMIT 1`,
      [req.user.id]
    );
    const cart = cartResult.rows[0];
    if (!cart) return res.json({ cart: null });

    const itemsResult = await db.query(
      `SELECT
         ci.*,
         COALESCE(sp.custom_title, p.name) AS product_title,
         p.image_url
       FROM cart_items ci
       LEFT JOIN shop_products sp ON ci.shop_product_id = sp.id
       LEFT JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at`,
      [cart.id]
    );

    const subtotal = itemsResult.rows.reduce(
      (sum, item) => sum + parseFloat(item.unit_price) * item.quantity,
      0
    );

    return res.json({
      cart: {
        ...cart,
        items: itemsResult.rows,
        subtotal: parseFloat(subtotal.toFixed(2)),
      },
    });
  } catch (err) {
    console.error('get cart error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/cart ────────────────────────────────────────────────────────────
// Add an item to the cart (creates cart if none open for that shop).
// Body: { shop_product_id, quantity }

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
      // Validate shop_product
      const spResult = await db.query(
        `SELECT sp.*, p.stock, p.id AS global_product_id
         FROM shop_products sp
         JOIN products p ON sp.product_id = p.id
         WHERE sp.id = $1 AND sp.active = TRUE AND sp.status = 'active'`,
        [shop_product_id]
      );
      const sp = spResult.rows[0];
      if (!sp) return res.status(404).json({ error: 'Produkt nie jest dostępny' });

      if (sp.stock < quantity) {
        return res.status(422).json({ error: 'Niewystarczający stan magazynowy' });
      }

      // Find or create open cart for this user + shop
      let cartId;
      const existingCart = await db.query(
        `SELECT id FROM carts WHERE user_id = $1 AND shop_id = $2 AND status = 'open' LIMIT 1`,
        [req.user.id, sp.shop_id]
      );

      if (existingCart.rows.length > 0) {
        cartId = existingCart.rows[0].id;
      } else {
        cartId = uuidv4();
        await db.query(
          `INSERT INTO carts (id, user_id, shop_id, status, created_at)
           VALUES ($1, $2, $3, 'open', NOW())`,
          [cartId, req.user.id, sp.shop_id]
        );
      }

      // Upsert cart item (increment quantity if product already in cart)
      const existingItem = await db.query(
        `SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND shop_product_id = $2`,
        [cartId, shop_product_id]
      );

      if (existingItem.rows.length > 0) {
        const newQty = existingItem.rows[0].quantity + parseInt(quantity, 10);
        if (sp.stock < newQty) {
          return res.status(422).json({ error: 'Niewystarczający stan magazynowy' });
        }
        await db.query(
          `UPDATE cart_items SET quantity = $1 WHERE id = $2`,
          [newQty, existingItem.rows[0].id]
        );
      } else {
        await db.query(
          `INSERT INTO cart_items (id, cart_id, product_id, shop_product_id, quantity, unit_price, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [uuidv4(), cartId, sp.global_product_id, shop_product_id, quantity, sp.selling_price]
        );
      }

      // Update cart timestamp
      await db.query(`UPDATE carts SET updated_at = NOW() WHERE id = $1`, [cartId]);

      // Return updated cart
      const cartResult = await db.query(
        `SELECT c.*, s.name AS shop_name, s.slug AS shop_slug
         FROM carts c JOIN stores s ON c.shop_id = s.id
         WHERE c.id = $1`,
        [cartId]
      );
      const cart = cartResult.rows[0];

      const itemsResult = await db.query(
        `SELECT
           ci.*,
           COALESCE(sp2.custom_title, p.name) AS product_title,
           p.image_url
         FROM cart_items ci
         LEFT JOIN shop_products sp2 ON ci.shop_product_id = sp2.id
         LEFT JOIN products p ON ci.product_id = p.id
         WHERE ci.cart_id = $1
         ORDER BY ci.created_at`,
        [cartId]
      );

      const subtotal = itemsResult.rows.reduce(
        (sum, item) => sum + parseFloat(item.unit_price) * item.quantity,
        0
      );

      return res.status(200).json({
        cart: {
          ...cart,
          items: itemsResult.rows,
          subtotal: parseFloat(subtotal.toFixed(2)),
        },
      });
    } catch (err) {
      console.error('add to cart error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/cart/items/:itemId ───────────────────────────────────────────

router.delete('/items/:itemId', authenticate, async (req, res) => {
  try {
    const itemResult = await db.query(
      `SELECT ci.id, c.user_id FROM cart_items ci JOIN carts c ON ci.cart_id = c.id WHERE ci.id = $1`,
      [req.params.itemId]
    );
    const item = itemResult.rows[0];
    if (!item) return res.status(404).json({ error: 'Pozycja koszyka nie znaleziona' });
    if (item.user_id !== req.user.id) return res.status(403).json({ error: 'Brak uprawnień' });

    await db.query('DELETE FROM cart_items WHERE id = $1', [req.params.itemId]);
    return res.json({ message: 'Pozycja usunięta z koszyka' });
  } catch (err) {
    console.error('remove cart item error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
