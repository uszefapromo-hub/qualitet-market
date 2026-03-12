'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { parse: csvParse } = require('csv-parse/sync');
const xml2js = require('xml2js');
const fetch = require('node-fetch');

const db = require('../config/database');
const { authenticate, requireRole, requireSuperAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { PLAN_CONFIG } = require('./subscriptions');
const { upsertSupplierProducts, fetchSupplierProducts } = require('../services/supplier-import');
const { computePlatformPrice, dbTiersToArray, DEFAULT_PLATFORM_TIERS } = require('../helpers/pricing');

const router = express.Router();

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
      revenueTodayResult,
      revenueMonthResult,
      // referrals
      referralCountResult,
      // promo slots
      promoTier1Result,
      promoTier2Result,
      promoTier3Result,
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
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != 'cancelled' AND created_at >= CURRENT_DATE`),
      db.query(`SELECT COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status != 'cancelled' AND created_at >= date_trunc('month', NOW())`),
      db.query(`SELECT COUNT(*) FROM referral_uses`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'seller' AND promo_tier = 1`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'seller' AND promo_tier = 2`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'seller' AND promo_tier = 3`),
    ]);

    const sellerCount = parseInt(totalSellersResult.rows[0].count, 10);
    const tier1Used   = parseInt(promoTier1Result.rows[0].count, 10);
    const tier2Used   = parseInt(promoTier2Result.rows[0].count, 10);
    const tier3Used   = parseInt(promoTier3Result.rows[0].count, 10);

    return res.json({
      sellers: {
        total_registrations:       sellerCount,
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
      revenue: {
        total:                     parseFloat(revenueResult.rows[0].revenue),
        today:                     parseFloat(revenueTodayResult.rows[0].revenue),
        this_month:                parseFloat(revenueMonthResult.rows[0].revenue),
      },
      referrals: {
        total_uses:                parseInt(referralCountResult.rows[0].count, 10),
      },
      promo_slots: {
        tier1: { label: '12 miesięcy gratis', total: 10, used: tier1Used, remaining: Math.max(0, 10 - tier1Used) },
        tier2: { label: '6 miesięcy gratis',  total: 10, used: tier2Used, remaining: Math.max(0, 10 - (sellerCount >= 10 ? tier2Used : 0)) },
        tier3: { label: '3 miesiące gratis',  total: 10, used: tier3Used, remaining: Math.max(0, 10 - (sellerCount >= 20 ? tier3Used : 0)) },
      },
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
    let nextParamIndex = 1;

    if (role)   { conditions.push(`role = $${nextParamIndex++}`);                                  params.push(role); }
    if (search) { conditions.push(`(email ILIKE $${nextParamIndex} OR name ILIKE $${nextParamIndex})`);       params.push(`%${search}%`); nextParamIndex++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT id, email, name, role, plan, trial_ends_at, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
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
    let nextParamIndex = 1;

    if (status) { conditions.push(`s.status = $${nextParamIndex++}`); params.push(status); }
    if (search) {
      conditions.push(`(s.name ILIKE $${nextParamIndex} OR s.slug ILIKE $${nextParamIndex})`);
      params.push(`%${search}%`);
      nextParamIndex++;
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
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
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
    let nextParamIndex = 1;

    if (search) {
      conditions.push(`name ILIKE $${nextParamIndex++}`);
      params.push(`%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM suppliers ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count
       FROM suppliers s
       ${where}
       ORDER BY s.name ASC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
      [...params, limit, offset]
    );
    return res.json({ total, page, limit, suppliers: result.rows });
  } catch (err) {
    console.error('admin list suppliers error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/admin/suppliers – create supplier ──────────────────────────────

router.post(
  '/suppliers',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('type').optional().isIn(['api', 'xml', 'csv', 'manual']),
    body('integration_type').optional().isIn(['api', 'xml', 'csv', 'manual']),
    body('country').optional().trim(),
    body('api_endpoint').optional().isURL(),
    body('xml_endpoint').optional().isURL(),
    body('csv_endpoint').optional().isURL(),
    body('api_key').optional().trim(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('status').optional().isIn(['active', 'inactive', 'suspended']),
  ],
  validate,
  async (req, res) => {
    const {
      name,
      type,
      integration_type,
      country = null,
      api_endpoint = null,
      xml_endpoint = null,
      csv_endpoint = null,
      api_key = null,
      margin = 0,
      notes = '',
      status = 'active',
    } = req.body;

    const actualType = type || integration_type || 'manual';

    try {
      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO suppliers
           (id, name, integration_type, api_url, api_key, margin, notes,
            active, country, xml_endpoint, csv_endpoint, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
         RETURNING *`,
        [id, name, actualType, api_endpoint, api_key, margin, notes,
         status === 'active', country, xml_endpoint, csv_endpoint, status]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('admin create supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── POST /api/admin/suppliers/import – import products into central catalogue ─

router.post(
  '/suppliers/import',
  authenticate,
  requireRole('owner', 'admin'),
  upload.single('file'),
  async (req, res) => {
    const { supplier_id } = req.body;
    if (!supplier_id) {
      return res.status(422).json({ error: 'Wymagany parametr: supplier_id' });
    }

    try {
      const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
      const supplier = supplierResult.rows[0];
      if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });

      let rawProducts = [];

      if (req.file) {
        const content = req.file.buffer.toString('utf-8');
        if (req.file.mimetype.includes('xml') || req.file.originalname.endsWith('.xml')) {
          rawProducts = await adminParseXmlProducts(content);
        } else {
          rawProducts = adminParseCsvProducts(content);
        }
      } else {
        const apiUrl = supplier.api_url || supplier.xml_endpoint || supplier.csv_endpoint;
        if (!apiUrl) {
          return res.status(422).json({ error: 'Brak pliku lub skonfigurowanego endpointu hurtowni' });
        }
        rawProducts = await fetchSupplierProducts(supplier);
      }

      const imported = await upsertSupplierProducts(supplier_id, rawProducts);

      return res.json({ message: `Zaimportowano ${imported} produktów`, count: imported });
    } catch (err) {
      console.error('admin import supplier products error:', err.message);
      return res.status(500).json({ error: 'Błąd importu: ' + err.message });
    }
  }
);

// ─── POST /api/admin/suppliers/sync – sync products from supplier API ──────────

router.post(
  '/suppliers/sync',
  authenticate,
  requireRole('owner', 'admin'),
  [body('supplier_id').notEmpty()],
  validate,
  async (req, res) => {
    const { supplier_id } = req.body;

    try {
      const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
      const supplier = supplierResult.rows[0];
      if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });

      const apiUrl = supplier.api_url || supplier.xml_endpoint || supplier.csv_endpoint;
      if (!apiUrl) {
        return res.status(422).json({ error: 'Hurtownia nie ma skonfigurowanego URL API' });
      }

      const rawProducts = await adminFetchApiProducts(supplier);
      const count = await upsertCentralProducts(rawProducts, supplier_id);

      await db.query(
        `UPDATE suppliers SET last_sync_at = NOW(), status = 'active' WHERE id = $1`,
        [supplier_id]
      );

      return res.json({
        message: `Zsynchronizowano ${count} produktów`,
        count,
        synced_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('admin sync supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd synchronizacji: ' + err.message });
    }
  }
);

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

// ─── PATCH /api/admin/stores/:id/slug – change store slug ────────────────────

router.patch(
  '/stores/:id/slug',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('slug').trim().matches(/^[a-z0-9-]+$/i).isLength({ max: 80 }),
  ],
  validate,
  async (req, res) => {
    const { slug } = req.body;

    try {
      const conflict = await db.query(
        'SELECT id FROM stores WHERE slug = $1 AND id != $2',
        [slug, req.params.id]
      );
      if (conflict.rows.length > 0) {
        return res.status(409).json({ error: 'Slug jest już zajęty' });
      }

      const result = await db.query(
        `UPDATE stores SET slug = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, name, slug, status, plan, margin, subdomain_blocked, owner_id, updated_at`,
        [slug, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store slug error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/stores/:id/subdomain – block or unblock subdomain ───────

router.patch(
  '/stores/:id/subdomain',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('subdomain_blocked').isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE stores SET subdomain_blocked = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, name, slug, status, plan, margin, subdomain_blocked, owner_id, updated_at`,
        [req.body.subdomain_blocked, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Sklep nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update store subdomain error:', err.message);
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
      `SELECT s.*,
              st.name AS shop_name, st.slug AS shop_slug,
              u.email AS owner_email, u.name AS owner_name,
              (SELECT COUNT(*) FROM shop_products sp WHERE sp.store_id = st.id) AS product_count
       FROM subscriptions s
       LEFT JOIN stores st ON s.shop_id = st.id
       LEFT JOIN users u ON st.owner_id = u.id
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

// ─── PATCH /api/admin/subscriptions/:id – manage a subscription ───────────────

router.patch(
  '/subscriptions/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite']),
    body('status').optional().isIn(['active', 'cancelled', 'expired', 'superseded']),
    body('expires_at').optional().isISO8601(),
    body('commission_rate').optional().isFloat({ min: 0, max: 1 }),
    body('product_limit').optional({ nullable: true }).isInt({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    const { plan, status, expires_at, commission_rate, product_limit } = req.body;

    let newProductLimit = product_limit !== undefined ? product_limit : null;
    let newCommissionRate = commission_rate !== undefined ? commission_rate : null;

    if (plan) {
      if (commission_rate === undefined) newCommissionRate = PLAN_CONFIG[plan].commission_rate;
      if (product_limit === undefined)   newProductLimit   = PLAN_CONFIG[plan].product_limit;
    }

    try {
      const result = await db.query(
        `UPDATE subscriptions SET
           plan            = COALESCE($1, plan),
           status          = COALESCE($2, status),
           expires_at      = COALESCE($3::timestamptz, expires_at),
           commission_rate = COALESCE($4, commission_rate),
           product_limit   = COALESCE($5, product_limit),
           updated_at      = NOW()
         WHERE id = $6
         RETURNING *`,
        [plan || null, status || null, expires_at || null, newCommissionRate, newProductLimit, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Subskrypcja nie znaleziona' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update subscription error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/referrals – referral program stats (admin) ────────────────

router.get('/referrals', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;

  try {
    const [totalResult, rowsResult, summaryResult] = await Promise.all([
      db.query(`SELECT COUNT(DISTINCT referrer_id) FROM referral_uses`),
      db.query(
        `SELECT rc.code,
                u.id   AS user_id,
                u.name AS user_name,
                u.email AS user_email,
                COUNT(ru.id) AS referred_count,
                COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_stores
           FROM referral_codes rc
           JOIN users u ON u.id = rc.user_id
      LEFT JOIN referral_uses ru ON ru.code = rc.code
      LEFT JOIN stores s ON s.owner_id = ru.new_user_id
          GROUP BY rc.code, u.id, u.name, u.email
          ORDER BY referred_count DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query(
        `SELECT COUNT(*) AS total_uses,
                SUM(bonus_days) AS total_bonus_days
           FROM referral_uses`
      ),
    ]);

    const summary = summaryResult.rows[0];
    return res.json({
      total_referrers: parseInt(totalResult.rows[0].count, 10),
      total_uses:      parseInt(summary.total_uses || 0, 10),
      total_bonus_days: parseInt(summary.total_bonus_days || 0, 10),
      page,
      limit,
      referrers: rowsResult.rows.map((r) => ({
        user_id:       r.user_id,
        user_name:     r.user_name,
        user_email:    r.user_email,
        ref_code:      r.code,
        referred_count: parseInt(r.referred_count, 10),
        active_stores: parseInt(r.active_stores, 10),
      })),
    });
  } catch (err) {
    console.error('admin referrals error:', err.message);
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
    let nextParamIndex = 1;

    if (category) { conditions.push(`category = $${nextParamIndex++}`); params.push(category); }
    if (search) {
      conditions.push(`(name ILIKE $${nextParamIndex} OR description ILIKE $${nextParamIndex})`);
      params.push(`%${search}%`);
      nextParamIndex++;
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
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
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
    let nextParamIndex = 1;

    if (status)            { conditions.push(`p.status = $${nextParamIndex++}`);                                   params.push(status); }
    if (isCentral !== null){ conditions.push(`p.is_central = $${nextParamIndex++}`);                               params.push(isCentral); }
    if (search)            { conditions.push(`(p.name ILIKE $${nextParamIndex} OR p.sku ILIKE $${nextParamIndex})`);          params.push(`%${search}%`); nextParamIndex++; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) FROM products p ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS store_name
       FROM products p
       LEFT JOIN stores s ON p.store_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}`,
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

// ─── PATCH /api/admin/products/:id/platform-price – set platform minimum price ─

router.patch(
  '/products/:id/platform-price',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('platform_price').optional({ nullable: true }).isFloat({ min: 0 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { platform_price } = req.body;
      const result = await db.query(
        'UPDATE products SET platform_price = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [platform_price ?? null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update product platform_price error:', err.message);
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

// ─── Platform margin config ────────────────────────────────────────────────────

/**
 * GET /api/admin/platform-margins
 * Returns all platform margin tiers, optionally filtered by category.
 */
router.get('/platform-margins', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const { category } = req.query;
  try {
    let result;
    if (category !== undefined) {
      result = await db.query(
        `SELECT * FROM platform_margin_config WHERE category = $1
         ORDER BY threshold_max ASC NULLS LAST`,
        [category || null]
      );
    } else {
      result = await db.query(
        `SELECT * FROM platform_margin_config
         ORDER BY category ASC NULLS FIRST, threshold_max ASC NULLS LAST`
      );
    }
    return res.json({ tiers: result.rows });
  } catch (err) {
    console.error('get platform margins error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

/**
 * PUT /api/admin/platform-margins
 * Replace all tiers for a given category (or global if category omitted).
 * Body: { category?: string|null, tiers: [{ threshold_max: number|null, margin_percent: number }] }
 */
router.put(
  '/platform-margins',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('tiers').isArray({ min: 1 }),
    body('tiers.*.margin_percent').isFloat({ min: 0, max: 999 }),
    body('category').optional({ nullable: true }).isString(),
  ],
  validate,
  async (req, res) => {
    const { tiers, category = null } = req.body;
    try {
      // Delete existing tiers for this category scope
      if (category) {
        await db.query('DELETE FROM platform_margin_config WHERE category = $1', [category]);
      } else {
        await db.query('DELETE FROM platform_margin_config WHERE category IS NULL');
      }

      const inserted = [];
      for (const tier of tiers) {
        const maxPrice = tier.threshold_max != null ? parseFloat(tier.threshold_max) : null;
        const marginPct = parseFloat(tier.margin_percent);
        const id = uuidv4();
        const row = await db.query(
          `INSERT INTO platform_margin_config
             (id, category, threshold_max, margin_percent, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING *`,
          [id, category || null, maxPrice, marginPct]
        );
        inserted.push(row.rows[0]);
      }
      return res.json({ tiers: inserted });
    } catch (err) {
      console.error('put platform margins error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Import helpers ────────────────────────────────────────────────────────────

const DEFAULT_TAX_RATE = 23; // Polish standard VAT rate (%)

function adminParseCsvProducts(content) {
  const records = csvParse(content, { columns: true, skip_empty_lines: true, trim: true });
  return records.map((csvRecord) => ({
    sku:         csvRecord.sku || csvRecord.SKU || csvRecord.id || null,
    name:        csvRecord.name || csvRecord.nazwa || csvRecord.Name || '',
    price_net:   parseFloat(csvRecord.price_net || csvRecord.cena_netto || csvRecord.price || 0),
    price_gross: parseFloat(csvRecord.price_gross || csvRecord.cena_brutto || 0) || null,
    stock:       parseInt(csvRecord.stock || csvRecord.stan || 0, 10),
    category:    csvRecord.category || csvRecord.kategoria || null,
    description: csvRecord.description || csvRecord.opis || '',
    image_url:   csvRecord.image_url || csvRecord.zdjecie || csvRecord.image || null,
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
    price_gross: parseFloat(item.price_gross || item.cena_brutto || 0) || null,
    stock:       parseInt(item.stock || item.stan || item.quantity || 0, 10),
    category:    item.category || item.kategoria || null,
    description: item.description || item.opis || '',
    image_url:   item.image_url || item.zdjecie || item.img || null,
  }));
}

async function adminFetchApiProducts(supplier) {
  const apiUrl = supplier.api_url || supplier.xml_endpoint || supplier.csv_endpoint;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    const headers = {};
    if (supplier.api_key) headers['Authorization'] = `Bearer ${supplier.api_key}`;
    response = await fetch(apiUrl, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`API returned ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('xml')) {
    return adminParseXmlProducts(await response.text());
  }
  if (contentType.includes('csv')) {
    return adminParseCsvProducts(await response.text());
  }

  const json = await response.json();
  const items = Array.isArray(json) ? json : json.products || json.items || json.data || [];
  return items.map((item) => ({
    sku:         item.sku || item.id || null,
    name:        item.name || item.nazwa || '',
    price_net:   parseFloat(item.price_net || item.price || 0),
    price_gross: parseFloat(item.price_gross || 0) || null,
    stock:       parseInt(item.stock || item.quantity || 0, 10),
    category:    item.category || null,
    description: item.description || item.opis || '',
    image_url:   item.image_url || item.image || null,
  }));
}

async function upsertCentralProducts(rawProducts, supplierId) {
  let count = 0;

  // Load current global platform margin tiers for pricing
  let tiers = DEFAULT_PLATFORM_TIERS;
  try {
    const tiersResult = await db.query(
      `SELECT threshold_max, margin_percent FROM platform_margin_config
       WHERE category IS NULL ORDER BY threshold_max ASC NULLS LAST`
    );
    if (tiersResult.rows.length > 0) {
      tiers = dbTiersToArray(tiersResult.rows);
    }
  } catch (err) {
    // Table may not exist yet during early migrations – fall back to defaults.
    // Only suppress the "table does not exist" error (42P01); re-throw others.
    if (err.code !== '42P01') {
      console.error('platform_margin_config query error:', err.message);
    }
  }

  for (const raw of rawProducts) {
    if (!raw.name) continue;

    const priceNet = raw.price_net || 0;
    // Use supplier-provided gross price when available; otherwise apply default VAT
    const priceGross = raw.price_gross > 0
      ? raw.price_gross
      : priceNet * (1 + DEFAULT_TAX_RATE / 100);
    const formattedPriceGross = parseFloat(priceGross).toFixed(2);
    const supplierPrice = parseFloat(formattedPriceGross);
    const platformPrice = computePlatformPrice(supplierPrice, tiers);

    if (raw.sku) {
      const existing = await db.query(
        'SELECT id FROM products WHERE is_central = true AND sku = $1',
        [raw.sku]
      );

      if (existing.rows.length > 0) {
        // Update price, stock, description and image; preserve category/description
        // if not provided by the supplier (COALESCE keeps existing value when null)
        await db.query(
          `UPDATE products SET
             name              = $1,
             price_net         = $2,
             price_gross       = $3,
             supplier_price    = $3,
             platform_price    = $4,
             min_selling_price = $4,
             stock             = $5,
             category          = COALESCE($6, category),
             description       = COALESCE($7, description),
             image_url         = COALESCE($8, image_url),
             supplier_id       = $9,
             status            = 'active',
             updated_at        = NOW()
           WHERE is_central = true AND sku = $10`,
          [raw.name, priceNet, formattedPriceGross, platformPrice, raw.stock,
           raw.category, raw.description, raw.image_url, supplierId, raw.sku]
        );
        count++;
        continue;
      }
    }

    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, name, sku, price_net, tax_rate, price_gross,
          supplier_price, platform_price, min_selling_price,
          selling_price, margin, stock, category, description, image_url,
          is_central, status, created_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7,
               $7, $8, $8,
               $8, 0, $9, $10, $11, $12, true, 'active', NOW())`,
      [uuidv4(), supplierId, raw.name, raw.sku || null,
       priceNet, DEFAULT_TAX_RATE, formattedPriceGross,
       platformPrice,
       raw.stock, raw.category, raw.description, raw.image_url]
    );
    count++;
  }

  return count;
}

// ─── GET /api/admin/settings – read platform settings ────────────────────────

router.get('/settings', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM platform_settings');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    // Ensure commission_rate is returned as a number
    if (settings.commission_rate !== undefined) {
      settings.commission_rate = parseFloat(settings.commission_rate);
    }
    return res.json(settings);
  } catch (err) {
    console.error('admin get settings error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/settings – update platform settings ────────────────────

router.patch(
  '/settings',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('commission_rate').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  async (req, res) => {
    const { commission_rate } = req.body;

    if (commission_rate === undefined) {
      return res.status(422).json({ error: 'Brak pól do zaktualizowania' });
    }

    try {
      await db.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ('commission_rate', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [String(commission_rate)]
      );
      return res.json({ commission_rate });
    } catch (err) {
      console.error('admin update settings error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

module.exports = router;

// ─── POST /api/admin/products/import – bulk import into central catalogue ──────
// Accepts multipart/form-data with a `file` (CSV or XML).
// Optionally accepts `supplier_id` body param.

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

      const count = await upsertCentralProducts(rawProducts, supplierId);
      return res.json({ message: `Zaimportowano ${count} produktów do katalogu centralnego`, count });
    } catch (err) {
      console.error('admin products import error:', err.message);
      return res.status(500).json({ error: 'Błąd importu: ' + err.message });
    }
  }
);
