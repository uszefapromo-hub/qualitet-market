'use strict';

/**
 * Product Feed routes – Social Commerce product discovery.
 *
 * GET /api/feed
 *   Returns a ranked, paginated list of active central-catalog products.
 *
 *   Query params:
 *     section = recommended | trending | new | best_margin | bestsellers
 *               (default: recommended)
 *     page    = 1-based page number (default: 1)
 *     limit   = results per page, 1–50 (default: 20)
 *
 *   Each item in the response includes:
 *     – platform_price, recommended_reseller_price, expected_reseller_profit
 *     – quality_score, is_featured, badges[]
 *     – supplier_name (for seller discovery)
 *
 * Sellers can add any product to their store via:
 *   POST /api/my/store/products  { product_id, store_id }
 */

const express = require('express');
const db = require('../config/database');

const router = express.Router();

const VALID_SECTIONS = ['recommended', 'trending', 'new', 'best_margin', 'bestsellers'];
const MAX_LIMIT = 50;

// ─── Ranking helpers ───────────────────────────────────────────────────────────

/**
 * Return a safe ORDER BY expression for the requested feed section.
 * The `section` value is validated against the VALID_SECTIONS allowlist
 * before reaching this function, so no user-supplied string is ever
 * interpolated directly into SQL – only the fixed string literals below are used.
 */
function sectionOrderBy(section) {
  switch (section) {
    case 'trending':
      // Most engaging: high quality + recently stocked + freshly added
      return 'p.quality_score DESC, p.stock DESC NULLS LAST, p.created_at DESC';
    case 'new':
      return 'p.created_at DESC';
    case 'best_margin':
      return 'p.expected_reseller_profit DESC NULLS LAST, p.quality_score DESC';
    case 'bestsellers':
      return 'p.quality_score DESC, p.stock DESC NULLS LAST';
    case 'recommended':
    default:
      // Weighted composite: featured (×30 pts) + quality_score + profit/price ratio (×10)
      return `(
          COALESCE(p.is_featured::int, 0) * 30
          + COALESCE(p.quality_score, 0)
          + CASE WHEN COALESCE(p.platform_price, 0) > 0
              THEN LEAST(COALESCE(p.expected_reseller_profit, 0) / p.platform_price * 10, 20)
              ELSE 0 END
        ) DESC,
        p.created_at DESC`;
  }
}

/**
 * Derive display badges from a product row.
 */
function computeBadges(row) {
  const badges = [];
  const ageDays = (Date.now() - new Date(row.created_at).getTime()) / 86400000;
  if (ageDays <= 7) badges.push('new');
  if (row.is_featured) badges.push('featured');
  if ((row.quality_score || 0) >= 80) badges.push('bestseller');
  const profit = parseFloat(row.expected_reseller_profit) || 0;
  const price = parseFloat(row.platform_price) || 0;
  if (price > 0 && profit / price >= 0.20) badges.push('high_margin');
  return badges;
}

// ─── GET /api/feed ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const section = VALID_SECTIONS.includes(req.query.section)
      ? req.query.section
      : 'recommended';

    const limit  = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit,  10) || 20));
    const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;

    const orderBy = sectionOrderBy(section);

    const result = await db.query(
      `SELECT
          p.id,
          p.name,
          p.description,
          p.image_url,
          p.platform_price,
          p.recommended_reseller_price,
          p.expected_reseller_profit,
          p.expected_platform_profit,
          p.quality_score,
          p.is_featured,
          p.stock,
          p.supplier_id,
          p.created_at,
          s.name  AS supplier_name,
          COUNT(*) OVER() AS total_count
        FROM products p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE p.status = 'active'
          AND p.is_central = true
          AND (p.stock IS NULL OR p.stock > 0)
        ORDER BY ${orderBy}
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const rows     = result.rows;
    const total    = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
    const products = rows.map((row) => ({
      id:                        row.id,
      name:                      row.name,
      description:               row.description,
      image_url:                 row.image_url,
      platform_price:            row.platform_price            != null ? parseFloat(row.platform_price)            : null,
      recommended_reseller_price: row.recommended_reseller_price != null ? parseFloat(row.recommended_reseller_price) : null,
      expected_reseller_profit:  row.expected_reseller_profit  != null ? parseFloat(row.expected_reseller_profit)  : null,
      expected_platform_profit:  row.expected_platform_profit  != null ? parseFloat(row.expected_platform_profit)  : null,
      quality_score:             row.quality_score  || 0,
      is_featured:               row.is_featured    || false,
      stock:                     row.stock,
      supplier_id:               row.supplier_id,
      supplier_name:             row.supplier_name  || null,
      badges:                    computeBadges(row),
    }));

    return res.json({ section, page, limit, total, products });
  } catch (err) {
    console.error('feed error:', err.message);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
