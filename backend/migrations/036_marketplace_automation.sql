-- Migration 036: Full marketplace automation
--
-- Adds columns for end-to-end automated marketplace flow:
--   products:
--     recommended_reseller_price  – suggested selling price for resellers
--     expected_platform_profit    – expected gross profit per sale for the platform
--     expected_reseller_profit    – expected gross profit per sale for resellers
--     alternative_suppliers       – JSONB array of alternative supplier offers
--   orders:
--     supplier_cost               – total supplier/wholesale cost for the order
--     payment_fee                 – payment processor fee (Stripe, P24, etc.)
--     real_profit                 – actual platform profit after all costs
-- Creates:
--   import_logs – full audit trail of every supplier sync / import run

-- ─── Products: profit columns ─────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS recommended_reseller_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expected_platform_profit   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS expected_reseller_profit   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS alternative_suppliers      JSONB;

-- Backfill: compute from existing platform_price / supplier_price where available
-- Note: 1.20 = 1 + DEFAULT_RESELLER_MARGIN_PCT/100 (20% reseller margin – must stay in sync with pricing.js)
UPDATE products
SET recommended_reseller_price = ROUND(platform_price * 1.20, 2),
    expected_platform_profit   = ROUND(platform_price - COALESCE(supplier_price, 0), 2),
    expected_reseller_profit   = ROUND(platform_price * 1.20 - platform_price, 2)
WHERE platform_price IS NOT NULL
  AND recommended_reseller_price IS NULL;

-- ─── Orders: profitability columns ───────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_fee   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS real_profit   NUMERIC(12, 2);

-- ─── Import logs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  trigger       TEXT        NOT NULL DEFAULT 'manual', -- 'manual' | 'scheduled' | 'api'
  status        TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'success' | 'partial' | 'failure'
  count         INTEGER     NOT NULL DEFAULT 0,
  featured      INTEGER     NOT NULL DEFAULT 0,
  skipped       INTEGER     NOT NULL DEFAULT 0,
  failed        INTEGER     NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_supplier_id ON import_logs (supplier_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status      ON import_logs (status);
CREATE INDEX IF NOT EXISTS idx_import_logs_created_at  ON import_logs (created_at DESC);
