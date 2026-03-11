-- HurtDetalUszefaQUALITET – product status & shop_products custom fields
-- Applies after 002_extended_schema.sql

-- ─── Product status column ────────────────────────────────────────────────────
-- Status values: draft | pending | active | archived

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- ─── Shop products: custom title / description / margin type ─────────────────
-- custom_title      overrides the global product name in the shop listing
-- custom_description overrides the global product description
-- margin_type       'percent' (default) | 'fixed' – type of margin applied

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS custom_title       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_description TEXT,
  ADD COLUMN IF NOT EXISTS margin_type        VARCHAR(20) NOT NULL DEFAULT 'percent';

-- ─── Categories: updated_at ───────────────────────────────────────────────────

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- ─── Status reference (informational) ────────────────────────────────────────
-- shops    : pending | active | suspended | banned
-- products : draft   | pending | active | archived
-- orders   : created | paid | processing | shipped | delivered | cancelled
-- payments : pending | paid | failed | refunded
