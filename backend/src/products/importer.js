'use strict';

/**
 * Product Auto-Importer
 *
 * Pipeline: FETCH → FILTER → MARGIN → SORT → SAVE
 *
 * Fetches products from a data source (mock JSON on MVP), applies a
 * profitability filter, computes platform margins, sorts the results, and
 * upserts them into the central catalogue (is_central = true).
 *
 * Auto-refresh: call startAutoRefresh() to kick off a 60-second interval.
 *
 * Exported surface:
 *   fetchProducts()       – run the full pipeline once
 *   filterProducts(list)  – pure filter, exposed for unit-testing
 *   startAutoRefresh()    – start the 60 s interval
 *   MOCK_PRODUCTS         – the static source data (exported for tests)
 *   MIN_PRICE             – price floor filter constant
 *   MIN_MARGIN            – profitability floor constant
 *   MAX_RESULTS           – output cap constant
 */

const { v4: uuidv4 } = require('uuid');

const db = require('../config/database');
const {
  computePlatformPrice,
  computeQualityScore,
  isProductFeatured,
  computeResellerPrice,
  computeExpectedPlatformProfit,
  computeExpectedResellerProfit,
} = require('../helpers/pricing');

// ─── Constants ─────────────────────────────────────────────────────────────────

const MIN_PRICE    = 20;   // cost_price must be above this value (PLN)
const MIN_MARGIN   = 30;   // absolute platform margin must be >= this (PLN)
const MIN_RATING   = 4.0;  // optional rating threshold
const MIN_SALES    = 10;   // optional sales threshold
const MAX_RESULTS  = 50;   // maximum products sent to the catalogue
const AUTO_REFRESH_MS = 60_000; // 60 seconds
const DEFAULT_IMPORTED_STOCK = 10; // assumed stock for mock-imported products

// ─── Mock data source ──────────────────────────────────────────────────────────
// MVP: static JSON representing products from an external feed.
// Replace fetchRawProducts() with a real HTTP call or DB read when ready.

const MOCK_PRODUCTS = [
  { id: 'mp-001', name: 'Smartfon Samsung Galaxy A54',  price: 1299, image: 'https://cdn.qualitet.pl/products/samsung-a54.jpg',       category: 'smartfony',          rating: 4.5, sales: 120, created_at: '2024-03-01T10:00:00Z' },
  { id: 'mp-002', name: 'Laptop Lenovo IdeaPad 3',      price: 2499, image: 'https://cdn.qualitet.pl/products/lenovo-ideapad3.jpg',    category: 'komputery-i-laptopy', rating: 4.2, sales:  55, created_at: '2024-03-02T08:00:00Z' },
  { id: 'mp-003', name: 'Słuchawki Sony WH-1000XM5',   price:  899, image: 'https://cdn.qualitet.pl/products/sony-wh1000xm5.jpg',    category: 'elektronika',         rating: 4.8, sales:  88, created_at: '2024-03-03T09:30:00Z' },
  { id: 'mp-004', name: 'Kamera GoPro Hero 12',         price: 1599, image: 'https://cdn.qualitet.pl/products/gopro-hero12.jpg',      category: 'elektronika',         rating: 4.6, sales:  42, created_at: '2024-03-04T14:00:00Z' },
  { id: 'mp-005', name: 'Tablet Apple iPad Air',        price: 3499, image: 'https://cdn.qualitet.pl/products/ipad-air.jpg',          category: 'elektronika',         rating: 4.9, sales: 200, created_at: '2024-03-05T11:00:00Z' },
  { id: 'mp-006', name: 'Buty Nike Air Max 270',        price:  449, image: 'https://cdn.qualitet.pl/products/nike-air-max-270.jpg',  category: 'obuwie',              rating: 4.3, sales:  65, created_at: '2024-03-06T07:45:00Z' },
  { id: 'mp-007', name: 'Plecak Samsonite Vectura',     price:  299, image: 'https://cdn.qualitet.pl/products/samsonite-vectura.jpg', category: 'dodatki',             rating: 4.1, sales:  30, created_at: '2024-03-07T13:00:00Z' },
  { id: 'mp-008', name: 'Zegarek Casio G-Shock',        price:  349, image: 'https://cdn.qualitet.pl/products/casio-gshock.jpg',      category: 'dodatki',             rating: 4.4, sales:  50, created_at: '2024-03-08T10:30:00Z' },
  { id: 'mp-009', name: 'Odkurzacz Dyson V15',          price: 2199, image: 'https://cdn.qualitet.pl/products/dyson-v15.jpg',         category: 'sprzet-agd',          rating: 4.7, sales:  77, created_at: '2024-03-09T09:00:00Z' },
  { id: 'mp-010', name: 'Robot kuchenny Bosch MUM5',    price:  799, image: 'https://cdn.qualitet.pl/products/bosch-mum5.jpg',        category: 'sprzet-agd',          rating: 4.2, sales:  38, created_at: '2024-03-10T08:30:00Z' },
  { id: 'mp-011', name: 'Ekspres do kawy DeLonghi',     price:  999, image: 'https://cdn.qualitet.pl/products/delonghi-expresso.jpg', category: 'sprzet-agd',          rating: 4.5, sales:  55, created_at: '2024-03-11T12:00:00Z' },
  { id: 'mp-012', name: 'Monitor LG 27" 4K',            price: 1399, image: 'https://cdn.qualitet.pl/products/lg-monitor-4k.jpg',    category: 'komputery-i-laptopy', rating: 4.6, sales:  40, created_at: '2024-03-12T15:00:00Z' },
  { id: 'mp-013', name: 'Klawiatura mechaniczna Keychron K6', price: 349, image: 'https://cdn.qualitet.pl/products/keychron-k6.jpg', category: 'komputery-i-laptopy', rating: 4.7, sales:  25, created_at: '2024-03-13T10:00:00Z' },
  { id: 'mp-014', name: 'Kurtka zimowa Columbia',       price:  599, image: 'https://cdn.qualitet.pl/products/columbia-jacket.jpg',  category: 'moda',                rating: 4.3, sales:  18, created_at: '2024-03-14T11:30:00Z' },
  { id: 'mp-015', name: 'Namiot turystyczny Coleman',   price:  699, image: 'https://cdn.qualitet.pl/products/coleman-tent.jpg',     category: 'camping',             rating: 4.4, sales:  22, created_at: '2024-03-15T09:00:00Z' },
  { id: 'mp-016', name: 'Rower górski Merida Big Nine', price: 2299, image: 'https://cdn.qualitet.pl/products/merida-bignine.jpg',   category: 'kolarstwo',           rating: 4.6, sales:  35, created_at: '2024-03-16T10:00:00Z' },
  { id: 'mp-017', name: 'Hantle regulowane Bowflex',    price:  899, image: 'https://cdn.qualitet.pl/products/bowflex-hantle.jpg',   category: 'sprzet-fitness',      rating: 4.5, sales:  60, created_at: '2024-03-17T08:00:00Z' },
  { id: 'mp-018', name: 'Krem przeciwzmarszczkowy La Mer', price: 799, image: 'https://cdn.qualitet.pl/products/la-mer-cream.jpg',  category: 'pielegnacja-skory',   rating: 4.8, sales:  90, created_at: '2024-03-18T14:00:00Z' },
  { id: 'mp-019', name: 'Perfumy Chanel No. 5',         price: 699,  image: 'https://cdn.qualitet.pl/products/chanel-no5.jpg',      category: 'perfumy',             rating: 4.9, sales: 150, created_at: '2024-03-19T11:00:00Z' },
  { id: 'mp-020', name: 'Lampa podłogowa Philips Hue',  price:  549, image: 'https://cdn.qualitet.pl/products/philips-hue-lamp.jpg', category: 'oswietlenie',        rating: 4.2, sales:  28, created_at: '2024-03-20T10:30:00Z' },
  { id: 'mp-021', name: 'Sofa 3-osobowa IKEA Kivik',    price: 2499, image: 'https://cdn.qualitet.pl/products/ikea-kivik.jpg',       category: 'meble',              rating: 4.1, sales:  14, created_at: '2024-03-21T09:00:00Z' },
  { id: 'mp-022', name: 'Dywan wełniany ręcznie tkany', price:  849, image: 'https://cdn.qualitet.pl/products/dywan-welna.jpg',      category: 'dekoracje',          rating: 4.3, sales:  12, created_at: '2024-03-22T13:30:00Z' },
  { id: 'mp-023', name: 'Zestaw LEGO Technic 42143',    price:  599, image: 'https://cdn.qualitet.pl/products/lego-technic.jpg',     category: 'zabawki',            rating: 4.8, sales: 110, created_at: '2024-03-23T08:30:00Z' },
  { id: 'mp-024', name: 'Wózek dziecięcy Bugaboo Fox 3', price: 3999, image: 'https://cdn.qualitet.pl/products/bugaboo-fox3.jpg',   category: 'produkty-dla-niemowlat', rating: 4.7, sales: 45, created_at: '2024-03-24T10:00:00Z' },
  { id: 'mp-025', name: 'Aparat fotograficzny Sony A7 IV', price: 10999, image: 'https://cdn.qualitet.pl/products/sony-a7iv.jpg',   category: 'elektronika',        rating: 4.9, sales:  30, created_at: '2024-03-25T11:30:00Z' },
  { id: 'mp-026', name: 'Zestaw narzędzi Bosch Professional', price: 499, image: 'https://cdn.qualitet.pl/products/bosch-tools.jpg', category: 'narzedzia',          rating: 4.5, sales:  48, created_at: '2024-03-26T09:30:00Z' },
  { id: 'mp-027', name: 'Hulajnoga elektryczna Xiaomi Pro 2', price: 1999, image: 'https://cdn.qualitet.pl/products/xiaomi-scooter.jpg', category: 'motoryzacja',   rating: 4.4, sales:  65, created_at: '2024-03-27T08:00:00Z' },
  { id: 'mp-028', name: 'Walizka Samsonite Spinner 75', price:  799, image: 'https://cdn.qualitet.pl/products/samsonite-spinner.jpg', category: 'dodatki',          rating: 4.6, sales:  55, created_at: '2024-03-28T14:30:00Z' },
  { id: 'mp-029', name: 'Konsola PlayStation 5',        price: 2499, image: 'https://cdn.qualitet.pl/products/ps5.jpg',              category: 'gaming',            rating: 4.9, sales: 300, created_at: '2024-03-29T10:00:00Z' },
  { id: 'mp-030', name: 'Telewizor Samsung QLED 65"',   price: 4999, image: 'https://cdn.qualitet.pl/products/samsung-qled65.jpg',  category: 'tv-i-audio',         rating: 4.7, sales:  80, created_at: '2024-03-30T09:00:00Z' },
  // ── Products that should be FILTERED OUT (for test coverage) ──────────────
  // price <= MIN_PRICE
  { id: 'mp-031', name: 'Długopis BIC',                  price:   5, image: 'https://cdn.qualitet.pl/products/bic-pen.jpg',           category: 'artykuly-szkolne',  rating: 3.9, sales:   8, created_at: '2024-04-01T08:00:00Z' },
  // no image
  { id: 'mp-032', name: 'Kabel USB-C 2m',                price: 49,  image: '',                                                        category: 'elektronika',        rating: 4.1, sales:  20, created_at: '2024-04-02T08:00:00Z' },
  // no name
  { id: 'mp-033', name: '',                               price: 150, image: 'https://cdn.qualitet.pl/products/noname.jpg',             category: 'elektronika',        rating: 4.0, sales:  15, created_at: '2024-04-03T08:00:00Z' },
  // low rating (below 4.0)
  { id: 'mp-034', name: 'Taśma klejąca 10-pak',          price: 25,  image: 'https://cdn.qualitet.pl/products/tape-pack.jpg',          category: 'narzedzia',          rating: 3.5, sales:  30, created_at: '2024-04-04T08:00:00Z' },
  // low sales (below 10)
  { id: 'mp-035', name: 'Specjalistyczny klucz dynamometryczny', price: 120, image: 'https://cdn.qualitet.pl/products/torque-key.jpg', category: 'narzedzia',          rating: 4.2, sales:   5, created_at: '2024-04-05T08:00:00Z' },
];

// ─── Step 1: Fetch raw products ────────────────────────────────────────────────

/**
 * Fetch raw products from the data source.
 * MVP: returns the static MOCK_PRODUCTS list.
 * Replace with an HTTP call or other source as needed.
 *
 * @returns {Promise<Array>}
 */
async function fetchRawProducts() {
  return MOCK_PRODUCTS;
}

// ─── Step 2: Filter products ──────────────────────────────────────────────────

/**
 * Apply all mandatory and optional product filters.
 *
 * Mandatory filters (always applied):
 *   - price > MIN_PRICE (20 PLN)
 *   - image is a non-empty string
 *   - name is a non-empty string
 *   - no duplicate ids (first occurrence wins)
 *
 * Optional filters (applied when the field is present):
 *   - rating >= MIN_RATING (4.0) when rating field exists
 *   - sales > MIN_SALES (10) when sales field exists
 *
 * @param {Array} products
 * @returns {Array}
 */
function filterProducts(products) {
  const seenIds = new Set();
  return products.filter((p) => {
    // Deduplication
    if (seenIds.has(p.id)) return false;
    seenIds.add(p.id);

    // Mandatory: valid price
    if (!p.price || parseFloat(p.price) <= MIN_PRICE) return false;

    // Mandatory: has image
    if (!p.image || !String(p.image).trim()) return false;

    // Mandatory: has name
    if (!p.name || !String(p.name).trim()) return false;

    // Optional: rating threshold (only when field is present)
    if (p.rating != null && parseFloat(p.rating) < MIN_RATING) return false;

    // Optional: minimum sales (only when field is present)
    if (p.sales != null && parseInt(p.sales, 10) <= MIN_SALES) return false;

    return true;
  });
}

// ─── Step 3: Compute margin and apply profitability filter ────────────────────

/**
 * Enrich each product with computed pricing fields and filter out those with
 * insufficient platform margin (margin < MIN_MARGIN).
 *
 * @param {Array} products  – filtered product list
 * @returns {Array}         – products with .platform_price and .margin added
 */
function applyProfitabilityFilter(products) {
  return products.reduce((acc, p) => {
    const costPrice    = parseFloat(p.price);
    const platformPrice = computePlatformPrice(costPrice);
    const margin       = parseFloat((platformPrice - costPrice).toFixed(2));

    if (margin < MIN_MARGIN) return acc;

    acc.push({ ...p, platform_price: platformPrice, margin });
    return acc;
  }, []);
}

// ─── Step 4: Sort ─────────────────────────────────────────────────────────────

/**
 * Sort products:
 *  1. created_at DESC (newest first)
 *  2. margin DESC (most profitable first within same timestamp)
 *
 * @param {Array} products
 * @returns {Array}
 */
function sortProducts(products) {
  return [...products].sort((a, b) => {
    const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    return b.margin - a.margin;
  });
}

// ─── Step 5: Upsert to DB ─────────────────────────────────────────────────────

/**
 * Save a single enriched product to the products table as a central-catalogue
 * entry.  Uses the external `id` as the SKU for deduplication.
 *
 * @param {object} p  – enriched product object
 * @returns {Promise<void>}
 */
async function upsertProduct(p) {
  const costPrice      = parseFloat(p.price);
  const platformPrice  = p.platform_price;
  const resellerPrice  = computeResellerPrice(platformPrice);
  const platformProfit = computeExpectedPlatformProfit(platformPrice, costPrice);
  const resellerProfit = computeExpectedResellerProfit(resellerPrice, platformPrice);
  const qualityScore   = computeQualityScore({ image_url: p.image, stock: DEFAULT_IMPORTED_STOCK, price_gross: costPrice });
  const featured       = isProductFeatured({ image_url: p.image, stock: DEFAULT_IMPORTED_STOCK, price_gross: costPrice });

  // Use product's external id as the SKU to support upsert deduplication
  const sku = String(p.id);

  const existing = await db.query(
    'SELECT id FROM products WHERE is_central = true AND sku = $1',
    [sku]
  );

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE products SET
         name                        = $1,
         cost_price                  = $2,
         supplier_price              = $2,
         price_gross                 = $2,
         platform_price              = $3,
         min_selling_price           = $3,
         selling_price               = $3,
         margin                      = $4,
         image_url                   = $5,
         category                    = $6,
         quality_score               = $7,
         is_featured                 = $8,
         recommended_reseller_price  = $9,
         expected_platform_profit    = $10,
         expected_reseller_profit    = $11,
         status                      = 'active',
         updated_at                  = NOW()
       WHERE is_central = true AND sku = $12`,
      [
        p.name,
        costPrice.toFixed(2),
        platformPrice.toFixed(2),
        p.margin.toFixed(2),
        p.image,
        p.category || null,
        qualityScore,
        featured,
        resellerPrice.toFixed(2),
        platformProfit.toFixed(2),
        resellerProfit.toFixed(2),
        sku,
      ]
    );
  } else {
    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id, name, sku, price_net, tax_rate,
          cost_price, supplier_price, price_gross,
          platform_price, min_selling_price, selling_price,
          margin, stock, category, image_url,
          is_central, status,
          quality_score, is_featured,
          recommended_reseller_price, expected_platform_profit, expected_reseller_profit,
          created_at)
       VALUES
         ($1, NULL, NULL, $2, $3, 0, 23,
          $4, $4, $4,
          $5, $5, $5,
          $6, $15, $7, $8,
          true, 'active',
          $9, $10,
          $11, $12, $13,
          $14)`,
      [
        uuidv4(),
        p.name,
        sku,
        costPrice.toFixed(2),
        platformPrice.toFixed(2),
        p.margin.toFixed(2),
        p.category || null,
        p.image,
        qualityScore,
        featured,
        resellerPrice.toFixed(2),
        platformProfit.toFixed(2),
        resellerProfit.toFixed(2),
        p.created_at || new Date().toISOString(),
        DEFAULT_IMPORTED_STOCK,
      ]
    );
  }
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full import pipeline:
 *   FETCH → FILTER → MARGIN → SORT → SAVE
 *
 * Returns a summary object describing the run.
 *
 * @returns {Promise<{ total: number, passed: number, saved: number, skipped: number, errors: number }>}
 */
async function fetchProducts() {
  const raw      = await fetchRawProducts();
  const filtered = filterProducts(raw);
  const viable   = applyProfitabilityFilter(filtered);
  const sorted   = sortProducts(viable);
  const limited  = sorted.slice(0, MAX_RESULTS);

  const summary = { total: raw.length, passed: limited.length, saved: 0, skipped: 0, errors: 0 };

  for (const product of limited) {
    try {
      await upsertProduct(product);
      summary.saved++;
    } catch (err) {
      summary.errors++;
      console.error(`[importer] Failed to save product "${product.name}" (${product.id}):`, err.message);
    }
  }

  console.log(
    `[importer] Run complete – total: ${summary.total}, passed filters: ${summary.passed}, ` +
    `saved: ${summary.saved}, errors: ${summary.errors}`
  );

  return summary;
}

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

/**
 * Start the automatic 60-second refresh loop.
 * Runs fetchProducts() immediately and then every AUTO_REFRESH_MS milliseconds.
 *
 * @returns {NodeJS.Timeout}  The interval handle (use clearInterval to stop).
 */
function startAutoRefresh() {
  fetchProducts().catch((err) => {
    console.error('[importer] Initial fetch error:', err.message);
  });

  const handle = setInterval(() => {
    fetchProducts().catch((err) => {
      console.error('[importer] Scheduled fetch error:', err.message);
    });
  }, AUTO_REFRESH_MS);

  return handle;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  fetchProducts,
  filterProducts,
  applyProfitabilityFilter,
  sortProducts,
  startAutoRefresh,
  MOCK_PRODUCTS,
  MIN_PRICE,
  MIN_MARGIN,
  MAX_RESULTS,
  AUTO_REFRESH_MS,
  DEFAULT_IMPORTED_STOCK,
};
