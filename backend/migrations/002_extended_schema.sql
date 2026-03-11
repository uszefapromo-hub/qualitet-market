-- HurtDetalUszefaQUALITET – extended marketplace schema
-- Applies after 001_initial_schema.sql
-- Adds: categories, product_images, shop_products, carts, cart_items, payments, audit_logs

-- ─── Categories ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  parent_id   UUID REFERENCES categories (id) ON DELETE SET NULL,
  description TEXT,
  icon        VARCHAR(100),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug      ON categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_active    ON categories (active);

-- ─── Product images ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  alt         VARCHAR(255),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images (product_id);

-- ─── Shop products ────────────────────────────────────────────────────────────
-- Central catalogue → seller store mapping (marketplace model).
-- Each seller can feature any global product in their shop with optional
-- price / margin overrides.

CREATE TABLE IF NOT EXISTS shop_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  price_override  NUMERIC(12, 2),   -- NULL → use product selling_price
  margin_override NUMERIC(5, 2),    -- NULL → use store margin
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ,
  UNIQUE (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_products_store_id   ON shop_products (store_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_product_id ON shop_products (product_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active     ON shop_products (store_id, active);

-- ─── Carts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users (id) ON DELETE CASCADE,  -- NULL for guest carts
  store_id   UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  session_id VARCHAR(128),           -- for guest / pre-login carts
  status     VARCHAR(30) NOT NULL DEFAULT 'active',   -- active | checked_out | abandoned
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id    ON carts (user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts (session_id);
CREATE INDEX IF NOT EXISTS idx_carts_store_id   ON carts (store_id);
CREATE INDEX IF NOT EXISTS idx_carts_status     ON carts (status);

-- ─── Cart items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cart_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id    UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items (cart_id);

-- ─── Payments ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users (id),
  amount       NUMERIC(12, 2) NOT NULL,
  currency     VARCHAR(10) NOT NULL DEFAULT 'PLN',
  method       VARCHAR(30) NOT NULL DEFAULT 'transfer',   -- transfer | card | blik | p24
  status       VARCHAR(30) NOT NULL DEFAULT 'pending',    -- pending | completed | failed | refunded
  external_ref VARCHAR(255),   -- payment gateway reference
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id  ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments (status);

-- ─── Audit logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users (id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,   -- e.g. 'order.created', 'user.login'
  resource    VARCHAR(50),             -- e.g. 'order', 'product', 'user'
  resource_id UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs (resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);

-- ─── Extend products with optional category FK ────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
