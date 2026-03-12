-- 009_platform_price.sql
-- Adds platform_price to products: the minimum allowed selling price for shop products.

ALTER TABLE products ADD COLUMN IF NOT EXISTS platform_price NUMERIC(12, 2);
