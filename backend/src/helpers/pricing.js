'use strict';

/**
 * Platform pricing helpers.
 *
 * DEFAULT_PLATFORM_TIERS – default tiered platform margin schedule.
 * Each tier: { maxPrice, marginPercent }.  maxPrice=null means "above all others".
 *
 * computePlatformPrice(supplierPrice, tiers?) → platform_price (rounded to 2 dp).
 */

const DEFAULT_PLATFORM_TIERS = [
  { maxPrice: 20,   marginPercent: 60 },
  { maxPrice: 100,  marginPercent: 40 },
  { maxPrice: 300,  marginPercent: 25 },
  { maxPrice: null, marginPercent: 15 },
];

/**
 * Compute the platform price (= supplier_price * (1 + marginPercent/100)).
 *
 * @param {number} supplierPrice  – gross supplier price
 * @param {Array}  tiers          – optional override; defaults to DEFAULT_PLATFORM_TIERS
 * @returns {number}              – platform price rounded to 2 decimal places
 */
function computePlatformPrice(supplierPrice, tiers = DEFAULT_PLATFORM_TIERS) {
  const price = parseFloat(supplierPrice) || 0;

  let marginPercent = tiers[tiers.length - 1].marginPercent; // fallback
  for (const tier of tiers) {
    if (tier.maxPrice === null || price <= tier.maxPrice) {
      marginPercent = tier.marginPercent;
      break;
    }
  }

  const platformPrice = price * (1 + marginPercent / 100);
  return parseFloat(platformPrice.toFixed(2));
}

/**
 * Convert rows from platform_margin_config table into the tiers array expected
 * by computePlatformPrice.  Rows should already be sorted ascending by
 * threshold_max NULLS LAST.
 *
 * @param {Array} rows – rows from platform_margin_config (threshold_max, margin_percent)
 * @returns {Array}
 */
function dbTiersToArray(rows) {
  return rows.map((configRow) => ({
    maxPrice:      configRow.threshold_max !== null ? parseFloat(configRow.threshold_max) : null,
    marginPercent: parseFloat(configRow.margin_percent),
  }));
}

// ─── Quality scoring ───────────────────────────────────────────────────────────

/**
 * Score threshold above which a product is auto-marked as featured.
 * A product scoring >= FEATURED_THRESHOLD will have is_featured = true.
 */
const FEATURED_THRESHOLD = 50;

/**
 * Compute a quality score (0–100) for a supplier product.
 *
 * Criteria:
 *   +30  – has a non-empty image URL
 *   +25  – has a description of at least 10 characters
 *   +20  – stock > 0
 *   +15  – stock > 5 (bonus for good availability)
 *   +10  – price_gross > 0 (valid price present)
 *
 * @param {{ image_url?: string|null, description?: string|null, stock?: number, price_gross?: number }} product
 * @returns {number} Integer quality score 0–100.
 */
function computeQualityScore({ image_url = null, description = null, stock = 0, price_gross = 0 } = {}) {
  let score = 0;
  if (image_url && String(image_url).trim().length > 0)            score += 30;
  if (description && String(description).trim().length >= 10)      score += 25;
  const stockNum = parseInt(stock, 10) || 0;
  if (stockNum > 0)                                                 score += 20;
  if (stockNum > 5)                                                 score += 15;
  const priceNum = parseFloat(price_gross) || 0;
  if (priceNum > 0)                                                 score += 10;
  return Math.min(100, score);
}

/**
 * Returns true when a product's quality score meets the featured threshold.
 *
 * @param {object} product – any object accepted by computeQualityScore
 * @returns {boolean}
 */
function isProductFeatured(product) {
  return computeQualityScore(product) >= FEATURED_THRESHOLD;
}

/**
 * Returns true when a product is considered too low-quality to import.
 * A product is rejected only when it has NO image AND NO description AND zero stock.
 *
 * @param {{ image_url?: string|null, description?: string|null, stock?: number }} product
 * @returns {boolean}
 */
function isLowQuality({ image_url = null, description = null, stock = 0 } = {}) {
  const hasImage       = image_url && String(image_url).trim().length > 0;
  const hasDescription = description && String(description).trim().length >= 10;
  const hasStock       = (parseInt(stock, 10) || 0) > 0;
  return !hasImage && !hasDescription && !hasStock;
}

// ─── Reseller / profit pricing ────────────────────────────────────────────────

/**
 * Default reseller margin percentage applied on top of the platform price.
 * Sellers can override this per store; this is the suggested/recommended value.
 */
const DEFAULT_RESELLER_MARGIN_PERCENT = 15;

/**
 * Compute the recommended reseller selling price.
 *
 * @param {number} platformPrice       – platform price (= min_selling_price)
 * @param {number} [resellerMargin]    – reseller margin %; defaults to DEFAULT_RESELLER_MARGIN_PERCENT
 * @returns {number}                   – recommended reseller price rounded to 2 dp
 */
function computeResellerPrice(platformPrice, resellerMargin = DEFAULT_RESELLER_MARGIN_PERCENT) {
  const p = parseFloat(platformPrice) || 0;
  const m = parseFloat(resellerMargin) || DEFAULT_RESELLER_MARGIN_PERCENT;
  return parseFloat((p * (1 + m / 100)).toFixed(2));
}

/**
 * Compute expected profits for both platform and reseller.
 *
 * @param {number} supplierCost        – what the platform pays the supplier
 * @param {number} platformPrice       – platform selling price (= min_selling_price)
 * @param {number} resellerPrice       – recommended reseller selling price
 * @returns {{ platformProfit: number, resellerProfit: number }}
 */
function computeProfits(supplierCost, platformPrice, resellerPrice) {
  const cost        = parseFloat(supplierCost)  || 0;
  const platPrice   = parseFloat(platformPrice) || 0;
  const reselPrice  = parseFloat(resellerPrice) || 0;
  return {
    platformProfit: parseFloat((platPrice  - cost).toFixed(2)),
    resellerProfit: parseFloat((reselPrice - platPrice).toFixed(2)),
  };
}

// ─── Supplier comparison / best-source selection ──────────────────────────────

/**
 * Selection modes for best-supplier comparison.
 *   'lowest_cost'    – prefer the cheapest supplier price
 *   'best_margin'    – prefer the offer that maximises platform margin
 *   'best_quality'   – prefer the supplier with the highest quality score (default)
 */
const SELECTION_MODES = ['lowest_cost', 'best_margin', 'best_quality'];

/**
 * Compute a composite "source quality score" for a single supplier offer.
 *
 * Criteria (additive, max 100):
 *   +30  – has image URL
 *   +25  – description ≥ 10 chars
 *   +20  – stock > 0
 *   +15  – stock > 5
 *   +10  – price_gross > 0
 *
 * This intentionally mirrors computeQualityScore – kept separate so each
 * concept (product quality vs. source quality) can diverge in future.
 *
 * @param {object} offer  – a supplier offer object
 * @returns {number}
 */
function computeSourceQualityScore(offer) {
  return computeQualityScore(offer);
}

/**
 * Select the best supplier offer from a list of competing offers.
 *
 * @param {Array<object>} offers  – each item must have: price_gross, stock, image_url, description
 * @param {'lowest_cost'|'best_margin'|'best_quality'} [mode='best_quality']
 * @returns {object|null}         – the winning offer, or null for empty input
 */
function selectBestSupplier(offers, mode = 'best_quality') {
  if (!Array.isArray(offers) || offers.length === 0) return null;
  if (offers.length === 1) return offers[0];

  const scored = offers.map((o) => {
    const qualityScore = computeSourceQualityScore(o);
    const price = parseFloat(o.price_gross) || 0;
    const platformPrice = computePlatformPrice(price);
    const platformProfit = platformPrice - price;
    return { ...o, _qualityScore: qualityScore, _price: price, _platformProfit: platformProfit };
  });

  if (mode === 'lowest_cost') {
    scored.sort((a, b) => a._price - b._price);
  } else if (mode === 'best_margin') {
    scored.sort((a, b) => b._platformProfit - a._platformProfit);
  } else {
    // best_quality (default) – quality first, break ties by lowest cost
    scored.sort((a, b) => {
      if (b._qualityScore !== a._qualityScore) return b._qualityScore - a._qualityScore;
      return a._price - b._price;
    });
  }

  return scored[0];
}

module.exports = {
  DEFAULT_PLATFORM_TIERS,
  computePlatformPrice,
  dbTiersToArray,
  FEATURED_THRESHOLD,
  computeQualityScore,
  isProductFeatured,
  isLowQuality,
  DEFAULT_RESELLER_MARGIN_PERCENT,
  computeResellerPrice,
  computeProfits,
  SELECTION_MODES,
  computeSourceQualityScore,
  selectBestSupplier,
};
