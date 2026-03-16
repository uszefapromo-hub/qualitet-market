-- Migration 038: Activate central-catalog products for feed ranking
--
-- Existing seeded products (migration 012) have quality_score = 0 and
-- is_featured = false, which means the feed returns them but the ranking
-- is flat.  This migration:
--
--   1. Computes a quality_score (0–100) for every active central-catalog
--      product that still has score 0, using readily-available columns.
--   2. Marks the top-scoring products as is_featured = true (at least 5).
--   3. Ensures expected_reseller_profit and recommended_reseller_price are
--      populated (idempotent back-fill matching migration 036 logic).
--
-- All statements are idempotent via WHERE guards.

-- ── 1. Back-fill profit columns if migration 036 was not yet applied ─────────
-- Note: expected_platform_profit is left NULL when supplier_price is unknown,
--       to avoid overstating profitability (platform profit = sale price minus cost).
UPDATE products
SET recommended_reseller_price = ROUND(platform_price * 1.20, 2),
    expected_platform_profit   = CASE
                                   WHEN supplier_price IS NOT NULL AND supplier_price > 0
                                   THEN ROUND(platform_price - supplier_price, 2)
                                   ELSE NULL
                                 END,
    expected_reseller_profit   = ROUND(platform_price * 1.20 - platform_price, 2)
WHERE is_central = true
  AND status     = 'active'
  AND platform_price IS NOT NULL
  AND recommended_reseller_price IS NULL;

-- ── 2. Compute quality_score for products that still have score 0 ─────────────
--
--  Scoring rubric (max 100):
--    +25  has a non-empty image_url
--    +20  description longer than 40 characters
--    +15  stock ≥ 50
--    +10  stock between 10 and 49
--    +15  expected_reseller_profit / platform_price ≥ 0.25 (25 % margin)
--    +10  expected_reseller_profit / platform_price ≥ 0.15 (15 % margin)
--    +15  supplier_price is set (product originates from a real supplier)
--
UPDATE products
SET quality_score = LEAST(100, (
    CASE WHEN image_url IS NOT NULL AND image_url <> '' THEN 25 ELSE 0 END
  + CASE WHEN description IS NOT NULL AND LENGTH(description) > 40 THEN 20 ELSE 0 END
  + CASE WHEN COALESCE(stock, 0) >= 50 THEN 15
         WHEN COALESCE(stock, 0) >= 10 THEN 10
         ELSE 0 END
  + CASE WHEN platform_price > 0
          AND expected_reseller_profit IS NOT NULL
          AND expected_reseller_profit / platform_price >= 0.25 THEN 15
         WHEN platform_price > 0
          AND expected_reseller_profit IS NOT NULL
          AND expected_reseller_profit / platform_price >= 0.15 THEN 10
         ELSE 0 END
  + CASE WHEN supplier_price IS NOT NULL AND supplier_price > 0 THEN 15 ELSE 0 END
))
WHERE is_central   = true
  AND status       = 'active'
  AND quality_score = 0;

-- ── 3. Mark top products as featured (idempotent: only sets, never clears) ────
--
--  Select the 10 highest-scored active central-catalog products and flag them.
--  The feed uses is_featured as a primary ranking signal.

UPDATE products
SET is_featured = true
WHERE id IN (
  SELECT id
  FROM   products
  WHERE  is_central  = true
    AND  status      = 'active'
    AND  quality_score > 0
  ORDER  BY quality_score DESC, stock DESC NULLS LAST
  LIMIT  10
)
AND is_featured = false;
