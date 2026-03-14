-- Migration 029: Legacy subscription handling
-- Marks any subscription with unknown/old plan values as legacy so they do not
-- break the running system. Active subscriptions with standard plans are untouched.
--
-- Legacy indicators:
--   status = 'legacy'  – old rows that should not affect business logic
--
-- Additionally adds a `is_legacy` boolean column to the subscriptions table so
-- the application can quickly filter out outdated records.

-- 1. Add is_legacy column (safe – ignored if already exists)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false;

-- 2. Mark subscriptions with unknown plan values as legacy
UPDATE subscriptions
SET is_legacy = true,
    status    = 'legacy'
WHERE plan NOT IN (
  'free', 'trial',
  'basic', 'pro', 'elite',
  'supplier_basic', 'supplier_pro',
  'brand',
  'artist_basic', 'artist_pro'
)
AND status NOT IN ('legacy', 'cancelled');

-- 3. Mark expired subscriptions (expires_at < NOW()) that are still 'active' as legacy
-- (Only for plans that should have an expiry, i.e. duration_days IS NOT NULL)
UPDATE subscriptions
SET is_legacy = true,
    status    = 'legacy'
WHERE plan IN ('basic', 'pro', 'elite', 'supplier_basic', 'supplier_pro', 'brand', 'artist_pro')
  AND status = 'active'
  AND expires_at IS NOT NULL
  AND expires_at < NOW() - INTERVAL '90 days';
