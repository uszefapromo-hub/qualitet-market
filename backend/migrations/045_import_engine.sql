-- Migration 045: Auto-import engine columns
--
-- Adds import tracking columns to the products table:
--   import_source  – connector identifier (e.g. 'wholesaler-a')
--   external_id    – product ID in the external wholesaler system
--
-- Together (import_source, external_id) form the deduplication key used by
-- the auto-import engine (import-engine.js) for central-catalogue products.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS import_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS external_id   VARCHAR(255);

-- Partial unique index: each (source, external_id) pair maps to one central product
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_import_source_external_id
  ON products (import_source, external_id)
  WHERE is_central = true AND import_source IS NOT NULL AND external_id IS NOT NULL;

-- Index to speed up active central-catalog queries from the shop frontend
CREATE INDEX IF NOT EXISTS idx_products_central_active
  ON products (is_central, status)
  WHERE is_central = true AND status = 'active';
