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

const MAX_UPLOAD_MB = parseInt(process.env.UPLOAD_MAX_SIZE_MB || '10', 10);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// ─── List suppliers ────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers ORDER BY name ASC');
    return res.json(result.rows);
  } catch (err) {
    console.error('list suppliers error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Get supplier ──────────────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('get supplier error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// ─── Create supplier ───────────────────────────────────────────────────────────

router.post(
  '/',
  authenticate,
  requireRole('owner', 'admin'),
  [
    body('name').trim().notEmpty(),
    body('integration_type').isIn(['api', 'xml', 'csv', 'manual']),
    body('api_url').optional().isURL(),
    body('api_key').optional().trim(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
  ],
  validate,
  async (req, res) => {
    const { name, integration_type, api_url = null, api_key = null, margin = 0, notes = '' } = req.body;

    try {
      const id = uuidv4();
      const result = await db.query(
        `INSERT INTO suppliers (id, name, integration_type, api_url, api_key, margin, notes, active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW())
         RETURNING *`,
        [id, name, integration_type, api_url, api_key, margin, notes]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('create supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Update supplier ───────────────────────────────────────────────────────────

router.put(
  '/:id',
  authenticate,
  requireRole('owner', 'admin'),
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('api_url').optional().isURL(),
    body('margin').optional().isFloat({ min: 0, max: 100 }),
    body('active').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    const { name, api_url, api_key, margin, active, notes } = req.body;
    try {
      const result = await db.query(
        `UPDATE suppliers SET
           name             = COALESCE($1, name),
           api_url          = COALESCE($2, api_url),
           api_key          = COALESCE($3, api_key),
           margin           = COALESCE($4, margin),
           active           = COALESCE($5, active),
           notes            = COALESCE($6, notes),
           updated_at       = NOW()
         WHERE id = $7
         RETURNING *`,
        [name || null, api_url || null, api_key !== undefined ? api_key : null,
         margin !== undefined ? margin : null, active !== undefined ? active : null,
         notes !== undefined ? notes : null, req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('update supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }
);

// ─── Import products from supplier (CSV or XML file upload) ───────────────────
// Optional store_id: if omitted and user is admin/owner, products are imported
// into the central catalogue (is_central = true).

router.post(
  '/:id/import',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  upload.single('file'),
  async (req, res) => {
    const supplierId = req.params.id;
    const { store_id = null } = req.body;
    const isAdmin = ['owner', 'admin'].includes(req.user.role);

    if (!store_id && !isAdmin) {
      return res.status(422).json({ error: 'Wymagany parametr: store_id' });
    }

    try {
      const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplierId]);
      const supplier = supplierResult.rows[0];
      if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });

      let store = null;
      let storeMargin = parseFloat(process.env.PLATFORM_MARGIN_DEFAULT || '15');

      if (store_id) {
        const storeResult = await db.query('SELECT owner_id, margin FROM stores WHERE id = $1', [store_id]);
        store = storeResult.rows[0];
        if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

        if (!isAdmin && store.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
        }
        storeMargin = parseFloat(store.margin || storeMargin);
      }

      let rawProducts = [];

      if (req.file) {
        const contentType = req.file.mimetype;
        const content = req.file.buffer.toString('utf-8');

        if (contentType.includes('xml') || req.file.originalname.endsWith('.xml')) {
          rawProducts = await parseXmlProducts(content);
        } else {
          // Default: CSV
          rawProducts = parseCsvProducts(content);
        }
      } else if (supplier.integration_type === 'api' && supplier.api_url) {
        rawProducts = await fetchApiProducts(supplier);
      } else {
        return res.status(422).json({ error: 'Brak pliku lub URL API dostawcy' });
      }

      const imported = await upsertProducts(rawProducts, store_id, supplierId, storeMargin);

      return res.json({ message: `Zaimportowano ${imported} produktów`, count: imported });
    } catch (err) {
      console.error('import supplier products error:', err.message);
      return res.status(500).json({ error: 'Błąd importu: ' + err.message });
    }
  }
);

// ─── Sync products from supplier API ──────────────────────────────────────────
// Optional store_id: admin/owner can sync directly into the central catalogue.

router.post(
  '/:id/sync',
  authenticate,
  requireRole('seller', 'owner', 'admin'),
  async (req, res) => {
    const supplierId = req.params.id;
    const { store_id = null } = req.body;
    const isAdmin = ['owner', 'admin'].includes(req.user.role);

    if (!store_id && !isAdmin) {
      return res.status(422).json({ error: 'Wymagany parametr: store_id' });
    }

    try {
      const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplierId]);
      const supplier = supplierResult.rows[0];
      if (!supplier) return res.status(404).json({ error: 'Hurtownia nie znaleziona' });
      if (!supplier.api_url) return res.status(422).json({ error: 'Hurtownia nie ma skonfigurowanego URL API' });

      let storeMargin = parseFloat(process.env.PLATFORM_MARGIN_DEFAULT || '15');

      if (store_id) {
        const storeResult = await db.query('SELECT owner_id, margin FROM stores WHERE id = $1', [store_id]);
        const store = storeResult.rows[0];
        if (!store) return res.status(404).json({ error: 'Sklep nie znaleziony' });

        if (!isAdmin && store.owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Brak uprawnień do tego sklepu' });
        }
        storeMargin = parseFloat(store.margin || storeMargin);
      }

      const rawProducts = await fetchApiProducts(supplier);
      const count = await upsertProducts(rawProducts, store_id, supplierId, storeMargin);

      // Update last sync timestamp
      await db.query('UPDATE suppliers SET last_sync_at = NOW() WHERE id = $1', [supplierId]);

      return res.json({ message: `Zsynchronizowano ${count} produktów`, count });
    } catch (err) {
      console.error('sync supplier error:', err.message);
      return res.status(500).json({ error: 'Błąd synchronizacji: ' + err.message });
    }
  }
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

function parseCsvProducts(content) {
  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return records.map((r) => ({
    sku: r.sku || r.SKU || r.id || null,
    name: r.name || r.nazwa || r.Name || '',
    price_net: parseFloat(r.price_net || r.cena_netto || r.price || 0),
    tax_rate: parseFloat(r.tax_rate || r.vat || r.VAT || 23),
    stock: parseInt(r.stock || r.stan || 0, 10),
    category: r.category || r.kategoria || null,
    description: r.description || r.opis || '',
    image_url: r.image_url || r.zdjecie || r.image || null,
  }));
}

async function parseXmlProducts(content) {
  const parsed = await xml2js.parseStringPromise(content, { explicitArray: false });
  // Support common XML schemas used by Polish wholesalers (Baselinker, IAI, custom)
  const rootKey = Object.keys(parsed)[0];
  const root = parsed[rootKey];
  let items = root.product || root.products?.product || root.item || root.items?.item || [];
  if (!Array.isArray(items)) items = [items];

  return items.map((item) => ({
    sku: item.sku || item.id || item.kod || null,
    name: item.name || item.nazwa || item.title || '',
    price_net: parseFloat(item.price_net || item.cena_netto || item.price || 0),
    tax_rate: parseFloat(item.tax_rate || item.vat || item.stawka_vat || 23),
    stock: parseInt(item.stock || item.stan || item.quantity || 0, 10),
    category: item.category || item.kategoria || null,
    description: item.description || item.opis || '',
    image_url: item.image_url || item.zdjecie || item.img || null,
  }));
}

async function fetchApiProducts(supplier) {
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

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('xml')) {
    const text = await response.text();
    return parseXmlProducts(text);
  }
  if (contentType.includes('csv')) {
    const text = await response.text();
    return parseCsvProducts(text);
  }

  // JSON default
  const json = await response.json();
  const items = Array.isArray(json) ? json : json.products || json.items || json.data || [];
  return items.map((item) => ({
    sku: item.sku || item.id || null,
    name: item.name || item.nazwa || '',
    price_net: parseFloat(item.price_net || item.price || 0),
    tax_rate: parseFloat(item.tax_rate || item.vat || 23),
    stock: parseInt(item.stock || item.quantity || 0, 10),
    category: item.category || item.kategoria || null,
    description: item.description || item.opis || '',
    image_url: item.image_url || item.image || null,
  }));
}

async function upsertProducts(rawProducts, storeId, supplierId, storeMargin) {
  let count = 0;
  const isCentral = !storeId;

  for (const raw of rawProducts) {
    if (!raw.name) continue;
    const priceGross = raw.price_net * (1 + raw.tax_rate / 100);
    const sellingPrice = priceGross * (1 + storeMargin / 100);

    // Upsert by SKU when available
    if (raw.sku) {
      // Build a single parameterised lookup/update regardless of central vs. store-scoped
      const lookupParams = isCentral ? [raw.sku] : [storeId, raw.sku];
      const lookupSql = isCentral
        ? 'SELECT id FROM products WHERE is_central = true AND sku = $1'
        : 'SELECT id FROM products WHERE store_id = $1 AND sku = $2';

      const existing = await db.query(lookupSql, lookupParams);
      if (existing.rows.length > 0) {
        // Common update fields ($1–$10), then dynamic WHERE params
        const updateCommon = [
          raw.name, raw.price_net, raw.tax_rate,
          priceGross.toFixed(2), sellingPrice.toFixed(2),
          storeMargin, raw.stock,
          raw.category, raw.description, raw.image_url,
        ];
        const updateParams = isCentral
          ? [...updateCommon, raw.sku]
          : [...updateCommon, storeId, raw.sku];

        const whereClause = isCentral
          ? 'WHERE is_central = true AND sku = $11'
          : 'WHERE store_id = $11 AND sku = $12';

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
           ${whereClause}`,
          updateParams
        );
        count++;
        continue;
      }
    }

    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, name, sku, price_net, tax_rate, price_gross, selling_price,
          margin, stock, category, description, image_url, is_central, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
      [uuidv4(), storeId, supplierId, raw.name, raw.sku || null,
       raw.price_net, raw.tax_rate, priceGross.toFixed(2), sellingPrice.toFixed(2),
       storeMargin, raw.stock, raw.category, raw.description, raw.image_url, isCentral]
    );
    count++;
  }
  return count;
}

module.exports = router;
