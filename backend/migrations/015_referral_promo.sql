-- Migration 015: Referral program & promotional subscription tiers
-- Extends existing referral_codes and referral_uses tables for the promo system.
-- Adds promo_tier and referred_by_code tracking to users.

-- ─── Promo tier tracking on users ─────────────────────────────────────────────
-- promo_tier: 1 = first 10 (12 months), 2 = next 10 (6 months),
--             3 = next 10 (3 months),   0 = no promo (registrations > 30)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS promo_tier       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users (referred_by_code)
  WHERE referred_by_code IS NOT NULL;

-- ─── Extend referral_codes for per-user promo codes ───────────────────────────
-- Allow owner_id to be nullable so simple promo codes can be inserted without
-- the legacy discount-code owner_id column.
ALTER TABLE referral_codes ALTER COLUMN owner_id DROP NOT NULL;

-- user_id: the user this promo referral code belongs to (one code per user).
ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes (user_id)
  WHERE user_id IS NOT NULL;

-- ─── Extend referral_uses for promo bonus tracking ────────────────────────────
-- Allow code_id to be nullable so promo uses (which reference code by string)
-- do not need the legacy FK to referral_codes.id.
ALTER TABLE referral_uses ALTER COLUMN code_id DROP NOT NULL;

ALTER TABLE referral_uses
  ADD COLUMN IF NOT EXISTS code        VARCHAR(32),
  ADD COLUMN IF NOT EXISTS referrer_id UUID REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS new_user_id UUID REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS bonus_days  INTEGER NOT NULL DEFAULT 30;

CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer_id ON referral_uses (referrer_id)
  WHERE referrer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_uses_new_user_id ON referral_uses (new_user_id)
  WHERE new_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_uses_promo_code  ON referral_uses (code)
  WHERE code IS NOT NULL;
