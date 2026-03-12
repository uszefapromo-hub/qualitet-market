-- Migration 009: Add supplier_price, platform_price, min_selling_price to products
-- These columns support automatic platform pricing calculation on supplier import.
--
-- supplier_price    = price received from the wholesaler (gross)
-- platform_price    = supplier_price + platform tiered markup (60%/40%/25%/15%)
-- min_selling_price = minimum price a seller may charge (equals platform_price)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_price    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS platform_price    NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(12, 2);
