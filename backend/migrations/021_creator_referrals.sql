-- HurtDetalUszefaQUALITET – Creator Referral System
-- Allows creators to invite other creators and earn a percentage of their
-- affiliate sales (2 % referral commission, 1 level only).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── users: unique referral code per creator ─────────────────────────────────
-- Stored directly on the users row so the invite link can be resolved in one
-- query.  NULL for non-creators until they call POST /generate-link.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS creator_referral_code VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_creator_referral_code
  ON users (creator_referral_code)
  WHERE creator_referral_code IS NOT NULL;

-- ─── creator_referrals ────────────────────────────────────────────────────────
-- Records each creator-to-creator invitation.  One invited creator can only
-- have a single inviter (UNIQUE on invited_id) to enforce the 1-level limit.

CREATE TABLE IF NOT EXISTS creator_referrals (
  id          UUID                     DEFAULT uuid_generate_v4() PRIMARY KEY,
  inviter_id  UUID NOT NULL            REFERENCES users (id) ON DELETE CASCADE,
  invited_id  UUID NOT NULL            REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_creator_referrals_invited UNIQUE (invited_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_referrals_inviter
  ON creator_referrals (inviter_id);

CREATE INDEX IF NOT EXISTS idx_creator_referrals_invited
  ON creator_referrals (invited_id);

-- ─── referral_commissions ─────────────────────────────────────────────────────
-- Stores the 2 % referral commission earned by the inviter each time an
-- invited creator's affiliate conversion is confirmed.  Populated by the
-- commission calculation logic in the backend.
-- NOTE: order_id is reserved for future use when commissions are explicitly
-- linked to individual order records.

CREATE TABLE IF NOT EXISTS referral_commissions (
  id                 UUID                     DEFAULT uuid_generate_v4() PRIMARY KEY,
  inviter_id         UUID NOT NULL            REFERENCES users (id) ON DELETE CASCADE,
  invited_creator_id UUID NOT NULL            REFERENCES users (id) ON DELETE CASCADE,
  order_id           UUID                     REFERENCES orders (id) ON DELETE SET NULL,
  commission_amount  NUMERIC(12, 2) NOT NULL  DEFAULT 0,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_inviter
  ON referral_commissions (inviter_id);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_invited
  ON referral_commissions (invited_creator_id);
