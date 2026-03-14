-- Migration 028: Subscription Plans v2
-- Aligns stored plan names with the final pricing structure published in cennik.html.
--
-- Changes:
--   • 'trial' → 'free'        (Seller Free, replaces the 14-day trial concept)
--   • commission_rate 0.15 → 0.05   for free/trial rows
--   • commission_rate 0.10 → 0.03   for basic (Seller PRO, 79 PLN)
--   • commission_rate 0.07 → 0.02   for pro   (Seller Business, 249 PLN)
--   • commission_rate 0.05 → 0.01   for elite (499 PLN)
--   • product_limit: basic/pro limits removed (now unlimited)
--
-- Legacy 'trial' rows are preserved in the plan column during this migration.
-- Application code accepts both 'trial' and 'free' via the VALID_PLANS list.

-- 1. Rename active 'trial' subscriptions to 'free'
UPDATE subscriptions
SET plan = 'free'
WHERE plan = 'trial';

-- 2. Update commission rates for 'free' (was trial)
UPDATE subscriptions
SET commission_rate = 0.05
WHERE plan = 'free' AND commission_rate = 0.15;

-- 3. Update 'basic' (Seller PRO): lower commission, unlimited products
UPDATE subscriptions
SET commission_rate = 0.03,
    product_limit   = NULL
WHERE plan = 'basic';

-- 4. Update 'pro' (Seller Business): lower commission, unlimited products
UPDATE subscriptions
SET commission_rate = 0.02,
    product_limit   = NULL
WHERE plan = 'pro';

-- 5. Update 'elite': lower commission (already unlimited)
UPDATE subscriptions
SET commission_rate = 0.01,
    product_limit   = NULL
WHERE plan = 'elite';
