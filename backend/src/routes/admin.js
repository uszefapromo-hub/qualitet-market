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
const { computePlatformPrice, dbTiersToArray, DEFAULT_PLATFORM_TIERS, computeQualityScore, isProductFeatured, isLowQuality, selectBestSupplier } = require('../helpers/pricing');
const { getPromoSlots } = require('../helpers/promo');
const { sendImportNotification } = require('../helpers/mailer');

// Optional nodemailer for SMTP mail dispatch (e.g. Proton Mail Bridge).
// Loaded once at startup; null when the package is not installed.
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) { /* non-critical */ }

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
      dailyRevenueResult,
      monthlyRevenueResult,
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
    ]);

    const totalSellers = parseInt(totalSellersResult.rows[0].count, 10);
    const promoSlots   = getPromoSlots(totalSellers);

    return res.json({
      sellers: {
        total_registrations:       totalSellers,
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
      revenue_today:               parseFloat(dailyRevenueResult.rows[0].revenue),
      revenue_this_month:          parseFloat(monthlyRevenueResult.rows[0].revenue),
      promo_slots:                 promoSlots,
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

      const report = await upsertSupplierProducts(supplier_id, rawProducts);

      // Fire-and-forget: notify admin about completed import
      sendImportNotification({
        supplierName: supplier.name,
        count: report.count,
        status: 'success',
      });

      return res.json({
        message: `Zaimportowano ${report.count} produktów`,
        count: report.count,
        featured: report.featured,
        skipped: report.skipped,
        suppliers: [supplier.name],
      });
    } catch (err) {
      console.error('admin import supplier products error:', err.message);
      // Fire-and-forget: notify admin about failed import
      sendImportNotification({
        supplierName: supplier?.name || supplier_id,
        count: 0,
        status: 'failure',
        errorMessage: err.message,
      });
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
      const report = await upsertCentralProducts(rawProducts, supplier_id);

      await db.query(
        `UPDATE suppliers SET last_sync_at = NOW(), status = 'active' WHERE id = $1`,
        [supplier_id]
      );

      // Fire-and-forget: notify admin about completed sync
      sendImportNotification({
        supplierName: supplier.name,
        count: report.count,
        status: 'success',
      });

      return res.json({
        message: `Zsynchronizowano ${report.count} produktów`,
        count: report.count,
        featured: report.featured,
        skipped: report.skipped,
        suppliers: [supplier.name],
        synced_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('admin sync supplier error:', err.message);
      // Fire-and-forget: notify admin about failed sync
      sendImportNotification({
        supplierName: supplier?.name || supplier_id,
        count: 0,
        status: 'failure',
        errorMessage: err.message,
      });
      return res.status(500).json({ error: 'Błąd synchronizacji: ' + err.message });
    }
  }
);

// ─── POST /api/admin/suppliers/sync-all – sync every active supplier ──────────

router.post(
  '/suppliers/sync-all',
  authenticate,
  requireRole('owner', 'admin'),
  async (req, res) => {
    try {
      const suppliersResult = await db.query(
        `SELECT * FROM suppliers
         WHERE active = true
           AND (api_url IS NOT NULL OR xml_endpoint IS NOT NULL OR csv_endpoint IS NOT NULL)`
      );
      const suppliers = suppliersResult.rows;

      if (suppliers.length === 0) {
        return res.json({ message: 'Brak aktywnych hurtowni do synchronizacji', total_count: 0, synced_at: new Date().toISOString(), results: [] });
      }

      const results = [];
      let totalCount = 0;

      for (const supplier of suppliers) {
        try {
          const rawProducts = await fetchSupplierProducts(supplier);
          const report = await upsertSupplierProducts(supplier.id, rawProducts);

          await db.query(
            `UPDATE suppliers SET last_sync_at = NOW(), status = 'active' WHERE id = $1`,
            [supplier.id]
          );

          // Fire-and-forget import log
          db.query(
            `INSERT INTO import_logs (supplier_id, status, count, featured, skipped, triggered_by, created_at)
             VALUES ($1, 'success', $2, $3, $4, 'admin', NOW())`,
            [supplier.id, report.count, report.featured, report.skipped]
          ).catch((logErr) => console.warn('[sync-all] import_log insert failed:', logErr.message));

          results.push({ supplier_id: supplier.id, name: supplier.name, status: 'success', count: report.count, featured: report.featured, skipped: report.skipped });
          totalCount += report.count;
        } catch (err) {
          db.query(
            `INSERT INTO import_logs (supplier_id, status, count, error_message, triggered_by, created_at)
             VALUES ($1, 'failure', 0, $2, 'admin', NOW())`,
            [supplier.id, err.message]
          ).catch((logErr) => console.warn('[sync-all] import_log insert failed:', logErr.message));

          results.push({ supplier_id: supplier.id, name: supplier.name, status: 'failure', error: err.message });
        }
      }

      return res.json({
        message: `Zsynchronizowano ${totalCount} produktów od ${suppliers.length} hurtowni`,
        total_count: totalCount,
        synced_at: new Date().toISOString(),
        results,
      });
    } catch (err) {
      console.error('sync-all error:', err.message);
      return res.status(500).json({ error: 'Błąd synchronizacji: ' + err.message });
    }
  }
);

// ─── GET /api/admin/import-center – supplier import overview & log ─────────────

router.get('/import-center', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  try {
    const suppliersResult = await db.query(
      `SELECT s.id, s.name, s.integration_type, s.status, s.active, s.last_sync_at,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.status = 'active') AS product_count
       FROM suppliers s
       ORDER BY s.name ASC`
    );

    const logsResult = await db.query(
      `SELECT il.id, il.supplier_id, il.status, il.count, il.featured, il.skipped,
              il.error_message, il.triggered_by, il.created_at, s.name AS supplier_name
       FROM import_logs il
       LEFT JOIN suppliers s ON il.supplier_id = s.id
       ORDER BY il.created_at DESC
       LIMIT 50`
    );

    const rows = suppliersResult.rows;
    const stats = {
      total_suppliers: rows.length,
      active_suppliers: rows.filter((s) => s.active).length,
      total_products: rows.reduce((sum, s) => sum + parseInt(s.product_count, 10), 0),
    };

    return res.json({ stats, suppliers: rows, recent_logs: logsResult.rows });
  } catch (err) {
    console.error('import-center error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/admin/suppliers/select-best-source – find best supplier offer ──

router.post(
  '/suppliers/select-best-source',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('sku').optional().trim(),
    body('name').optional().trim(),
    body('mode').optional().isIn(['lowest_cost', 'best_margin', 'best_quality']),
  ],
  validate,
  async (req, res) => {
    const { sku, name, mode = 'lowest_cost' } = req.body;

    if (!sku && !name) {
      return res.status(422).json({ error: 'Wymagany parametr: sku lub name' });
    }

    try {
      let result;
      if (sku) {
        result = await db.query(
          `SELECT p.id, p.name, p.sku, p.supplier_price, p.platform_price,
                  p.quality_score, p.stock,
                  s.id AS supplier_id, s.name AS supplier_name
           FROM products p
           JOIN suppliers s ON p.supplier_id = s.id
           WHERE p.sku = $1 AND p.is_central = true`,
          [sku]
        );
      } else {
        result = await db.query(
          `SELECT p.id, p.name, p.sku, p.supplier_price, p.platform_price,
                  p.quality_score, p.stock,
                  s.id AS supplier_id, s.name AS supplier_name
           FROM products p
           JOIN suppliers s ON p.supplier_id = s.id
           WHERE p.name ILIKE $1 AND p.is_central = true`,
          [`%${name}%`]
        );
      }

      const offers = result.rows;
      const best = selectBestSupplier(offers, mode);

      return res.json({ offers, best, mode });
    } catch (err) {
      console.error('select-best-source error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
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
    body('plan').optional().isIn(['trial', 'basic', 'pro', 'elite', 'free', 'supplier_basic', 'supplier_pro', 'brand', 'artist_basic', 'artist_pro']),
    body('status').optional().isIn(['active', 'cancelled', 'expired', 'superseded', 'legacy']),
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
           is_legacy       = CASE WHEN $2 = 'legacy' THEN true ELSE is_legacy END,
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
  let count    = 0;
  let featured = 0;
  let skipped  = 0;

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

    // Skip completely empty / low-quality listings
    if (isLowQuality(raw)) {
      skipped++;
      continue;
    }

    const priceNet = raw.price_net || 0;
    // Use supplier-provided gross price when available; otherwise apply default VAT
    const priceGross = raw.price_gross > 0
      ? raw.price_gross
      : priceNet * (1 + DEFAULT_TAX_RATE / 100);
    const formattedPriceGross = parseFloat(priceGross).toFixed(2);
    const supplierPrice = parseFloat(formattedPriceGross);
    const platformPrice = computePlatformPrice(supplierPrice, tiers);

    const qualityScore    = computeQualityScore({ ...raw, price_gross: supplierPrice });
    const productFeatured = isProductFeatured({ ...raw, price_gross: supplierPrice });

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
             quality_score     = $11,
             is_featured       = $12,
             status            = 'active',
             updated_at        = NOW()
           WHERE is_central = true AND sku = $10`,
          [raw.name, priceNet, formattedPriceGross, platformPrice, raw.stock,
           raw.category, raw.description, raw.image_url, supplierId, raw.sku,
           qualityScore, productFeatured]
        );
        count++;
        if (productFeatured) featured++;
        continue;
      }
    }

    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, name, sku, price_net, tax_rate, price_gross,
          supplier_price, platform_price, min_selling_price,
          selling_price, margin, stock, category, description, image_url,
          is_central, status, quality_score, is_featured, created_at)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7,
               $7, $8, $8,
               $8, 0, $9, $10, $11, $12, true, 'active', $13, $14, NOW())`,
      [uuidv4(), supplierId, raw.name, raw.sku || null,
       priceNet, DEFAULT_TAX_RATE, formattedPriceGross,
       platformPrice,
       raw.stock, raw.category, raw.description, raw.image_url,
       qualityScore, productFeatured]
    );
    count++;
    if (productFeatured) featured++;
  }

  return { count, featured, skipped };
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

// ─── GET /api/admin/announcements – list all announcements ───────────────────

router.get('/announcements', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  try {
    const countResult = await db.query('SELECT COUNT(*) FROM announcements');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      `SELECT a.*, u.name AS author_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, announcements: result.rows });
  } catch (err) {
    console.error('admin list announcements error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── POST /api/admin/announcements – create announcement ─────────────────────

router.post(
  '/announcements',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('body').trim().notEmpty(),
    body('type').optional().isIn(['info', 'warning', 'success', 'alert']),
    body('target_role').optional({ nullable: true }).isIn(['seller', 'buyer', 'admin', null]),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { title, body: msgBody, type = 'info', target_role = null, is_active = true } = req.body;
    const id = uuidv4();
    try {
      const result = await db.query(
        `INSERT INTO announcements (id, title, body, type, target_role, is_active, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [id, title, msgBody, type, target_role, is_active, req.user.id]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('admin create announcement error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/announcements/:id – update announcement ────────────────

router.patch(
  '/announcements/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('body').optional().trim().notEmpty(),
    body('type').optional().isIn(['info', 'warning', 'success', 'alert']),
    body('target_role').optional({ nullable: true }).isIn(['seller', 'buyer', 'admin', null]),
    body('is_active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { title, body: msgBody, type, target_role, is_active } = req.body;
    try {
      const existing = await db.query('SELECT id FROM announcements WHERE id = $1', [req.params.id]);
      if (!existing.rows[0]) return res.status(404).json({ error: 'Ogłoszenie nie znalezione' });

      const pTitle      = title       != null ? title      : null;
      const pBody       = msgBody     != null ? msgBody     : null;
      const pType       = type        != null ? type        : null;
      const pTargetRole = target_role !== undefined ? target_role : null;
      const pIsActive   = is_active   != null ? is_active  : null;

      const result = await db.query(
        `UPDATE announcements SET
           title       = COALESCE($1, title),
           body        = COALESCE($2, body),
           type        = COALESCE($3, type),
           target_role = COALESCE($4, target_role),
           is_active   = COALESCE($5, is_active),
           updated_at  = NOW()
         WHERE id = $6
         RETURNING *`,
        [pTitle, pBody, pType, pTargetRole, pIsActive, req.params.id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin update announcement error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── DELETE /api/admin/announcements/:id – delete announcement ────────────────

router.delete(
  '/announcements/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [param('id').isUUID()],
  validate,
  async (req, res) => {
    try {
      const result = await db.query(
        'DELETE FROM announcements WHERE id = $1 RETURNING id',
        [req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Ogłoszenie nie znalezione' });
      return res.status(204).send();
    } catch (err) {
      console.error('admin delete announcement error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/announcements – public list of active announcements ─────────────
// Exposed on the main router so buyers and sellers can also see announcements.
// Kept here for convenience (admin router mounts at /api/admin).
// A separate public route is NOT needed – see app.js for /api/announcements.

// ─── POST /api/admin/mail – send mail message to user(s) ─────────────────────

router.post(
  '/mail',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('to').trim().isEmail(),
    body('subject').trim().notEmpty().isLength({ max: 500 }),
    body('body').trim().notEmpty(),
    body('user_id').optional({ nullable: true }).isUUID(),
  ],
  validate,
  async (req, res) => {
    const { to, subject, body: msgBody, user_id = null } = req.body;
    const id = uuidv4();
    try {
      const result = await db.query(
        `INSERT INTO mail_messages (id, to_email, to_user_id, subject, body, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, 'queued', $6, NOW())
         RETURNING *`,
        [id, to, user_id, subject, msgBody, req.user.id]
      );

      // Attempt to dispatch via configured SMTP / Proton Bridge.
      // Falls back gracefully when SMTP is not configured.
      let sent = false;
      try {
        const smtpHost = process.env.SMTP_HOST;
        if (smtpHost && nodemailer) {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER || '',
              pass: process.env.SMTP_PASS || '',
            },
          });
          await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@uszefaqualitet.pl',
            to,
            subject,
            text: msgBody,
          });
          sent = true;
        }
      } catch (sendErr) {
        console.error('mail send error (non-critical):', sendErr.message);
      }

      // Update status in DB
      if (sent) {
        await db.query(
          `UPDATE mail_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
          [id]
        );
        result.rows[0].status = 'sent';
      }

      return res.status(201).json({ ...result.rows[0], delivered: sent });
    } catch (err) {
      console.error('admin send mail error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── GET /api/admin/mail – list sent/queued mail messages ────────────────────

router.get('/mail', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit  = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset = (page - 1) * limit;
  try {
    const countResult = await db.query('SELECT COUNT(*) FROM mail_messages');
    const total = parseInt(countResult.rows[0].count, 10);
    const result = await db.query(
      `SELECT m.*, u.name AS sender_name
         FROM mail_messages m
         LEFT JOIN users u ON u.id = m.created_by
        ORDER BY m.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.json({ total, page, limit, messages: result.rows });
  } catch (err) {
    console.error('admin list mail error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── GET /api/admin/featured-products – list best products from all suppliers ──

router.get('/featured-products', authenticate, requireRole('owner', 'admin'), async (req, res) => {
  const page       = Math.max(1, parseInt(req.query.page  || '1',  10));
  const limit      = Math.min(100, parseInt(req.query.limit || '20', 10));
  const offset     = (page - 1) * limit;
  const supplierId = req.query.supplier_id || null;
  const pinned     = req.query.pinned === 'true' ? true : null;

  try {
    const conditions = ['(is_featured = true OR is_pinned = true)'];
    const params     = [];
    let   idx        = 1;

    if (supplierId) { conditions.push(`supplier_id = $${idx++}`); params.push(supplierId); }
    if (pinned !== null) { conditions.push(`is_pinned = $${idx++}`); params.push(pinned); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await db.query(`SELECT COUNT(*) FROM products ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.query(
      `SELECT p.*, s.name AS supplier_name
         FROM products p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         ${where}
         ORDER BY p.is_pinned DESC, p.quality_score DESC, p.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    return res.json({ total, page, limit, products: result.rows });
  } catch (err) {
    console.error('admin featured products error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── PATCH /api/admin/products/:id/featured – approve / remove featured flag ──

router.patch(
  '/products/:id/featured',
  authenticate,
  requireRole('owner', 'admin'),
  [param('id').isUUID(), body('featured').isBoolean()],
  validate,
  async (req, res) => {
    const isFeatured = req.body.featured === true || req.body.featured === 'true';
    try {
      const result = await db.query(
        `UPDATE products
           SET is_featured = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, is_featured, is_pinned, quality_score`,
        [isFeatured, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin set featured error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── PATCH /api/admin/products/:id/pinned – pin / unpin product to homepage ────

router.patch(
  '/products/:id/pinned',
  authenticate,
  requireRole('owner', 'admin'),
  [param('id').isUUID(), body('pinned').isBoolean()],
  validate,
  async (req, res) => {
    const isPinned = req.body.pinned === true || req.body.pinned === 'true';
    try {
      const result = await db.query(
        `UPDATE products
           SET is_pinned = $1,
               pinned_at = $2,
               updated_at = NOW()
           WHERE id = $3
           RETURNING id, name, is_featured, is_pinned, pinned_at, quality_score`,
        [isPinned, isPinned ? new Date().toISOString() : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Produkt nie znaleziony' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('admin set pinned error:', err.message);
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

      const report = await upsertCentralProducts(rawProducts, supplierId);

      // Fire-and-forget: notify admin about completed bulk import
      sendImportNotification({
        supplierName: supplierId ? `Katalog centralny (supplier: ${supplierId})` : 'Katalog centralny',
        count: report.count,
        status: 'success',
      });

      return res.json({
        message: `Zaimportowano ${report.count} produktów do katalogu centralnego`,
        count: report.count,
        featured: report.featured,
        skipped: report.skipped,
      });
    } catch (err) {
      console.error('admin products import error:', err.message);
      // Fire-and-forget: notify admin about failed bulk import
      sendImportNotification({
        supplierName: 'Katalog centralny',
        count: 0,
        status: 'failure',
        errorMessage: err.message,
      });
      return res.status(500).json({ error: 'Błąd importu: ' + err.message });
    }
  }
);

// ─── GET /api/admin/scripts – list system scripts with last-run info ──────────

const SYSTEM_SCRIPTS = [
  { id: 'warehouse-sync',          name: 'Synchronizacja hurtowni',           description: 'Pobiera aktualne dane produktów ze wszystkich aktywnych hurtowni',             dangerous: false, enabled: true },
  { id: 'recalculate-prices',      name: 'Przeliczenie cen',                  description: 'Aktualizuje ceny sprzedażowe wg aktualnych progów marży',                       dangerous: false, enabled: true },
  { id: 'csv-import',              name: 'Import produktów CSV',              description: 'Importuje produkty z pliku CSV do katalogu centralnego',                        dangerous: false, enabled: true },
  { id: 'cleanup-accounts',        name: 'Czyszczenie nieaktywnych kont',     description: 'Oznacza wygasłe konta trial bez aktywności (>30 dni)',                         dangerous: true,  enabled: true },
  { id: 'cleanup-demo-data',       name: 'Usuń dane demonstracyjne',          description: 'Usuwa wszystkie produkty demonstracyjne i zastępcze z katalogu centralnego',   dangerous: true,  enabled: true },
  { id: 'cleanup-subscriptions',   name: 'Czyszczenie subskrypcji',           description: 'Archiwizuje wygasłe, zduplikowane i nieaktywne subskrypcje. Obsługuje tryb DRY-RUN.', dangerous: true, enabled: true },
  { id: 'export-report',           name: 'Eksport raportów finansowych',      description: 'Generuje raport przychodów i prowizji za bieżący miesiąc',                     dangerous: false, enabled: true },
];

router.get('/scripts', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT script_id, status, last_run_at, last_result, run_count, enabled
       FROM script_runs
       ORDER BY last_run_at DESC`
    );
    const byId = {};
    for (const row of result.rows) {
      byId[row.script_id] = row;
    }

    const scripts = SYSTEM_SCRIPTS.map((s) => ({
      ...s,
      status:      byId[s.id]?.status      || 'idle',
      last_run_at: byId[s.id]?.last_run_at || null,
      last_result: byId[s.id]?.last_result || null,
      run_count:   byId[s.id]?.run_count   || 0,
      enabled:     byId[s.id]?.enabled     !== undefined ? byId[s.id].enabled : true,
    }));

    return res.json({ scripts });
  } catch (_err) {
    // Gracefully degrade when script_runs table does not yet exist
    const scripts = SYSTEM_SCRIPTS.map((s) => ({
      ...s, status: 'idle', last_run_at: null, last_result: null, run_count: 0,
    }));
    return res.json({ scripts });
  }
});

// ─── PATCH /api/admin/scripts/:id – enable or disable a system script ────────

router.patch('/scripts/:id', authenticate, requireSuperAdmin, async (req, res) => {
  const scriptId = req.params.id;
  const script = SYSTEM_SCRIPTS.find((s) => s.id === scriptId);
  if (!script) {
    return res.status(404).json({ error: 'Skrypt nie istnieje' });
  }

  const enabled = req.body && req.body.enabled !== undefined ? Boolean(req.body.enabled) : null;
  if (enabled === null) {
    return res.status(400).json({ error: 'Pole "enabled" jest wymagane' });
  }

  try {
    await db.query(
      `INSERT INTO script_runs (id, script_id, status, run_count, enabled, created_at)
       VALUES ($1, $2, 'idle', 0, $3, NOW())
       ON CONFLICT (script_id) DO UPDATE SET
         enabled    = EXCLUDED.enabled,
         updated_at = NOW()`,
      [uuidv4(), scriptId, enabled]
    );
  } catch (_err) {
    // Non-critical if table doesn't exist yet
  }

  return res.json({ script_id: scriptId, enabled });
});

// ─── POST /api/admin/scripts/:id/run – trigger a system script ────────────────

router.post('/scripts/:id/run', authenticate, requireSuperAdmin, async (req, res) => {
  const scriptId = req.params.id;
  const isDryRun = req.body && (req.body.dry_run === true || req.body.dry_run === 'true');
  const script = SYSTEM_SCRIPTS.find((s) => s.id === scriptId);
  if (!script) {
    return res.status(404).json({ error: 'Skrypt nie istnieje' });
  }

  // Check if script is disabled in DB (best-effort)
  try {
    const enabledResult = await db.query(
      `SELECT enabled FROM script_runs WHERE script_id = $1`,
      [scriptId]
    );
    if (enabledResult.rows.length > 0 && enabledResult.rows[0].enabled === false) {
      return res.status(403).json({ error: 'Skrypt jest wyłączony' });
    }
  } catch (_err) {
    // Ignore – table may not exist yet
  }

  const startedAt = new Date();
  let resultMessage = '';
  let ok = true;

  try {
    // ── Execute the corresponding system action ───────────────────────────
    if (scriptId === 'warehouse-sync') {
      const { importSupplierProducts } = require('../services/supplier-import');
      const supplierRows = await db.query(
        `SELECT id FROM suppliers WHERE status = 'active' AND (api_url IS NOT NULL OR xml_endpoint IS NOT NULL OR csv_endpoint IS NOT NULL)`
      );
      let totalSynced = 0;
      for (const row of supplierRows.rows) {
        try {
          const count = await importSupplierProducts(row.id);
          totalSynced += count;
        } catch (err) {
          console.error(`[script] warehouse-sync supplier ${row.id}:`, err.message);
        }
      }
      resultMessage = `Zsynchronizowano ${totalSynced} produktów z ${supplierRows.rows.length} hurtowni`;

    } else if (scriptId === 'recalculate-prices') {
      // Re-apply platform margin tiers to all products
      const tiersResult = await db.query('SELECT * FROM platform_margin_config ORDER BY min_price ASC');
      const tiers = tiersResult.rows.length > 0 ? dbTiersToArray(tiersResult.rows) : DEFAULT_PLATFORM_TIERS;
      const products = await db.query('SELECT id, price_net, tax_rate FROM products WHERE active = true');
      let updated = 0;
      for (const p of products.rows) {
        const newPrice = computePlatformPrice(p.price_net, p.tax_rate || 23, tiers);
        await db.query('UPDATE products SET platform_price = $1, updated_at = NOW() WHERE id = $2', [newPrice, p.id]);
        updated++;
      }
      resultMessage = `Przeliczono ceny ${updated} produktów`;

    } else if (scriptId === 'cleanup-accounts') {
      const result = await db.query(
        `UPDATE users SET plan = 'expired'
         WHERE plan = 'trial'
           AND trial_ends_at < NOW() - INTERVAL '30 days'
           AND id NOT IN (SELECT DISTINCT buyer_id FROM orders WHERE buyer_id IS NOT NULL)
         RETURNING id`
      );
      resultMessage = `Oznaczono ${result.rows.length} nieaktywnych kont`;

    } else if (scriptId === 'cleanup-demo-data') {
      // Remove demo / placeholder products from the central catalogue.
      // Demo products are identified by picsum.photos images or seed SKU prefixes.
      const spResult = await db.query(
        `DELETE FROM shop_products
         WHERE product_id IN (
           SELECT id FROM products
           WHERE is_central = true
             AND (image_url LIKE '%picsum.photos%'
                  OR sku ~ '^(EL|AT|DG|FT|GD|DS)-'
                  OR supplier_id IS NULL)
         )
         RETURNING id`
      );
      const pResult = await db.query(
        `DELETE FROM products
         WHERE is_central = true
           AND (image_url LIKE '%picsum.photos%'
                OR sku ~ '^(EL|AT|DG|FT|GD|DS)-'
                OR supplier_id IS NULL)
         RETURNING id`
      );
      resultMessage = `Usunięto ${pResult.rows.length} produktów demonstracyjnych (${spResult.rows.length} wpisów ze sklepów)`;

    } else if (scriptId === 'export-report') {
      const report = await db.query(
        `SELECT COUNT(*) AS order_count,
                COALESCE(SUM(total), 0) AS total_revenue
         FROM orders
         WHERE status != 'cancelled'
           AND created_at >= date_trunc('month', NOW())`
      );
      const { order_count, total_revenue } = report.rows[0];
      resultMessage = `Raport za bieżący miesiąc: ${order_count} zamówień, ${parseFloat(total_revenue).toFixed(2)} zł przychodu`;

    } else if (scriptId === 'cleanup-subscriptions') {
      // ── Subscription Cleanup Script ──────────────────────────────────────────
      // Identifies and archives:
      //   1. Expired active subscriptions (expires_at < NOW())
      //   2. Duplicate active subscriptions for the same shop (keep newest)
      //   3. Legacy-plan subscriptions still marked active
      //
      // Stripe safety: Stripe checkout in this platform is one-time payment only
      //   (no recurring stripe_subscription_id stored in the subscriptions table).
      //   Archiving subscription rows does not affect Stripe billing data.
      //
      // Supports DRY-RUN mode: pass dry_run=true to see the report without changes.

      // 1. Find expired active subscriptions
      const expiredResult = await db.query(
        `SELECT s.id, s.shop_id, s.plan, s.status, s.expires_at, st.name AS shop_name
         FROM subscriptions s
         LEFT JOIN stores st ON s.shop_id = st.id
         WHERE s.status = 'active'
           AND s.expires_at IS NOT NULL
           AND s.expires_at < NOW()`
      );

      // 2. Find duplicate active subscriptions per shop (keep newest, flag older ones)
      const dupeResult = await db.query(
        `SELECT s.id, s.shop_id, s.plan, s.status, s.created_at, st.name AS shop_name
         FROM subscriptions s
         LEFT JOIN stores st ON s.shop_id = st.id
         WHERE s.status = 'active'
           AND s.shop_id IN (
             SELECT shop_id FROM subscriptions
             WHERE status = 'active'
             GROUP BY shop_id HAVING COUNT(*) > 1
           )
         ORDER BY s.shop_id, s.created_at DESC`
      );
      // For each shop, mark all but the newest as duplicate
      const seenShops = new Set();
      const duplicates = [];
      for (const row of dupeResult.rows) {
        if (seenShops.has(row.shop_id)) {
          duplicates.push(row);
        } else {
          seenShops.add(row.shop_id);
        }
      }

      // 3. Find legacy subscriptions still incorrectly marked active
      const legacyResult = await db.query(
        `SELECT s.id, s.shop_id, s.plan, s.status, st.name AS shop_name
         FROM subscriptions s
         LEFT JOIN stores st ON s.shop_id = st.id
         WHERE s.is_legacy = true AND s.status = 'active'`
      );

      const expiredIds   = expiredResult.rows.map((r) => r.id);
      const duplicateIds = duplicates.map((r) => r.id);
      const legacyIds    = legacyResult.rows.map((r) => r.id);

      // Deduplicate
      const toArchive = [...new Set([...expiredIds, ...duplicateIds, ...legacyIds])];

      const report = {
        expired:    expiredResult.rows.length,
        duplicates: duplicates.length,
        legacy:     legacyResult.rows.length,
        total:      toArchive.length,
        dry_run:    isDryRun,
        details: {
          expired_list:   expiredResult.rows.map((r) => ({ id: r.id, shop: r.shop_name, plan: r.plan, expires_at: r.expires_at })),
          duplicate_list: duplicates.map((r) => ({ id: r.id, shop: r.shop_name, plan: r.plan })),
          legacy_list:    legacyResult.rows.map((r) => ({ id: r.id, shop: r.shop_name, plan: r.plan })),
        },
      };

      if (isDryRun) {
        resultMessage = `[DRY-RUN] Znaleziono ${report.expired} wygasłych, ${report.duplicates} zduplikowanych, ${report.legacy} legacy subskrypcji (łącznie ${report.total} do archiwizacji – bez zmian)`;
        return res.json({
          script_id:   scriptId,
          name:        script.name,
          ok:          true,
          dry_run:     true,
          result:      resultMessage,
          report,
          started_at:  startedAt,
          finished_at: new Date(),
        });
      }

      // Full run: archive identified subscriptions
      if (toArchive.length > 0) {
        await db.query(
          `UPDATE subscriptions
           SET status     = 'expired',
               is_legacy  = true,
               updated_at = NOW()
           WHERE id = ANY($1::uuid[])
             AND status = 'active'`,
          [toArchive]
        );
      }
      resultMessage = `Zarchiwizowano ${toArchive.length} subskrypcji (wygasłe: ${report.expired}, duplikaty: ${report.duplicates}, legacy: ${report.legacy})`;
      ok = true;

    } else {
      resultMessage = `Skrypt "${script.name}" uruchomiony`;
    }
  } catch (err) {
    ok = false;
    resultMessage = `Błąd: ${err.message}`;
    console.error(`[script] ${scriptId} error:`, err.message);
  }

  // Persist run log (best-effort): update summary row + append full audit log
  const finishedAt = new Date();
  try {
    await db.query(
      `INSERT INTO script_runs (id, script_id, status, last_run_at, last_result, run_count, run_by, created_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6, NOW())
       ON CONFLICT (script_id) DO UPDATE SET
         status      = EXCLUDED.status,
         last_run_at = EXCLUDED.last_run_at,
         last_result = EXCLUDED.last_result,
         run_count   = script_runs.run_count + 1,
         run_by      = EXCLUDED.run_by,
         updated_at  = NOW()`,
      [uuidv4(), scriptId, ok ? 'ok' : 'error', startedAt, resultMessage, req.user.id]
    );
    await db.query(
      `INSERT INTO script_run_logs (id, script_id, run_by, dry_run, status, result, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv4(), scriptId, req.user.id, isDryRun || false, ok ? 'ok' : 'error', resultMessage, startedAt, finishedAt]
    );
  } catch (_err) {
    // Non-critical – ignore if tables don't exist yet
  }

  return res.json({
    script_id:   scriptId,
    name:        script.name,
    ok,
    dry_run:     isDryRun || false,
    result:      resultMessage,
    started_at:  startedAt,
    finished_at: finishedAt,
  });
});
