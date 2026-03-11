-- HurtDetalUszefaQUALITET – marketplace schema expansion
-- Run after 001_initial_schema.sql
-- psql -U postgres -d hurtdetal_qualitet -f 002_marketplace_schema.sql

-- ─── Alter products: make store_id optional (global catalog) ──────────────────
-- Products now belong to the central platform catalog, not individual stores.
ALTER TABLE products ALTER COLUMN store_id DROP NOT NULL;

-- Add status to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';
-- active | inactive | archived

-- ─── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id  UUID REFERENCES categories (id) ON DELETE SET NULL,
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(100) UNIQUE NOT NULL,
  status     VARCHAR(30) NOT NULL DEFAULT 'active',   -- active | inactive
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug      ON categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_status    ON categories (status);

-- Update products.category to optionally reference categories
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

-- ─── Product images ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

-- ─── Shop products (marketplace link table) ────────────────────────────────────
-- A shop owner picks a global product and optionally customises title/description
-- and sets a margin on top of the base price.
CREATE TABLE IF NOT EXISTS shop_products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id            UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  custom_title       VARCHAR(255),
  custom_description TEXT,
  margin_type        VARCHAR(20) NOT NULL DEFAULT 'percent',  -- percent | fixed
  margin_value       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  selling_price      NUMERIC(12, 2) NOT NULL,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  status             VARCHAR(30) NOT NULL DEFAULT 'active',   -- active | inactive | suspended
  source_snapshot    JSONB,   -- snapshot of the product at the time of listing
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ,
  UNIQUE (shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_products_shop_id     ON shop_products (shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_product_id  ON shop_products (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active      ON shop_products (shop_id, active);
CREATE INDEX IF NOT EXISTS idx_shop_products_status      ON shop_products (status);

-- ─── Carts ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  status     VARCHAR(30) NOT NULL DEFAULT 'open',  -- open | checked_out | abandoned
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);
CREATE INDEX IF NOT EXISTS idx_carts_shop_id ON carts (shop_id);
CREATE INDEX IF NOT EXISTS idx_carts_status  ON carts (user_id, status);

-- ─── Cart items ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id         UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products (id) ON DELETE SET NULL,
  shop_product_id UUID REFERENCES shop_products (id) ON DELETE SET NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12, 2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id         ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_shop_product_id ON cart_items (shop_product_id);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  provider            VARCHAR(50) NOT NULL DEFAULT 'manual',  -- manual | stripe | payu | przelewy24
  provider_payment_id VARCHAR(255),
  amount              NUMERIC(12, 2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'PLN',
  status              VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending | completed | failed | refunded
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id  ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider  ON payments (provider, provider_payment_id);

-- ─── Audit logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  entity_type   VARCHAR(50) NOT NULL,  -- user | store | product | shop_product | order | payment | subscription
  entity_id     UUID,
  action        VARCHAR(50) NOT NULL,  -- create | update | delete | status_change | login | etc.
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor      ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- ─── Add shop_product_id to order_items for marketplace traceability ──────────
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shop_product_id UUID REFERENCES shop_products (id) ON DELETE SET NULL;

-- ─── Add status column to orders payment_status ───────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid';
-- unpaid | paid | partially_paid | refunded
