-- HurtDetalUszefaQUALITET – central catalog migration
-- Applies after 002_extended_schema.sql
-- Decouples products from individual stores so that the platform can maintain
-- a shared central catalogue. shop_products remains the store→product bridge.

-- ─── Make store_id optional in products ───────────────────────────────────────
-- Existing store-specific products retain their store_id.
-- New platform-level catalogue products have store_id = NULL.

ALTER TABLE products
  ALTER COLUMN store_id DROP NOT NULL;

-- ─── Mark central-catalogue products ─────────────────────────────────────────
-- is_central = true  → managed by platform admin/owner (no store owner)
-- is_central = false → created by a seller for their own store (legacy model)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_central BOOLEAN NOT NULL DEFAULT false;

-- Existing products without a store_id should be treated as central
UPDATE products SET is_central = true WHERE store_id IS NULL;

-- ─── Ensure shop_products.product_id still references products ────────────────
-- (No change needed; FK already ON DELETE CASCADE from migration 002.)

-- ─── Update supplier import index to handle NULL store_id ─────────────────────
-- Old index: (store_id, sku) – may include NULLs now; partial index for store products

DROP INDEX IF EXISTS idx_products_sku;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_store_sku
  ON products (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_central_sku
  ON products (sku)
  WHERE is_central = true AND sku IS NOT NULL;
