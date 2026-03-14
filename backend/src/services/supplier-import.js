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
 *   supplier_price       → supplier_price / price_gross
 *   supplier_stock       → stock
 *   supplier_image       → image_url
 *
 * Pricing chain (Step 4):
 *   supplier_price → platform_price (tiered margin) → min_selling_price
 *   selling_price = platform_price (sellers can apply their own store margin on top)
 *
 * Deduplication key: supplier_id + sku (per spec section 4).
 * On conflict: updates supplier_price, platform_price, stock, description, image_url.
 */

const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const { parse: csvParse } = require('csv-parse/sync');
const xml2js = require('xml2js');

const db = require('../config/database');
const { computePlatformPrice } = require('../helpers/pricing');

const DEFAULT_TAX_RATE = 23; // Polish standard VAT rate (%)
const FETCH_TIMEOUT_MS = 15000; // 15 seconds

// ─── Category mapping ──────────────────────────────────────────────────────────

/**
 * Maps a free-text category from the supplier feed to one of our platform
 * category slugs.  Uses keyword matching; returns null if no match.
 *
 * @param {string|null} rawCategory  Category text from the supplier.
 * @returns {string|null}            Matching platform category slug or null.
 */
function mapCategorySlug(rawCategory) {
  if (!rawCategory) return null;
  // Normalize: lowercase + strip diacritics so Polish chars (ę→e, ś→s, etc.) match
  // NFD decomposes most Polish chars into base+combining; ł needs an explicit replacement
  const c = rawCategory.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');

  if (/smartfon|phone|mobil|telefon/.test(c))           return 'smartfony';
  if (/laptop|notebook|komputer|computer/.test(c))      return 'komputery-i-laptopy';
  if (/tv|telewizor|audio|glosnik|sound/.test(c))       return 'tv-i-audio';
  if (/gaming|gier|konsol|controller/.test(c))          return 'gaming';
  if (/elektronika|electronic/.test(c))                 return 'elektronika';

  if (/mebel|furniture|sofa|krzeslo/.test(c))            return 'meble';
  if (/dekor|decor|obraz|swiecznik/.test(c))            return 'dekoracje';
  if (/agd|kuchenn|piekarnik|lodowk/.test(c))           return 'sprzet-agd';
  if (/lampa|swiat|oswietl|lighting/.test(c))           return 'oswietlenie';
  if (/dom|home|ogrod|garden/.test(c))                  return 'dom-i-ogrod';

  if (/koszul|shirt|bluza|sweter|men.cloth|mesk/.test(c)) return 'odziez-meska';
  if (/sukienk|bluzk|women.cloth|damsk/.test(c))          return 'odziez-damska';
  if (/but|shoe|sneaker|obuwie/.test(c))                   return 'obuwie';
  if (/toreb|bizuter/.test(c))                             return 'dodatki';
  if (/moda|fashion|odziez|clothing/.test(c))              return 'moda';

  if (/kosmetyk|makeup|cosmetic/.test(c))               return 'kosmetyki';
  if (/perfum|fragrance/.test(c))                       return 'perfumy';
  if (/wlos|hair/.test(c))                              return 'pielegnacja-wlosow';
  if (/skor|skin|krem|cream/.test(c))                   return 'pielegnacja-skory';
  if (/zdrowie|health|uroda|beauty/.test(c))            return 'zdrowie-i-uroda';

  if (/fitness|silown|gym|hantel/.test(c))              return 'sprzet-fitness';
  if (/rower|cycl|bike/.test(c))                        return 'kolarstwo';
  if (/camping|kemping|namiot|tent/.test(c))            return 'camping';
  if (/sport|outdoor/.test(c))                          return 'sport-i-outdoor';

  if (/zabawk|toy/.test(c))                             return 'zabawki';
  if (/niemowl|baby|infant/.test(c))                    return 'produkty-dla-niemowlat';
  if (/szkoln|school|plecak|zeszyt/.test(c))            return 'artykuly-szkolne';
  if (/dzieci|kids|child/.test(c))                      return 'dzieci-i-zabawki';

  if (/samochod|car\b|car\s|auto/.test(c))              return 'akcesoria-samochodowe';
  if (/narzedzi|tool|wiertl/.test(c))                   return 'narzedzia';
  if (/motocykl|motorcycle|moto/.test(c))               return 'akcesoria-motocyklowe';
  if (/motoryzacj|automotive/.test(c))                  return 'motoryzacja';

  if (/pies|psa|psu|psom|dog|szczeni/.test(c))          return 'dla-psa';
  if (/kot|cat|kitten/.test(c))                         return 'dla-kota';
  if (/akwarium|aquar|ryb/.test(c))                     return 'akwaria';
  if (/zwierz|pet|zool/.test(c))                        return 'zoologia';

  if (/drukark|printer/.test(c))                        return 'drukarki';
  if (/biurk|biuro|office|desk/.test(c))                return 'sprzet-biurowy';
  if (/mebel.*biur|office.*furni/.test(c))              return 'meble-biurowe';

  return null;
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
 *   - Existing product → update supplier_price, platform_price, stock,
 *                        description, image_url.
 *   - New product      → insert with status = 'active', is_central = true.
 *
 * Pricing chain (Step 4):
 *   supplier_price → platform_price (tiered margin) = min_selling_price
 *   selling_price is set to platform_price; sellers apply their own margin on top.
 *
 * @param {string}   supplierId
 * @param {object[]} rawProducts  Array of mapped product objects.
 * @returns {Promise<number>} Count of products inserted or updated.
 */
async function upsertSupplierProducts(supplierId, rawProducts) {
  let count = 0;

  for (const raw of rawProducts) {
    if (!raw.name) continue;

    const supplierPrice = parseFloat(raw.price_gross) || 0;
    const platformPrice = computePlatformPrice(supplierPrice);
    const categorySlug  = mapCategorySlug(raw.category);

    if (!categorySlug && raw.category) {
      console.warn(`[import] Unmapped category "${raw.category}" for product "${raw.name}" – stored as free-text`);
    }

    if (raw.sku) {
      const existing = await db.query(
        'SELECT id FROM products WHERE supplier_id = $1 AND sku = $2',
        [supplierId, raw.sku]
      );

      if (existing.rows.length > 0) {
        // Update mutable fields per spec (section 4)
        await db.query(
          `UPDATE products SET
             supplier_price  = $1,
             platform_price  = $2,
             price_gross     = $2,
             selling_price   = $2,
             min_selling_price = $2,
             stock           = $3,
             description     = COALESCE($4, description),
             image_url       = COALESCE($5, image_url),
             status          = 'active',
             updated_at      = NOW()
           WHERE supplier_id = $6 AND sku = $7`,
          [
            supplierPrice.toFixed(2),
            platformPrice.toFixed(2),
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
         (id, store_id, supplier_id, name, sku, price_net, tax_rate,
          supplier_price, price_gross, platform_price, min_selling_price,
          selling_price, margin, stock, category, description, image_url,
          is_central, status, created_at)
       VALUES ($1, NULL, $2, $3, $4, 0, $5, $6, $7, $7, $7, $7, 0, $8, $9, $10, $11, true, 'active', NOW())`,
      [
        uuidv4(),
        supplierId,
        raw.name,
        raw.sku            || null,
        DEFAULT_TAX_RATE,
        supplierPrice.toFixed(2),
        platformPrice.toFixed(2),
        raw.stock,
        categorySlug       || raw.category || null,
        raw.description    || null,
        raw.image_url      || null,
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

module.exports = { importSupplierProducts, upsertSupplierProducts, fetchSupplierProducts, mapSupplierProduct, mapCategorySlug };
