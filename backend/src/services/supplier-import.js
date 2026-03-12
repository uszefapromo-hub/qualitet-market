'use strict';

/**
 * Supplier Import Service
 *
 * Provides importSupplierProducts(supplier_id) for fetching products from a
 * configured supplier endpoint (API / XML / CSV) and upserting them into the
 * central catalogue.
 *
 * Field mapping per spec:
 *   supplier_name        → name
 *   supplier_sku         → sku
 *   supplier_description → description
 *   supplier_price       → price_gross
 *   supplier_stock       → stock
 *   supplier_image       → image_url
 *
 * Deduplication key: supplier_id + sku (per spec section 4).
 * On conflict: updates price_gross, stock, description, image_url.
 */

const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { parse: csvParse } = require('csv-parse/sync');
const xml2js = require('xml2js');

const db = require('../config/database');

const DEFAULT_TAX_RATE = 23; // Polish standard VAT rate (%)
const FETCH_TIMEOUT_MS = 15000; // 15 seconds

// ─── Platform pricing ──────────────────────────────────────────────────────────

/**
 * Compute the platform selling price from the supplier (gross) price.
 *
 * Markup tiers:
 *   supplier_price ≤ 20        → +60 %
 *   20 < supplier_price ≤ 100  → +40 %
 *   100 < supplier_price ≤ 300 → +25 %
 *   supplier_price > 300        → +15 %
 *
 * Returns a number rounded to 2 decimal places.
 */
function computePlatformPrice(supplierPrice) {
  const p = parseFloat(supplierPrice) || 0;
  let markup;
  if (p <= 20) {
    markup = 0.60;
  } else if (p <= 100) {
    markup = 0.40;
  } else if (p <= 300) {
    markup = 0.25;
  } else {
    markup = 0.15;
  }
  return parseFloat((p * (1 + markup)).toFixed(2));
}

// ─── Field mapping ─────────────────────────────────────────────────────────────

/**
 * Maps a raw supplier product object to the internal catalogue format.
 * Accepts both "supplier_*" prefixed keys and common unprefixed alternatives.
 */
function mapSupplierProduct(item) {
  return {
    name:        item.supplier_name        || item.name        || item.nazwa || item.title || '',
    sku:         item.supplier_sku         || item.sku         || item.SKU   || item.id    || item.kod || null,
    description: item.supplier_description || item.description || item.opis  || '',
    price_gross: parseFloat(
      item.supplier_price  ||
      item.price_gross     || item.cena_brutto ||
      item.price_net       || item.cena_netto  ||
      item.price           || 0
    ),
    stock:       parseInt(item.supplier_stock || item.stock || item.stan || item.quantity || 0, 10),
    image_url:   item.supplier_image || item.image_url || item.zdjecie || item.img || item.image || null,
    category:    item.category || item.kategoria || null,
  };
}

// ─── Parsers ───────────────────────────────────────────────────────────────────

function parseCsv(content) {
  const records = csvParse(content, { columns: true, skip_empty_lines: true, trim: true });
  return records.map(mapSupplierProduct);
}

async function parseXml(content) {
  const parsed = await xml2js.parseStringPromise(content, { explicitArray: false });
  const rootKey = Object.keys(parsed)[0];
  const root = parsed[rootKey];
  let items = root.product || root.products?.product || root.item || root.items?.item || [];
  if (!Array.isArray(items)) items = [items];
  return items.map(mapSupplierProduct);
}

// ─── Fetcher ───────────────────────────────────────────────────────────────────

/**
 * Fetch products from a supplier's configured endpoint.
 * Supports JSON, XML and CSV responses.
 *
 * @param {object} supplier  Row from the suppliers table.
 * @returns {Promise<object[]>} Array of mapped product objects.
 */
async function fetchSupplierProducts(supplier) {
  const url = supplier.api_url || supplier.xml_endpoint || supplier.csv_endpoint;
  if (!url) throw new Error('Supplier has no configured endpoint');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    const headers = {};
    if (supplier.api_key) headers['Authorization'] = `Bearer ${supplier.api_key}`;
    response = await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`Supplier endpoint returned ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('xml') || url.endsWith('.xml')) {
    return parseXml(await response.text());
  }
  if (contentType.includes('csv') || url.endsWith('.csv')) {
    return parseCsv(await response.text());
  }

  // Default: JSON
  const json = await response.json();
  const items = Array.isArray(json) ? json : json.products || json.items || json.data || [];
  return items.map(mapSupplierProduct);
}

// ─── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Upsert products into the central catalogue for the given supplier.
 *
 * Deduplication: supplier_id + sku.
 *   - Existing product → update price_gross, stock, description, image_url.
 *   - New product      → insert with status = 'active', is_central = true.
 *
 * @param {string}   supplierId
 * @param {object[]} rawProducts  Array of mapped product objects.
 * @returns {Promise<number>} Count of products inserted or updated.
 */
async function upsertSupplierProducts(supplierId, rawProducts) {
  let count = 0;

  for (const raw of rawProducts) {
    if (!raw.name) continue;

    const priceGross = parseFloat(raw.price_gross) || 0;
    const formattedPriceGross = priceGross.toFixed(2);

    // Compute platform price using tiered markup on the supplier (gross) price
    const platformPrice = computePlatformPrice(priceGross);

    if (raw.sku) {
      const existing = await db.query(
        'SELECT id FROM products WHERE supplier_id = $1 AND sku = $2',
        [supplierId, raw.sku]
      );

      if (existing.rows.length > 0) {
        // Update mutable fields per spec (section 4)
        await db.query(
          `UPDATE products SET
             price_gross       = $1,
             supplier_price    = $1,
             platform_price    = $2,
             min_selling_price = $2,
             selling_price     = $2,
             stock             = $3,
             description       = COALESCE($4, description),
             image_url         = COALESCE($5, image_url),
             status            = 'active',
             updated_at        = NOW()
           WHERE supplier_id = $6 AND sku = $7`,
          [
            formattedPriceGross,
            platformPrice,
            raw.stock,
            raw.description || null,
            raw.image_url   || null,
            supplierId,
            raw.sku,
          ]
        );
        count++;
        continue;
      }
    }

    // Insert new central-catalogue product
    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, name, sku, price_net, tax_rate, price_gross,
          supplier_price, platform_price, min_selling_price, selling_price, margin,
          stock, category, description, image_url,
          is_central, status, created_at)
       VALUES ($1, NULL, $2, $3, $4, 0, $5, $6, $6, $7, $7, $7, 0, $8, $9, $10, $11, true, 'active', NOW())`,
      [
        uuidv4(),
        supplierId,
        raw.name,
        raw.sku      || null,
        DEFAULT_TAX_RATE,
        formattedPriceGross,
        platformPrice,
        raw.stock,
        raw.category    || null,
        raw.description || null,
        raw.image_url   || null,
      ]
    );
    count++;
  }

  return count;
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch products from a supplier's configured endpoint and save them to the
 * central catalogue.  Updates last_sync_at on the supplier record.
 *
 * @param {string} supplier_id  UUID of the supplier row.
 * @returns {Promise<number>} Number of products imported or updated.
 */
async function importSupplierProducts(supplier_id) {
  const supplierResult = await db.query('SELECT * FROM suppliers WHERE id = $1', [supplier_id]);
  const supplier = supplierResult.rows[0];
  if (!supplier) throw new Error(`Supplier not found: ${supplier_id}`);

  const rawProducts = await fetchSupplierProducts(supplier);
  const count = await upsertSupplierProducts(supplier_id, rawProducts);

  await db.query(
    `UPDATE suppliers SET last_sync_at = NOW(), status = 'active' WHERE id = $1`,
    [supplier_id]
  );

  return count;
}

module.exports = { importSupplierProducts, upsertSupplierProducts, fetchSupplierProducts, mapSupplierProduct };
