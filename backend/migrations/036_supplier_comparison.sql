-- Migration 036: Supplier comparison & auto-publish system
--
-- Adds columns to products for the full pricing chain and supplier comparison:
--   recommended_reseller_price  – suggested price for resellers (sellers)
--   expected_platform_profit    – platform profit per unit (platform_price - supplier_cost)
--   expected_reseller_profit    – reseller profit per unit (reseller_price - platform_price)
--   alternative_suppliers       – JSON array of alternative supplier offers
--   source_quality_score        – composite score used to select best supplier source
--
-- Adds import_logs table for the Import/Product Control Center (task 10).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS recommended_reseller_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expected_platform_profit   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expected_reseller_profit   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS alternative_suppliers      JSONB    NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS source_quality_score       SMALLINT NOT NULL DEFAULT 0;

-- Import / sync log – one row per import run per supplier
CREATE TABLE IF NOT EXISTS import_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  sync_mode      VARCHAR(30) NOT NULL DEFAULT 'manual',   -- manual | scheduled | api
  status         VARCHAR(30) NOT NULL DEFAULT 'success',  -- success | failure | partial
  imported_count INTEGER     NOT NULL DEFAULT 0,
  updated_count  INTEGER     NOT NULL DEFAULT 0,
  skipped_count  INTEGER     NOT NULL DEFAULT 0,
  failed_count   INTEGER     NOT NULL DEFAULT 0,
  featured_count INTEGER     NOT NULL DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_logs_supplier_id ON import_logs (supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_started_at  ON import_logs (started_at DESC);
