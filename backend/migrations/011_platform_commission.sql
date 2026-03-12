-- HurtDetalUszefaQUALITET – Platform commission settings
-- Adds global platform_settings table and order_total column to orders

-- ─── Platform settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default commission rate: 8%
INSERT INTO platform_settings (key, value)
VALUES ('commission_rate', '0.08')
ON CONFLICT (key) DO NOTHING;

-- ─── Orders: add order_total ──────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_total NUMERIC(12, 2) DEFAULT 0;
