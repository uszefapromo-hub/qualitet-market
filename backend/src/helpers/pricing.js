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

module.exports = { DEFAULT_PLATFORM_TIERS, computePlatformPrice, dbTiersToArray };
