-- Migration 024: User Referral System
-- Tables: user_referrals, referral_rewards
-- Column: users.user_referral_code

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Unique invite code stored on the user who generates the link
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_referral_code VARCHAR(20) UNIQUE;

-- Tracks who invited whom via the user referral programme
CREATE TABLE IF NOT EXISTS user_referrals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One inviter per invited user
  UNIQUE(invited_id)
);

CREATE INDEX IF NOT EXISTS idx_user_referrals_inviter ON user_referrals(inviter_id);
CREATE INDEX IF NOT EXISTS idx_user_referrals_invited ON user_referrals(invited_id);

-- Rewards credited to the inviter from invited users' activity
CREATE TABLE IF NOT EXISTS referral_rewards (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  source      VARCHAR(50),   -- e.g. 'subscription', 'order'
  source_id   UUID,          -- FK to the triggering order/subscription
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_inviter ON referral_rewards(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_invited ON referral_rewards(invited_id);
