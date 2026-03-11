-- HurtDetalUszefaQUALITET – performance indexes and data model hardening
-- Applies after 004_central_catalog.sql
-- Prepares the platform for 1 000 sellers and 100 000 products.

-- ─── shops (stores) – additional status columns/indexes ──────────────────────

-- Ensure stores can have all required status values
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_status_created
  ON stores (status, created_at DESC);

-- ─── shop_products – performance ─────────────────────────────────────────────

ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS custom_title       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_description TEXT,
  ADD COLUMN IF NOT EXISTS margin_type        VARCHAR(20) NOT NULL DEFAULT 'percent';

CREATE INDEX IF NOT EXISTS idx_shop_products_active_sort
  ON shop_products (store_id, active, sort_order);

CREATE INDEX IF NOT EXISTS idx_shop_products_margin_type
  ON shop_products (margin_type);

-- ─── products – performance indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_category
  ON products (category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_status_central
  ON products (status, is_central);

CREATE INDEX IF NOT EXISTS idx_products_supplier_id
  ON products (supplier_id)
  WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_name
  ON products (name);

-- ─── orders – status + buyer composite ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_store_id
  ON orders (store_id)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON orders (buyer_id, created_at DESC);

-- ─── payments – provider lookup ──────────────────────────────────────────────

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider              VARCHAR(50),
  ADD COLUMN IF NOT EXISTS provider_payment_id   VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments (order_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments (status);

-- ─── audit_logs – entity lookups ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (resource, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON audit_logs (created_at DESC);
