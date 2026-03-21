'use strict';

/**
 * Product profitability scoring.
 *
 * Score formula:
 *   score = margin_points + freshness_points + stock_points
 *           + rating_points + sales_points - shipping_penalty
 *
 * Components:
 *   margin_points   (0–40)  – based on absolute margin value
 *   freshness_points(0–20)  – how recently the product was listed
 *   stock_points    (0–15)  – availability tier
 *   rating_points   (0–15)  – supplier/product rating (0–5 scale)
 *   sales_points    (0–10)  – historical sales volume
 *   shipping_penalty(0–10)  – deducted for slow shipping
 *
 * Products are sorted descending by score before being saved.
 */

const { computeAutoPrice } = require('../helpers/pricing');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the profitability score for a normalized product.
 *
 * @param {object} product  – normalized product (from normalizer.js)
 * @returns {{ score: number, margin_value: number, sell_price: number, margin_percent: number }}
 */
function computeScore(product) {
  const { cost_price, created_at, stock, rating, sales, shipping_time } = product;

  // ── Margin (0–40 points) ──────────────────────────────────────────────────
  const auto          = computeAutoPrice(cost_price);
  const margin_value  = auto.margin_value;
  const sell_price    = auto.sell_price;
  const margin_percent = auto.margin_percent;
  // Each 10 PLN of margin = 4 points, capped at 40
  const margin_points = Math.min(40, Math.floor(margin_value / 10) * 4);

  // ── Freshness (0–20 points) ───────────────────────────────────────────────
  const ageMs          = created_at ? Date.now() - new Date(created_at).getTime() : Infinity;
  const ageDays        = ageMs / MS_PER_DAY;
  // Lose 1 point per 30-day period; minimum 0
  const freshness_points = Math.max(0, Math.round(20 - ageDays / 30));

  // ── Stock (0–15 points) ───────────────────────────────────────────────────
  const s = parseInt(stock, 10) || 0;
  let stock_points;
  if      (s >= 50) stock_points = 15;
  else if (s >= 20) stock_points = 10;
  else if (s >= 5)  stock_points = 7;
  else              stock_points = 3; // stock >= 1 (already filtered below 1)

  // ── Rating (0–15 points) ──────────────────────────────────────────────────
  const r = parseFloat(rating);
  const rating_points = isFinite(r) && r > 0 ? Math.round((r / 5.0) * 15) : 0;

  // ── Sales (0–10 points) ───────────────────────────────────────────────────
  const sl = parseInt(sales, 10) || 0;
  const sales_points = Math.min(10, Math.floor(sl / 25));

  // ── Shipping penalty (0–10 deducted) ─────────────────────────────────────
  const st = parseFloat(shipping_time);
  const shipping_penalty = isFinite(st) && st > 0 ? Math.min(10, Math.round(st / 2)) : 0;

  const score = margin_points + freshness_points + stock_points
    + rating_points + sales_points - shipping_penalty;

  return { score, margin_value, sell_price, margin_percent };
}

/**
 * Enrich a list of normalized products with score + pricing fields.
 * Products with an insufficient margin (sell_price - cost_price < MIN_MARGIN)
 * are dropped.
 *
 * @param {Array}  products     – normalized products
 * @param {number} MIN_MARGIN   – minimum required absolute margin (PLN)
 * @returns {Array}             – enriched products sorted by score DESC
 */
const MIN_MARGIN = 30;

function scoreAndSort(products, minMargin = MIN_MARGIN) {
  const enriched = [];

  for (const p of products) {
    const { score, margin_value, sell_price, margin_percent } = computeScore(p);

    if (margin_value < minMargin) continue;

    enriched.push({ ...p, score, margin_value, sell_price, margin_percent });
  }

  // Sort: score DESC, then created_at DESC (newest first as tiebreaker)
  enriched.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return enriched;
}

module.exports = { computeScore, scoreAndSort, MIN_MARGIN };
