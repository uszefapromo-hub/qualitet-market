'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../helpers/audit');

const router = express.Router();

// ─── Helper: compute selling_price ────────────────────────────────────────────

function computeSellingPrice(basePrice, marginType, marginValue) {
  const base = parseFloat(basePrice);
  const mv = parseFloat(marginValue);
  if (marginType === 'fixed') {
    return parseFloat((base + mv).toFixed(2));
  }
  // default: percent
  return parseFloat((base * (1 + mv / 100)).toFixed(2));
}

// ─── GET /api/shops/:slug/products ────────────────────────────────────────────
// Public – list active shop_products for a given store slug.

router.get('/shops/:slug/products', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const search = req.query.search || null;
  const categoryId = req.query.category_id || null;

  try {
    const storeResult = await db.query(
      `SELECT id, name, slug, description, logo_url FROM stores WHERE slug = $1 AND status = 'active'`,
      [req.params.slug]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

    const conditions = [`sp.store_id = $1`, `sp.active = TRUE`, `sp.status = 'active'`];
    const params = [store.id];
    let idx = 2;

    if (search) {
      conditions.push(
        `(COALESCE(sp.custom_title, p.name) ILIKE $${idx} OR COALESCE(sp.custom_description, p.description) ILIKE $${idx})`
      );
      params.push(`%${search}%`);
      idx++;
    }

    if (categoryId) {
      conditions.push(`p.category_id = $${idx++}`);
      params.push(categoryId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT
         sp.id,
         sp.store_id,
         sp.product_id,
         COALESCE(sp.custom_title, p.name)               AS title,
         COALESCE(sp.custom_description, p.description)  AS description,
         sp.selling_price,
         sp.margin_type,
         sp.margin_value,
         sp.status,
         sp.active,
         p.sku,
         p.price_net,
         p.tax_rate,
         p.price_gross,
         p.stock,
         p.image_url,
         p.category_id,
         c.name AS category_name
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY sp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, store, products: result.rows });
  } catch (err) {
    console.error('get shop products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/my/store/products ───────────────────────────────────────────────
// Authenticated seller – list their own shop_products.

router.get('/my/store/products', authenticate, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const storeResult = await db.query(
      `SELECT id FROM stores WHERE owner_id = $1 AND status != 'suspended' LIMIT 1`,
      [req.user.id]
    );
    const store = storeResult.rows[0];
    if (!store) return res.status(404).json({ error: 'Nie znaleziono Twojego sklepu' });

    const countResult = await db.query(
      `SELECT COUNT(*) FROM shop_products WHERE store_id = $1`,
      [store.id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT
         sp.*,
         p.name AS base_name,
         p.sku,
         p.price_net,
         p.price_gross,
         p.stock,
         p.image_url,
         p.status AS product_status
       FROM shop_products sp
       JOIN products p ON sp.product_id = p.id
       WHERE sp.store_id = $1
       ORDER BY sp.created_at DESC
       LIMIT $2 OFFSET $3`,
      [store.id, limit, offset]
    );

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('list my store products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/my/store/products ──────────────────────────────────────────────
// Add a global product to the seller's store.

router.post(
  '/my/store/products',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    body('product_id').isUUID(),
    body('custom_title').optional({ nullable: true }).trim(),
    body('custom_description').optional({ nullable: true }).trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_value').optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const {
      product_id,
      custom_title = null,
      custom_description = null,
      margin_type = 'percent',
      margin_value = 0,
    } = req.body;

    try {
      const storeResult = await db.query(
        `SELECT id, margin FROM stores WHERE owner_id = $1 AND status != 'suspended' LIMIT 1`,
        [req.user.id]
      );
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Nie znaleziono Twojego sklepu' });

      const productResult = await db.query(
        `SELECT id, name, description, price_gross, price_net, tax_rate, sku, stock, image_url, category_id
         FROM products WHERE id = $1 AND status = 'active'`,
        [product_id]
      );
      const product = productResult.rows[0];
      if (!product) return res.status(404).json({ error: 'Produkt nie znaleziony w katalogu' });

      const dupCheck = await db.query(
        `SELECT id FROM shop_products WHERE store_id = $1 AND product_id = $2`,
        [store.id, product_id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Ten produkt jest już w Twoim sklepie' });
      }

      const effectiveMarginValue = margin_value != null
        ? parseFloat(margin_value)
        : (parseFloat(store.margin) || 0);
      const selling_price = computeSellingPrice(product.price_gross, margin_type, effectiveMarginValue);

      const source_snapshot = {
        name: product.name,
        price_gross: product.price_gross,
        price_net: product.price_net,
        tax_rate: product.tax_rate,
        sku: product.sku,
        captured_at: new Date().toISOString(),
      };

      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO shop_products
           (id, store_id, product_id, custom_title, custom_description,
            margin_type, margin_value, selling_price, active, status, source_snapshot, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,'active',$9,NOW())
         RETURNING *`,
        [
          id, store.id, product_id, custom_title, custom_description,
          margin_type, effectiveMarginValue, selling_price,
          JSON.stringify(source_snapshot),
        ]
      );

      await auditLog({
        actorUserId: req.user.id,
        entityType: 'shop_product',
        entityId: id,
        action: 'create',
        payload: { store_id: store.id, product_id },
      });

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/my/store/products/:id ─────────────────────────────────────────

router.patch(
  '/my/store/products/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  [
    param('id').isUUID(),
    body('custom_title').optional({ nullable: true }).trim(),
    body('custom_description').optional({ nullable: true }).trim(),
    body('margin_type').optional().isIn(['percent', 'fixed']),
    body('margin_value').optional().isFloat({ min: 0 }),
    body('active').optional().isBoolean(),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
  ],
  validate,
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.*, s.owner_id, p.price_gross
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

      const { custom_title, custom_description, margin_type, margin_value, active, status } = req.body;

      // Recalculate selling_price if margin changes
      let newSellingPrice = null;
      if (margin_type !== undefined || margin_value !== undefined) {
        const mt = margin_type !== undefined ? margin_type : sp.margin_type;
        const mv = margin_value !== undefined ? margin_value : sp.margin_value;
        newSellingPrice = computeSellingPrice(sp.price_gross, mt, mv);
      }

      const result = await db.query(
        `UPDATE shop_products SET
           custom_title       = COALESCE($1, custom_title),
           custom_description = COALESCE($2, custom_description),
           margin_type        = COALESCE($3, margin_type),
           margin_value       = COALESCE($4, margin_value),
           selling_price      = COALESCE($5, selling_price),
           active             = COALESCE($6, active),
           status             = COALESCE($7, status),
           updated_at         = NOW()
         WHERE id = $8
         RETURNING *`,
        [
          custom_title !== undefined ? custom_title : null,
          custom_description !== undefined ? custom_description : null,
          margin_type !== undefined ? margin_type : null,
          margin_value !== undefined ? margin_value : null,
          newSellingPrice,
          active !== undefined ? active : null,
          status !== undefined ? status : null,
          req.params.id,
        ]
      );

      await auditLog({
        actorUserId: req.user.id,
        entityType: 'shop_product',
        entityId: req.params.id,
        action: 'update',
        payload: req.body,
      });

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/my/store/products/:id ────────────────────────────────────────

router.delete(
  '/my/store/products/:id',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    try {
      const spResult = await db.query(
        `SELECT sp.id, s.owner_id
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

      await auditLog({
        actorUserId: req.user.id,
        entityType: 'shop_product',
        entityId: req.params.id,
        action: 'delete',
      });

      return res.json({ message: 'Produkt usunięty ze sklepu' });
    } catch (err) {
      console.error('delete shop product error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Legacy: GET /api/shop-products – list by store_id query param ────────────

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
              COALESCE(sp.custom_title, p.name) AS name,
              p.sku, COALESCE(sp.custom_description, p.description) AS description,
              p.category, p.image_url, p.stock,
              COALESCE(sp.selling_price, p.selling_price) AS price,
              COALESCE(sp.margin_value, p.margin)         AS margin
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

// ─── Legacy: POST /api/shop-products ─────────────────────────────────────────

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
      const storeResult = await db.query('SELECT owner_id FROM stores WHERE id = $1', [store_id]);
      const store = storeResult.rows[0];
      if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

      const isAdmin = ['owner', 'admin'].includes(req.user.role);
      if (!isAdmin && store.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
      }

      const productResult = await db.query('SELECT id FROM products WHERE id = $1', [product_id]);
      if (!productResult.rows[0]) {
        return res.status(404).json({ error: 'Produkt nie znaleziony' });
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

// ─── Legacy: PUT /api/shop-products/:id ──────────────────────────────────────

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
        `SELECT sp.*, s.owner_id FROM shop_products sp
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

// ─── Legacy: DELETE /api/shop-products/:id ────────────────────────────────────

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
