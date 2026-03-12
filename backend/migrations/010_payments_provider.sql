-- HurtDetalUszefaQUALITET – Payment provider migration
-- Adds payment_provider column and aligns status values with spec:
--   pending | paid | failed | refunded

-- Add payment_provider column (p24 = Przelewy24, stripe, blik, transfer, card)
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(30);

-- Backfill payment_provider for rows that were using an external provider (p24 or stripe)
UPDATE payments
  SET payment_provider = method
  WHERE payment_provider IS NULL AND method IN ('p24', 'stripe');

-- Create index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments (payment_provider);

-- Rename status value 'completed' -> 'paid' for existing rows
UPDATE payments
  SET status = 'paid'
  WHERE status = 'completed';
