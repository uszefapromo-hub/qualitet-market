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

// ─── Supplier comparison ───────────────────────────────────────────────────────

/**
 * Select the best supplier from a list of offers for the same product.
 *
 * @param {Array}  offers  Array of offer objects; each must have at least:
 *                         { supplier_price, platform_price, quality_score, stock }.
 * @param {'lowest_cost'|'best_margin'|'best_quality'} mode
 * @returns {object|null}  The winning offer, or null when the array is empty.
 */
function selectBestSupplier(offers, mode = 'lowest_cost') {
  if (!offers || offers.length === 0) return null;

  // Prefer in-stock offers; fall back to all offers when everything is out-of-stock.
  // parseInt is intentional: stock may arrive as a string from DB rows or JSON feeds.
  const inStock = offers.filter((o) => (parseInt(o.stock, 10) || 0) > 0);
  const candidates = inStock.length > 0 ? inStock : offers;

  switch (mode) {
    case 'best_margin': {
      // Highest (platform_price − supplier_price) = most platform profit per unit
      return candidates.reduce((best, o) => {
        const margin     = parseFloat(o.platform_price || 0) - parseFloat(o.supplier_price || 0);
        const bestMargin = parseFloat(best.platform_price || 0) - parseFloat(best.supplier_price || 0);
        return margin > bestMargin ? o : best;
      });
    }

    case 'best_quality': {
      // Highest quality_score; tie-break on lowest supplier_price
      return candidates.reduce((best, o) => {
        const qs     = parseFloat(o.quality_score || 0);
        const bestQs = parseFloat(best.quality_score || 0);
        if (qs > bestQs) return o;
        if (qs === bestQs && parseFloat(o.supplier_price || 0) < parseFloat(best.supplier_price || 0)) return o;
        return best;
      });
    }

    case 'lowest_cost':
    default: {
      // Lowest supplier_price
      return candidates.reduce((best, o) =>
        parseFloat(o.supplier_price || 0) < parseFloat(best.supplier_price || 0) ? o : best
      );
    }
  }
}

module.exports = {
  DEFAULT_PLATFORM_TIERS,
  computePlatformPrice,
  dbTiersToArray,
  FEATURED_THRESHOLD,
  computeQualityScore,
  isProductFeatured,
  isLowQuality,
  selectBestSupplier,
};
