-- Migration 027: Company Campaigns System
-- Adds tables for brand/company marketing campaigns and creator participation

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Brand/company campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  budget           NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate  NUMERIC(5,4) NOT NULL DEFAULT 0.10, -- creator commission fraction
  status           VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | active | paused | ended
  starts_at        TIMESTAMP WITH TIME ZONE,
  ends_at          TIMESTAMP WITH TIME ZONE,
  created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Products linked to a campaign
CREATE TABLE IF NOT EXISTS campaign_products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, product_id)
);

-- Creators who joined a campaign
CREATE TABLE IF NOT EXISTS campaign_participants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  joined_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, creator_id)
);

-- Promoted product listings (featured slots)
CREATE TABLE IF NOT EXISTS promoted_listings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan         VARCHAR(20) NOT NULL DEFAULT '7d', -- 7d | 30d
  price_pln    NUMERIC(10,2) NOT NULL,
  starts_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_owner_id     ON campaigns(owner_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status       ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign ON campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_participants_creator  ON campaign_participants(creator_id);
CREATE INDEX IF NOT EXISTS idx_promoted_listings_product ON promoted_listings(product_id);
CREATE INDEX IF NOT EXISTS idx_promoted_listings_ends_at ON promoted_listings(ends_at);
