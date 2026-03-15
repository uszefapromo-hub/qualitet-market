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

// ─── Profit / reseller price helpers ──────────────────────────────────────────

/**
 * Default reseller margin percentage applied on top of platform_price when
 * computing the recommended selling price.
 */
const DEFAULT_RESELLER_MARGIN_PCT = 20;

/**
 * Compute the recommended reseller selling price.
 *
 * @param {number} platformPrice        – platform/wholesale price charged to resellers
 * @param {number} resellerMarginPct    – reseller markup percentage (default: 20)
 * @returns {number}                    – recommended selling price rounded to 2 dp
 */
function computeResellerPrice(platformPrice, resellerMarginPct = DEFAULT_RESELLER_MARGIN_PCT) {
  const price  = parseFloat(platformPrice)     || 0;
  const margin = parseFloat(resellerMarginPct) || DEFAULT_RESELLER_MARGIN_PCT;
  return parseFloat((price * (1 + margin / 100)).toFixed(2));
}

/**
 * Compute the expected platform gross profit per unit sold.
 *
 * @param {number} platformPrice  – platform_price (MY selling price to resellers)
 * @param {number} supplierPrice  – supplier_price (cost paid to wholesaler)
 * @returns {number}              – gross profit rounded to 2 dp
 */
function computeExpectedPlatformProfit(platformPrice, supplierPrice) {
  const sale = parseFloat(platformPrice)  || 0;
  const cost = parseFloat(supplierPrice)  || 0;
  return parseFloat((sale - cost).toFixed(2));
}

/**
 * Compute the expected reseller gross profit per unit sold.
 *
 * @param {number} resellerPrice  – recommended reseller selling price
 * @param {number} platformPrice  – platform_price (reseller's purchase price)
 * @returns {number}              – gross profit rounded to 2 dp
 */
function computeExpectedResellerProfit(resellerPrice, platformPrice) {
  const sale = parseFloat(resellerPrice) || 0;
  const cost = parseFloat(platformPrice) || 0;
  return parseFloat((sale - cost).toFixed(2));
}

/**
 * Compute the real net platform profit for a completed order.
 *
 * Formula: real_profit = sale_price - supplier_cost - payment_fee - other_costs
 *
 * @param {number} salePrice      – total order amount paid by customer
 * @param {number} supplierCost   – total supplier/wholesale cost for the order
 * @param {number} paymentFee     – payment processor fee (e.g. Stripe 2.9% + €0.30)
 * @param {number} otherCosts     – any other deductions (shipping, handling, etc.)
 * @returns {number}              – net profit rounded to 2 dp
 */
function computeRealProfit(salePrice, supplierCost = 0, paymentFee = 0, otherCosts = 0) {
  const sale    = parseFloat(salePrice)    || 0;
  const cost    = parseFloat(supplierCost) || 0;
  const fee     = parseFloat(paymentFee)   || 0;
  const other   = parseFloat(otherCosts)   || 0;
  return parseFloat((sale - cost - fee - other).toFixed(2));
}

/**
 * Estimate the Stripe payment processing fee for a given sale amount.
 * Default rate: 2.9% + €0.30 (standard Stripe EU rate).
 *
 * @param {number} amount         – transaction amount
 * @param {number} ratePercent    – percentage fee (default: 2.9)
 * @param {number} fixedFee       – fixed fee per transaction (default: 0.30)
 * @returns {number}              – estimated fee rounded to 2 dp
 */
function estimatePaymentFee(amount, ratePercent = 2.9, fixedFee = 0.30) {
  const a = parseFloat(amount) || 0;
  return parseFloat((a * (ratePercent / 100) + fixedFee).toFixed(2));
}

module.exports = {
  DEFAULT_PLATFORM_TIERS,
  DEFAULT_RESELLER_MARGIN_PCT,
  computePlatformPrice,
  dbTiersToArray,
  FEATURED_THRESHOLD,
  computeQualityScore,
  isProductFeatured,
  isLowQuality,
  computeResellerPrice,
  computeExpectedPlatformProfit,
  computeExpectedResellerProfit,
  computeRealProfit,
  estimatePaymentFee,
};
