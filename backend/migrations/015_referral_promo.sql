-- HurtDetalUszefaQUALITET – Referral promo system schema reconciliation
-- Applies after 014_referral_analytics_scripts.sql
--
-- Migration 014 created referral_codes with owner_id (discount code system, referrals.js).
-- The promo registration system (referral.js + auth.js) uses user_id / referral_code_id /
-- new_user_id / bonus_months.  This migration adds those columns so both systems share
-- the same tables without breaking the existing discount-code API.

-- ─── referral_codes: add user_id alias ───────────────────────────────────────
-- user_id is semantically equivalent to owner_id (same person) but the promo system
-- uses user_id.  We keep owner_id non-null for discount codes (referrals.js) and
-- populate user_id for every row.

ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id) ON DELETE CASCADE;

-- Back-fill existing discount codes so user_id is consistent.
UPDATE referral_codes SET user_id = owner_id WHERE user_id IS NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes (user_id);

-- ─── referral_uses: add promo-specific columns ────────────────────────────────
-- The discount system uses code_id / used_by_user_id / reward_amount (migration 014).
-- The promo system uses referral_code_id / referrer_id / new_user_id / bonus_months.
-- We add the promo columns and keep the discount columns intact.

ALTER TABLE referral_uses
  ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES referral_codes (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS referrer_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS new_user_id       UUID REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bonus_months      INTEGER NOT NULL DEFAULT 0;

-- Back-fill existing uses so referral_code_id mirrors code_id.
UPDATE referral_uses
  SET referral_code_id = code_id
  WHERE referral_code_id IS NULL AND code_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_uses_referral_code_id ON referral_uses (referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_new_user_id      ON referral_uses (new_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer_id      ON referral_uses (referrer_id);

-- ─── users: add referred_by_code for promo tracking ─────────────────────────
-- Stores the referral code string used at registration so we can always trace it back.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referred_by_code VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users (referred_by_code);
