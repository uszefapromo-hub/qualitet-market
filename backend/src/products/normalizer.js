'use strict';

/**
 * Product data normalizer.
 *
 * Converts raw connector output to a canonical product object and
 * validates all required fields.  Invalid products are rejected (null returned).
 *
 * Required fields (rejection if missing or invalid):
 *   source, external_id, name, cost_price (> 20 PLN), image, stock (> 0)
 *
 * Optional fields with defaults:
 *   category, created_at, rating, sales, shipping_time, currency
 */

const MIN_PRICE = 20; // PLN

/**
 * Normalize and validate a single raw product from a connector.
 *
 * @param {object} raw  – raw product from connector
 * @returns {object|null}  – normalized product or null if invalid
 */
function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const source      = String(raw.source || '').trim();
  const external_id = String(raw.external_id || '').trim();
  const name        = String(raw.name || '').trim();
  const image       = String(raw.image || '').trim();
  const cost_price  = parseFloat(raw.cost_price);
  const stock       = parseInt(raw.stock, 10);

  // Mandatory: source identifier
  if (!source) return null;

  // Mandatory: external id
  if (!external_id) return null;

  // Mandatory: non-empty name
  if (!name) return null;

  // Mandatory: non-empty image URL
  if (!image) return null;

  // Mandatory: price must be numeric and above the floor
  if (!isFinite(cost_price) || cost_price <= MIN_PRICE) return null;

  // Mandatory: must have stock > 0
  if (!isFinite(stock) || stock <= 0) return null;

  return {
    source,
    external_id,
    name,
    cost_price,
    image,
    category:      raw.category      ? String(raw.category).trim()    : null,
    stock,
    created_at:    raw.created_at    ? String(raw.created_at)         : new Date().toISOString(),
    rating:        raw.rating        != null ? parseFloat(raw.rating) : null,
    sales:         raw.sales         != null ? parseInt(raw.sales, 10): null,
    shipping_time: raw.shipping_time != null ? parseFloat(raw.shipping_time) : null,
    currency:      raw.currency      ? String(raw.currency).trim()    : 'PLN',
  };
}

/**
 * Normalize and deduplicate a list of raw products.
 *
 * - Runs normalizeProduct() on each item.
 * - Drops null results.
 * - Deduplicates by "source:external_id" (first occurrence wins).
 *
 * @param {Array} rawList  – raw items from one or more connectors
 * @returns {Array}        – valid, deduplicated normalized products
 */
function normalizeProducts(rawList) {
  const seen   = new Set();
  const result = [];

  for (const raw of rawList) {
    const product = normalizeProduct(raw);
    if (!product) continue;

    const key = `${product.source}:${product.external_id}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(product);
  }

  return result;
}

module.exports = { normalizeProduct, normalizeProducts, MIN_PRICE };
