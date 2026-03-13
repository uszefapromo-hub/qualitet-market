-- Migration 020: User Profiles
-- Stores extended public profile data for each user.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio           TEXT,
  avatar_url    TEXT,
  website_url   TEXT,
  facebook_url  TEXT,
  instagram_url TEXT,
  tiktok_url    TEXT,
  youtube_url   TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
