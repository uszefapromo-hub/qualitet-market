-- Migration 018: Affiliate Creator System
-- Allows users and creators to promote products from stores and earn commission per sale.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Per-product affiliate settings configured by sellers
CREATE TABLE IF NOT EXISTS product_affiliate_settings (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id             UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  commission_percent   NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  is_affiliate_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (product_id, store_id)
);

-- Affiliate links created by creators
CREATE TABLE IF NOT EXISTS affiliate_links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
  store_id    UUID REFERENCES stores(id) ON DELETE SET NULL,
  code        VARCHAR(32) NOT NULL UNIQUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Click tracking per affiliate link
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id    UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
  ip_hash    VARCHAR(64),
  user_agent TEXT,
  referrer   TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion tracking: a click that resulted in an order
CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  link_id           UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE RESTRICT,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  creator_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_amount      NUMERIC(12,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Withdrawal requests by creators
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount       NUMERIC(12,2) NOT NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes        TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_links_creator      ON affiliate_links (creator_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code         ON affiliate_links (code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_link        ON affiliate_clicks (link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created     ON affiliate_clicks (created_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_link   ON affiliate_conversions (link_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_creator ON affiliate_conversions (creator_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_creator ON affiliate_withdrawals (creator_id);
CREATE INDEX IF NOT EXISTS idx_product_affiliate_product    ON product_affiliate_settings (product_id);
CREATE INDEX IF NOT EXISTS idx_product_affiliate_store      ON product_affiliate_settings (store_id);
