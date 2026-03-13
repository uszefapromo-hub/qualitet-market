-- Migration 025: Creator Referral System
-- Peer-to-peer referral codes between creator accounts.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE users ADD COLUMN IF NOT EXISTS creator_referral_code VARCHAR(20) UNIQUE;

CREATE TABLE IF NOT EXISTS creator_referrals (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_id UUID                     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id                   UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id           UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_creator_id   UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id             UUID,
  commission_amount    NUMERIC(10,2)            NOT NULL DEFAULT 0,
  status               VARCHAR(20)              NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'confirmed', 'paid')),
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_referrals_inviter_id      ON creator_referrals(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_inviter_id   ON referral_commissions(inviter_id);
