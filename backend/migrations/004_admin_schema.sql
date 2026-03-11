-- HurtDetalUszefaQUALITET – superadmin panel schema additions
-- Applies after 002_extended_schema.sql
-- Adds: superadmin role support, product type, supplier country/status, blocked flag on users

-- ─── Allow 'superadmin' role in users ────────────────────────────────────────
-- The role column is VARCHAR(30), no enum to alter; just document valid values:
-- buyer | seller | admin | owner | superadmin | customer

-- ─── Add 'blocked' column to users ───────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Extend stores status to include superadmin statuses ─────────────────────
-- Existing: active | inactive | suspended
-- New allowed values: pending | active | suspended | banned
-- (VARCHAR column, no enum constraint to alter)

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
