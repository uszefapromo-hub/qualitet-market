-- Migration 026: Art Auctions System
-- Adds tables for artist profiles, artwork listings, and auction bids

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Artist profiles
CREATE TABLE IF NOT EXISTS artist_profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  VARCHAR(120) NOT NULL,
  bio           TEXT,
  website       VARCHAR(255),
  plan          VARCHAR(20) NOT NULL DEFAULT 'basic', -- basic | pro
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Artworks
CREATE TABLE IF NOT EXISTS artworks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id     UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  image_url     TEXT,
  medium        VARCHAR(100),
  dimensions    VARCHAR(100),
  year_created  SMALLINT,
  status        VARCHAR(20) NOT NULL DEFAULT 'available', -- available | on_auction | sold
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Auctions
CREATE TABLE IF NOT EXISTS auctions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artwork_id      UUID NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  artist_id       UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  starting_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  reserve_price   NUMERIC(12,2),
  current_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  bid_count       INTEGER NOT NULL DEFAULT 0,
  winner_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active | ended | cancelled
  starts_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Auction bids
CREATE TABLE IF NOT EXISTS auction_bids (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artist_profiles_user_id ON artist_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_artworks_artist_id ON artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artworks_status ON artworks(status);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_ends_at ON auctions(ends_at);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON auction_bids(bidder_id);
