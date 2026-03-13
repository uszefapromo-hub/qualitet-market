-- HurtDetalUszefaQUALITET – extend suppliers table for automatic product import
-- Run after 006_subscription_marketplace.sql

-- New fields required by the automatic import system spec
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS country      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS xml_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS csv_endpoint TEXT,
  ADD COLUMN IF NOT EXISTS status       VARCHAR(30) NOT NULL DEFAULT 'active';

-- Populate status from existing active flag for all rows already in the table
UPDATE suppliers SET status = CASE WHEN active THEN 'active' ELSE 'inactive' END;

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status);
