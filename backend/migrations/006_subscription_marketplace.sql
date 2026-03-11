-- HurtDetalUszefaQUALITET – Subscription marketplace migration
-- Adds shop-based subscription fields and order commission fields

-- ─── Subscriptions: add shop_id, product_limit, commission_rate, started_at, expires_at ───────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS shop_id         UUID REFERENCES stores (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_limit   INTEGER,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions (shop_id);

-- ─── Orders: add platform_commission and seller_revenue ────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS platform_commission NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_revenue      NUMERIC(12, 2) DEFAULT 0;
