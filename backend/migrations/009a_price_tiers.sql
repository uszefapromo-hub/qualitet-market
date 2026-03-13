-- HurtDetalUszefaQUALITET – three-tier pricing system
-- Applies after 008_bigbuy_seed.sql

-- ─── products: price tier columns ─────────────────────────────────────────────
-- supplier_price   – price received from supplier / wholesale
-- platform_price   – after applying platform margin tier (visible in catalogue)
-- min_selling_price – minimum price a seller may charge (= platform_price)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_price    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS platform_price    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(12, 2);

-- Backfill: treat existing price_gross as supplier_price (best approximation)
UPDATE products
SET supplier_price    = price_gross,
    platform_price    = price_gross,
    min_selling_price = price_gross
WHERE supplier_price IS NULL;

-- ─── shop_products: seller margin & computed selling price ────────────────────

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS seller_margin NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2);

-- ─── platform_margin_config – configurable platform margin tiers ──────────────
-- threshold_max NULL means "above the previous threshold" (highest bracket).
-- category NULL means the rule applies globally (all categories).
-- Per-category rows take precedence over global rows with the same threshold.

CREATE TABLE IF NOT EXISTS platform_margin_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category      VARCHAR(100),                      -- NULL = global
  threshold_max NUMERIC(12, 2),                    -- NULL = catch-all (above last)
  margin_percent NUMERIC(5, 2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);

-- Seed default global tiers
INSERT INTO platform_margin_config (id, category, threshold_max, margin_percent)
VALUES
  (uuid_generate_v4(), NULL,  20,   60),
  (uuid_generate_v4(), NULL, 100,   40),
  (uuid_generate_v4(), NULL, 300,   25),
  (uuid_generate_v4(), NULL, NULL,  15)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_platform_margin_config_category
  ON platform_margin_config (category);
