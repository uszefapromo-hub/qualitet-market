'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { parse: csvParse } = require('csv-parse/sync');
const xml2js = require('xml2js');
const fetch = require('node-fetch');

const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const DEFAULT_TAX_RATE = 23;
const MAX_UPLOAD_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// ─── GET /api/admin/dashboard – comprehensive platform metrics ────────────────

router.get('/dashboard', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const [
      // sellers
      totalSellersResult,
      activeShopsResult,
      shopsWithProductsResult,
      shopsWithOrdersResult,
      // customers / orders
      totalOrdersResult,
      totalCustomersResult,
      avgOrderResult,
      todayOrdersResult,
      monthOrdersResult,
      // products
      globalProductsResult,
      activeShopProductsResult,
      // revenue
      revenueResult,
    ] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'seller'`),
      db.query(`SELECT COUNT(*) FROM stores WHERE status = 'active'`),
      db.query(`SELECT COUNT(DISTINCT store_id) FROM shop_products WHERE active = true`),
      db.query(`SELECT COUNT(DISTINCT store_id) FROM orders`),
      db.query(`SELECT COUNT(*) FROM orders`),
      db.query(`SELECT COUNT(DISTINCT buyer_id) FROM orders`),
      db.query(`SELECT COALESCE(AVG(total), 0) AS avg FROM orders WHERE status != 'cancelled'`),
      db.query(`SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE`),
      db.query(`SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('month', NOW())`),
      db.query(`SELECT COUNT(*) FROM products`),
      db.query(`SELECT COUNT(*) FROM shop_products WHERE active = true`),
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != 'cancelled'`),
    ]);

    return res.json({
      sellers: {
        total_registrations:       parseInt(totalSellersResult.rows[0].count, 10),
        active_shops:              parseInt(activeShopsResult.rows[0].count, 10),
        shops_with_products:       parseInt(shopsWithProductsResult.rows[0].count, 10),
        shops_with_orders:         parseInt(shopsWithOrdersResult.rows[0].count, 10),
      },
      customers: {
        total_orders:              parseInt(totalOrdersResult.rows[0].count, 10),
        total_customers:           parseInt(totalCustomersResult.rows[0].count, 10),
        avg_order_value:           parseFloat(parseFloat(avgOrderResult.rows[0].avg).toFixed(2)),
        orders_today:              parseInt(todayOrdersResult.rows[0].count, 10),
        orders_this_month:         parseInt(monthOrdersResult.rows[0].count, 10),
      },
      products: {
        global_products:           parseInt(globalProductsResult.rows[0].count, 10),
        active_shop_products:      parseInt(activeShopProductsResult.rows[0].count, 10),
      },
      revenue:                     parseFloat(revenueResult.rows[0].revenue),
    });
  } catch (err) {
    console.error('admin dashboard error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/stats – legacy alias for dashboard ───────────────────────

router.get('/stats', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const [
      usersResult,
      storesResult,
      productsResult,
      catalogueResult,
      ordersResult,
      revenueResult,
      pendingOrdersResult,
    ] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM stores WHERE status = $1', ['active']),
      db.query('SELECT COUNT(*) FROM products'),
      db.query('SELECT COUNT(*) FROM products WHERE is_central = true'),
      db.query('SELECT COUNT(*) FROM orders'),
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != $1`, ['cancelled']),
      db.query(`SELECT COUNT(*) FROM orders WHERE status = $1`, ['pending']),
    ]);

    return res.json({
      users:               parseInt(usersResult.rows[0].count, 10),
      active_stores:       parseInt(storesResult.rows[0].count, 10),
      products:            parseInt(productsResult.rows[0].count, 10),
      central_catalogue:   parseInt(catalogueResult.rows[0].count, 10),
      orders:              parseInt(ordersResult.rows[0].count, 10),
      revenue:             parseFloat(revenueResult.rows[0].revenue),
      pending_orders:      parseInt(pendingOrdersResult.rows[0].count, 10),
    });
  } catch (err) {
    console.error('admin stats error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/users – all users (paginated) ─────────────────────────────

router.get('/users', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const role   = req.query.role   || null;
  const search = req.query.search || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (role)   { conditions.push(`role = $${idx++}`);                                  params.push(role); }
    if (search) { conditions.push(`(email ILIKE $${idx} OR name ILIKE $${idx})`);       params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, email, name, role, plan, trial_ends_at, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, users: result.rows });
  } catch (err) {
    console.error('admin list users error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/users/:id – update user role / plan ────────────────────

router.patch(
  '/users/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('role').optional().isIn(['buyer', 'seller', 'admin', 'owner']),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
    body('name').optional().trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    const { role, plan, name } = req.body;

    try {
      const result = await db.query(
        `UPDATE users SET
           role       = COALESCE($1, role),
           plan       = COALESCE($2, plan),
           name       = COALESCE($3, name),
           updated_at = NOW()
         WHERE id = $4
         RETURNING id, email, name, role, plan, trial_ends_at, created_at`,
        [role || null, plan || null, name || null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update user error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/users/:id – delete user ────────────────────────────────

router.delete('/users/:id', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Użytkownik nie znaleziony' });
    return res.json({ message: 'Użytkownik usunięty' });
  } catch (err) {
    console.error('admin delete user error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/orders – all orders (paginated, filterable by status) ─────

router.get('/orders', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM orders ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, orders: result.rows });
  } catch (err) {
    console.error('admin list orders error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/stores – all stores (paginated) ───────────────────────────

router.get('/stores', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE s.status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM stores s ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS owner_email, u.name AS owner_name
       FROM stores s
       LEFT JOIN users u ON s.owner_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, stores: result.rows });
  } catch (err) {
    console.error('admin list stores error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/shops – alias for /api/admin/stores ───────────────────────

router.get('/shops', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;
  const search = req.query.search || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status) { conditions.push(`s.status = $${idx++}`); params.push(status); }
    if (search) {
      conditions.push(`(s.name ILIKE $${idx} OR s.slug ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM stores s ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS owner_email, u.name AS owner_name
       FROM stores s
       LEFT JOIN users u ON s.owner_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, shops: result.rows });
  } catch (err) {
    console.error('admin list shops error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/suppliers – all suppliers (paginated) ────────────────────

router.get('/suppliers', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset = (page - 1) * limit;
  const search = req.query.search || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`name ILIKE $${idx++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM suppliers ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT * FROM suppliers ${where}
       ORDER BY name ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, suppliers: result.rows });
  } catch (err) {
    console.error('admin list suppliers error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/stores/:id/status – change store status ─────────────────

router.patch(
  '/stores/:id/status',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['active', 'inactive', 'suspended', 'pending']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE stores SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

router.patch(
  '/stores/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
    body('plan').optional().isIn(['basic', 'pro', 'elite']),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { status, plan, margin } = req.body;

    try {
      const result = await db.query(
        `UPDATE stores SET
           status     = COALESCE($1, status),
           plan       = COALESCE($2, plan),
           margin     = COALESCE($3, margin),
           updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, slug, status, plan, margin, owner_id, updated_at`,
        [status || null, plan || null, margin !== undefined ? margin : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/subscriptions – all subscriptions (paginated) ─────────────

router.get('/subscriptions', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  const status = req.query.status || null;

  try {
    const where = status ? 'WHERE s.status = $1' : '';
    const params = status ? [status] : [];

    const countResult = await db.query(`SELECT COUNT(*) FROM subscriptions s ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*, u.email AS user_email, u.name AS user_name
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, subscriptions: result.rows });
  } catch (err) {
    console.error('admin list subscriptions error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/catalogue – central catalogue products (paginated) ─────────

router.get('/catalogue', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit    = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset   = (page - 1) * limit;
  const category = req.query.category || null;
  const search   = req.query.search   || null;

  try {
    const conditions = ['is_central = true'];
    const params = [];
    let idx = 1;

    if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) FROM products ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS supplier_name
       FROM products p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin catalogue error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/products – all products (paginated) ───────────────────────

router.get('/products', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page      = Math.max(1, parseInt(req.query.page   || '1',  10));
  const limit     = Math.min(100, parseInt(req.query.limit  || '20', 10));
  const offset    = (page - 1) * limit;
  const status    = req.query.status    || null;
  const isCentral = req.query.is_central != null ? req.query.is_central === 'true' : null;
  const search    = req.query.search    || null;

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (status)            { conditions.push(`p.status = $${idx++}`);                                   params.push(status); }
    if (isCentral !== null){ conditions.push(`p.is_central = $${idx++}`);                               params.push(isCentral); }
    if (search)            { conditions.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);          params.push(`%${search}%`); idx++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS store_name
       FROM products p
       LEFT JOIN stores s ON p.store_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin list products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/products/:id/status – set product status ────────────────

router.patch(
  '/products/:id/status',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('status').isIn(['draft', 'pending', 'active', 'archived']),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [req.body.status, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update product status error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/audit-logs – audit log (paginated) ────────────────────────

router.get('/audit-logs', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const countResult = await db.query('SELECT COUNT(*) FROM audit_logs');
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return res.json({ total, page, limit, logs: result.rows });
  } catch (err) {
    console.error('admin audit logs error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/admin/products/import – bulk import into central catalogue ──────
// Accepts multipart/form-data with a `file` (CSV or XML).
// Optionally accepts `supplier_id` and `margin` query/body params.

router.post(
  '/products/import',
  authenticate,
  requireRole('owner', 'admin'),
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(422).json({ error: 'Plik jest wymagany (multipart: file)' });
    }

    const supplierId = req.body.supplier_id || null;
    const margin = parseFloat(req.body.margin || process.env.PLATFORM_MARGIN_DEFAULT || '15');

    try {
      const content = req.file.buffer.toString('utf-8');
      const contentType = req.file.mimetype || '';
      const filename = req.file.originalname || '';

      let rawProducts;
      if (contentType.includes('xml') || filename.endsWith('.xml')) {
        rawProducts = await adminParseXmlProducts(content);
      } else {
        rawProducts = adminParseCsvProducts(content);
      }

      const count = await upsertCentralProducts(rawProducts, supplierId, margin);
      return res.json({ message: `Zaimportowano ${count} produktów do katalogu centralnego`, count });
    } catch (err) {
      console.error('admin products import error:', err.message);
      return res.status(500).json({ error: 'Błąd importu: ' + err.message });
    }
  }
);

// ─── Helpers – parse / upsert for central catalogue ──────────────────────────

function adminParseCsvProducts(content) {
  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records.map((r) => ({
    sku:         r.sku || r.SKU || r.id || null,
    name:        r.name || r.nazwa || r.Name || '',
    price_net:   parseFloat(r.price_net || r.cena_netto || r.price || 0),
    tax_rate:    parseFloat(r.tax_rate || r.vat || r.VAT || DEFAULT_TAX_RATE),
    stock:       parseInt(r.stock || r.stan || 0, 10),
    category:    r.category || r.kategoria || null,
    description: r.description || r.opis || '',
    image_url:   r.image_url || r.zdjecie || r.image || null,
  }));
}

async function adminParseXmlProducts(content) {
  const parsed = await xml2js.parseStringPromise(content, { explicitArray: false });
  const rootKey = Object.keys(parsed)[0];
  const root = parsed[rootKey];
  let items = root.product || root.products?.product || root.item || root.items?.item || [];
  if (!Array.isArray(items)) items = [items];

  return items.map((item) => ({
    sku:         item.sku || item.id || item.kod || null,
    name:        item.name || item.nazwa || item.title || '',
    price_net:   parseFloat(item.price_net || item.cena_netto || item.price || 0),
    tax_rate:    parseFloat(item.tax_rate || item.vat || item.stawka_vat || DEFAULT_TAX_RATE),
    stock:       parseInt(item.stock || item.stan || item.quantity || 0, 10),
    category:    item.category || item.kategoria || null,
    description: item.description || item.opis || '',
    image_url:   item.image_url || item.zdjecie || item.img || null,
  }));
}

async function adminFetchApiProducts(supplier) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (supplier.api_key) headers['Authorization'] = `Bearer ${supplier.api_key}`;
    response = await fetch(supplier.api_url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) throw new Error(`API returned ${response.status}`);

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('xml')) return adminParseXmlProducts(await response.text());
  if (ct.includes('csv')) return adminParseCsvProducts(await response.text());

  const json = await response.json();
  const items = Array.isArray(json) ? json : json.products || json.items || json.data || [];
  return items.map((item) => ({
    sku:         item.sku || item.id || null,
    name:        item.name || item.nazwa || '',
    price_net:   parseFloat(item.price_net || item.price || 0),
    tax_rate:    parseFloat(item.tax_rate || item.vat || DEFAULT_TAX_RATE),
    stock:       parseInt(item.stock || item.quantity || 0, 10),
    category:    item.category || item.kategoria || null,
    description: item.description || item.opis || '',
    image_url:   item.image_url || item.image || null,
  }));
}

/**
 * Upsert products into the central catalogue (is_central=true, store_id=NULL).
 * Matches by SKU when available; otherwise always inserts.
 */
async function upsertCentralProducts(rawProducts, supplierId, margin) {
  let count = 0;
  for (const raw of rawProducts) {
    if (!raw.name) continue;
    const priceGross    = raw.price_net * (1 + raw.tax_rate / 100);
    const sellingPrice  = priceGross * (1 + margin / 100);

    if (raw.sku) {
      const existing = await db.query(
        'SELECT id FROM products WHERE is_central = true AND sku = $1',
        [raw.sku]
      );
      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE products SET
             name          = $1,
             price_net     = $2,
             tax_rate      = $3,
             price_gross   = $4,
             selling_price = $5,
             margin        = $6,
             stock         = $7,
             category      = COALESCE($8, category),
             description   = COALESCE($9, description),
             image_url     = COALESCE($10, image_url),
             updated_at    = NOW()
           WHERE is_central = true AND sku = $11`,
          [raw.name, raw.price_net, raw.tax_rate,
           priceGross.toFixed(2), sellingPrice.toFixed(2),
           margin, raw.stock, raw.category, raw.description, raw.image_url,
           raw.sku]
        );
        count++;
        continue;
      }
    }

    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, is_central, name, sku, price_net, tax_rate,
          price_gross, selling_price, margin, stock, category, description, image_url, created_at)
       VALUES ($1,NULL,$2,true,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
      [uuidv4(), supplierId, raw.name, raw.sku || null,
       raw.price_net, raw.tax_rate,
       priceGross.toFixed(2), sellingPrice.toFixed(2),
       margin, raw.stock, raw.category, raw.description, raw.image_url]
    );
    count++;
  }
  return count;
}

module.exports = router;

