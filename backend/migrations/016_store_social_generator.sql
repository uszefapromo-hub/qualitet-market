-- Migration 016: Social media links for stores + shop generator metadata
-- Adds columns for social media profiles and shop generator settings

-- Social media links for store profiles
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS facebook_url    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instagram_url   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tiktok_url      TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS youtube_url     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_email   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_phone   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS primary_color   TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accent_color    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bg_color        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS theme           TEXT DEFAULT 'modern',
  ADD COLUMN IF NOT EXISTS logo_url        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delivery_info   TEXT DEFAULT NULL;
