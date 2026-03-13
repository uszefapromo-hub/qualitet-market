-- Migration 017: Add social media profile links to stores table
-- Allows sellers to embed their Facebook / Instagram / TikTok feeds
-- in their store profile pages.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS social_facebook  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_instagram TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_tiktok    TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS social_twitter   TEXT DEFAULT NULL;
