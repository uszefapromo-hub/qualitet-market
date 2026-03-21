-- Migration 045: Seller referral link tracking
--
-- Enables the "zero-effort seller" automation flow:
--   1. Seller gets auto-generated sales links: /product/{id}?ref={seller_id}
--   2. Every click on that link is recorded in seller_clicks
--   3. Orders placed via a ref link carry ref_seller_id so earnings can be attributed
--
-- Creates:
--   seller_clicks – one row per visit to /product/{id}?ref={seller_id}
-- Alters:
--   orders – adds ref_seller_id for ref-link attribution

-- ─── seller_clicks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seller_clicks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- SHA-256 hash of the visitor IP – never stored raw for GDPR / privacy compliance
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_clicks_seller_id   ON seller_clicks (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_clicks_product_id  ON seller_clicks (product_id);
CREATE INDEX IF NOT EXISTS idx_seller_clicks_created_at  ON seller_clicks (created_at DESC);

-- ─── orders: ref-link attribution ─────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ref_seller_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_ref_seller_id ON orders (ref_seller_id);
