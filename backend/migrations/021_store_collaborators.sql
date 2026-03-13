-- Migration 021: Store Collaboration System
-- Allows store owners to invite collaborators with specific roles and configure revenue sharing.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Collaborator roles: owner, manager, creator, marketer
-- Permissions:
--   owner    – full access
--   manager  – products and orders
--   creator  – affiliate promotion
--   marketer – marketing tools
CREATE TABLE IF NOT EXISTS store_collaborators (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  email        VARCHAR(255) NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'manager'
                 CHECK (role IN ('owner', 'manager', 'creator', 'marketer')),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token VARCHAR(64) UNIQUE,
  invited_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at  TIMESTAMP WITH TIME ZONE,
  UNIQUE (store_id, email)
);

-- Revenue split configuration per store
-- Each row defines the percentage share for a given participant type.
-- Percentages must sum to ≤ 100; the remainder goes to the platform.
CREATE TABLE IF NOT EXISTS revenue_shares (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  participant  VARCHAR(20) NOT NULL
                 CHECK (participant IN ('seller', 'creator', 'platform')),
  percentage   NUMERIC(5,2) NOT NULL DEFAULT 0.00
                 CHECK (percentage >= 0 AND percentage <= 100),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (store_id, participant)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_collaborators_store   ON store_collaborators (store_id);
CREATE INDEX IF NOT EXISTS idx_store_collaborators_user    ON store_collaborators (user_id);
CREATE INDEX IF NOT EXISTS idx_store_collaborators_token   ON store_collaborators (invite_token);
CREATE INDEX IF NOT EXISTS idx_revenue_shares_store        ON revenue_shares (store_id);
