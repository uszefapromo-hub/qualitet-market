-- HurtDetalUszefaQUALITET – marketplace field extensions
-- Applies after 002_extended_schema.sql
-- Adds: custom_title, custom_description, margin_type, margin_value, selling_price,
--        source_snapshot to shop_products; shop_product_id to cart_items.

-- ─── shop_products – richer marketplace columns ───────────────────────────────

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS custom_title       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_description TEXT,
  ADD COLUMN IF NOT EXISTS margin_type        VARCHAR(10)    NOT NULL DEFAULT 'percent',  -- percent | fixed
  ADD COLUMN IF NOT EXISTS margin_value       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price      NUMERIC(12, 2),  -- computed: base_price + margin
  ADD COLUMN IF NOT EXISTS source_snapshot    JSONB;           -- snapshot of product at time of listing

-- ─── cart_items – track which shop_product was added ─────────────────────────

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS shop_product_id UUID REFERENCES shop_products (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_shop_product_id ON cart_items (shop_product_id);
