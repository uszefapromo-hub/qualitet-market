-- HurtDetalUszefaQUALITET – marketplace model extensions
-- Run after 001_initial_schema.sql and 002_extended_schema.sql
-- Adds richer marketplace columns needed for the operator model.

-- ─── Products: status field ────────────────────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
-- Values: active | inactive | archived

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

-- ─── Shop products: marketplace listing fields ─────────────────────────────────
-- Sellers can customise title/description and specify a margin type + value;
-- selling_price is always computed and stored for fast querying.

ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS custom_title VARCHAR(255);
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS custom_description TEXT;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS margin_type VARCHAR(20) NOT NULL DEFAULT 'percent';
-- margin_type: percent | fixed
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS margin_value NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS source_snapshot JSONB;
-- snapshot of the product at listing time (name, price, sku, …)
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
-- Values: active | inactive | suspended

CREATE INDEX IF NOT EXISTS idx_shop_products_status2 ON shop_products (store_id, status);

-- ─── Cart items: shop_product reference ────────────────────────────────────────
-- Marketplace carts reference shop_products (not raw products) so the cart
-- carries the seller-specific listing (price, custom title, etc.)

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS shop_product_id UUID REFERENCES shop_products (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_shop_product_id ON cart_items (shop_product_id);
