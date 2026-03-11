-- HurtDetalUszefaQUALITET – superadmin panel schema additions
-- Applies after 002_extended_schema.sql
-- Adds: superadmin role support, product type, supplier country/status, shop status enum

-- ─── Allow 'superadmin' role in users ────────────────────────────────────────
-- The role column is VARCHAR(30), no enum to alter; just document valid values:
-- buyer | seller | admin | owner | superadmin | customer

-- ─── Add 'blocked' column to users ───────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Extend stores status to include superadmin statuses ─────────────────────
-- Existing: active | inactive | suspended
-- New:      pending | active | suspended | banned
-- Existing rows keep their status; constraint is informational only.

-- ─── Add 'type' column to products ───────────────────────────────────────────
-- Values: own | supplier | producer
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) NOT NULL DEFAULT 'own';

CREATE INDEX IF NOT EXISTS idx_products_type ON products (type);

-- ─── Add 'country' and 'status' columns to suppliers ─────────────────────────
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status  VARCHAR(30) NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status);

-- ─── Ensure audit_logs uses gen_random_uuid() (pg 13+) ───────────────────────
-- Nothing to alter; id uses uuid_generate_v4() from uuid-ossp which is fine.
-- The logAudit helper now uses gen_random_uuid() for compatibility; if not
-- available fall back to uuid_generate_v4():
CREATE OR REPLACE FUNCTION gen_random_uuid_compat()
RETURNS UUID LANGUAGE SQL AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid')
    THEN gen_random_uuid()
    ELSE uuid_generate_v4()
  END;
$$;
