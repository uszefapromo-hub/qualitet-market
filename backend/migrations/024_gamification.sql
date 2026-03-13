-- Migration 024: Gamification
-- Points, badges, levels and a cached leaderboard.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_points (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  points     INTEGER                  NOT NULL DEFAULT 0,
  level      INTEGER                  NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(50)              NOT NULL UNIQUE,
  name             TEXT                     NOT NULL,
  description      TEXT,
  icon_url         TEXT,
  points_required  INTEGER                  NOT NULL DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id   UUID                     NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id           UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID                     NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username     TEXT,
  points       INTEGER                  NOT NULL DEFAULT 0,
  level        INTEGER                  NOT NULL DEFAULT 1,
  badges_count INTEGER                  NOT NULL DEFAULT 0,
  rank         INTEGER,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_points_points       ON user_points(points DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_points ON leaderboard_cache(points DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id      ON user_badges(user_id);

-- ─── Seed default badges ──────────────────────────────────────────────────────
INSERT INTO badges (code, name, description, points_required)
VALUES
  ('first_order',   'Pierwsze zamówienie',   'Złóż pierwsze zamówienie na platformie',           0),
  ('first_sale',    'Pierwsza sprzedaż',     'Sprzedaj produkt po raz pierwszy',                 0),
  ('top_seller',    'Topowy sprzedawca',     'Znajdź się w top 10 sprzedawców miesiąca',         500),
  ('creator_star',  'Gwiazda twórcza',       'Zdobądź 1000 punktów jako twórca',                 1000),
  ('loyal_buyer',   'Lojalny kupujący',      'Zrealizuj 10 zamówień na platformie',              100)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      points_required = EXCLUDED.points_required;
