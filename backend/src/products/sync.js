'use strict';

/**
 * Central database sync for imported products.
 *
 * Uses (import_source, external_id) as the deduplication key.
 * Updates pricing, stock, and score on every run.
 * Inserts new products that don't exist yet.
 *
 * Exported:
 *   upsertImportedProduct(enrichedProduct) → Promise<void>
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

/**
 * Upsert a single enriched product (from scoring.js) to the products table.
 *
 * Fields written to DB:
 *   import_source, external_id, name, cost_price, selling_price (sell_price),
 *   margin_value, margin_percent, quality_score (score), image_url (image),
 *   category, stock, status ('active'), updated_at
 *
 * @param {object} p  – enriched product (from scoreAndSort())
 * @returns {Promise<void>}
 */
async function upsertImportedProduct(p) {
  const {
    source,
    external_id,
    name,
    cost_price,
    sell_price,
    margin_value,
    margin_percent,
    score,
    image,
    category,
    stock,
    created_at,
  } = p;

  const existing = await db.query(
    `SELECT id FROM products
     WHERE is_central = true AND import_source = $1 AND external_id = $2`,
    [source, external_id]
  );

  if (existing.rows.length > 0) {
    // Update pricing, stock, score, sell_price – never duplicate
    await db.query(
      `UPDATE products SET
         name          = $1,
         cost_price    = $2,
         selling_price = $3,
         margin_value  = $4,
         margin_percent= $5,
         quality_score = $6,
         image_url     = $7,
         category      = $8,
         stock         = $9,
         status        = 'active',
         updated_at    = NOW()
       WHERE is_central = true AND import_source = $10 AND external_id = $11`,
      [
        name,
        cost_price.toFixed(2),
        sell_price.toFixed(2),
        margin_value.toFixed(2),
        margin_percent.toFixed(4),
        score,
        image,
        category || null,
        stock,
        source,
        external_id,
      ]
    );
  } else {
    // Insert new central-catalog product
    const sku = `${source}:${external_id}`;

    await db.query(
      `INSERT INTO products
         (id, store_id, supplier_id,
          import_source, external_id, sku,
          name, cost_price, supplier_price, price_net, price_gross,
          selling_price, margin_value, margin_percent, margin,
          quality_score, image_url, category, stock,
          is_central, status, created_at)
       VALUES
         ($1, NULL, NULL,
          $2, $3, $4,
          $5, $6, $6, $6, $6,
          $7, $8, $9, $8,
          $10, $11, $12, $13,
          true, 'active', $14)`,
      [
        uuidv4(),
        source,
        external_id,
        sku,
        name,
        cost_price.toFixed(2),
        sell_price.toFixed(2),
        margin_value.toFixed(2),
        margin_percent.toFixed(4),
        score,
        image,
        category || null,
        stock,
        created_at || new Date().toISOString(),
      ]
    );
  }
}

module.exports = { upsertImportedProduct };
