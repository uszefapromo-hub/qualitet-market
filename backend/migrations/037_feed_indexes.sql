-- Migration 037: Product feed performance indexes
-- Optimises the ranking queries used by GET /api/feed

-- Composite index for recommended/default feed ranking
CREATE INDEX IF NOT EXISTS idx_products_feed_recommended
  ON products (is_featured DESC, quality_score DESC, expected_reseller_profit DESC, created_at DESC)
  WHERE status = 'active';

-- Index for "best margin" section
CREATE INDEX IF NOT EXISTS idx_products_feed_best_margin
  ON products (expected_reseller_profit DESC NULLS LAST, quality_score DESC)
  WHERE status = 'active';

-- Index for "new arrivals" section
CREATE INDEX IF NOT EXISTS idx_products_feed_new
  ON products (created_at DESC)
  WHERE status = 'active';
