-- HurtDetalUszefaQUALITET – central product catalog
-- Applies after 003_product_status.sql

-- ─── Make store_id optional ────────────────────────────────────────────────────
-- Platform-managed (central) products live without a store owner.
-- store_id = NULL → central catalog product (is_central = true)
-- store_id = UUID  → seller-owned product

ALTER TABLE products
  ALTER COLUMN store_id DROP NOT NULL;

-- ─── is_central flag ──────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark existing products with store_id = NULL as central
UPDATE products SET is_central = TRUE WHERE store_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_is_central ON products (is_central);

-- ─── Admin notes (informational) ─────────────────────────────────────────────
-- Central products (is_central=true, store_id=NULL) are managed by the platform
-- owner / admin and can be added to any store via shop_products.
-- Seller-owned products (store_id NOT NULL) belong to a specific store and may
-- also be referenced in shop_products for multi-store scenarios.
