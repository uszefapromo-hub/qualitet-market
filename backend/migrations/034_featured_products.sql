-- Migration 034: Featured / quality-scored products
--
-- Adds columns needed by the supplier import quality-scoring system:
--   is_featured    – true when the product meets the quality threshold (auto-set on import)
--   quality_score  – numeric score 0–100 computed at import time
--   is_pinned      – admin can manually pin a product to the homepage / a category
--   pinned_at      – timestamp when the product was pinned

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured   BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_score SMALLINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned     BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at     TIMESTAMPTZ;

-- Speed up homepage / category featured queries
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products (is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_is_pinned   ON products (is_pinned)   WHERE is_pinned   = true;
