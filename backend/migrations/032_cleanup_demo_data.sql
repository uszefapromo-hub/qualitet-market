-- Migration 032: Cleanup demo / placeholder data
-- Removes all demo and seed products from the central catalogue so the
-- marketplace catalog is empty and ready for real supplier imports.
--
-- What is removed:
--   • products  WHERE is_central = true
--               (all rows inserted by 012_initial_products_seed.sql and
--                024_demo_stores.sql – identified by picsum.photos images
--                or SKU prefixes EL-/AT-/DG-/FT-/GD-/DS-)
--   • shop_products that reference the deleted products (via CASCADE FK, but
--     we also delete explicitly for clarity)
--
-- What is NOT removed:
--   • users (real or test)
--   • stores (real seller stores)
--   • suppliers (configuration rows)
--   • categories (kept – will be repopulated by 033_real_categories.sql)
--   • system tables (_migrations, audit_logs, etc.)

-- 1. Remove shop_products rows that reference demo central-catalog products
DELETE FROM shop_products
WHERE product_id IN (
  SELECT id FROM products
  WHERE is_central = true
    AND (
      image_url LIKE '%picsum.photos%'
      OR sku ~ '^(EL|AT|DG|FT|GD|DS)-'
      OR supplier_id IS NULL
    )
);

-- 2. Remove the demo central-catalog products themselves
DELETE FROM products
WHERE is_central = true
  AND (
    image_url LIKE '%picsum.photos%'
    OR sku ~ '^(EL|AT|DG|FT|GD|DS)-'
    OR supplier_id IS NULL
  );

-- 3. Remove placeholder/legacy demo category slugs that will NOT be reused
--    Real categories (elektronika, dom-i-ogrod) are seeded in 033_real_categories.sql
DELETE FROM categories
WHERE slug IN (
  'akcesoria-do-telefonu',
  'fitness',
  'gadgety'
) AND parent_id IS NULL;
