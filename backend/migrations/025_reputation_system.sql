-- Migration 025: Reputation & Rating System
-- Tables: seller_ratings, product_reviews, creator_scores
-- Adds new reputation badges to badge_definitions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ratings given by buyers to sellers after completing an order
CREATE TABLE IF NOT EXISTS seller_ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One rating per order per buyer
  UNIQUE(order_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller   ON seller_ratings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_buyer    ON seller_ratings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_order    ON seller_ratings(order_id);

-- Reviews left by users on individual products
CREATE TABLE IF NOT EXISTS product_reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- One review per product per reviewer
  UNIQUE(product_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product  ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_reviewer ON product_reviews(reviewer_id);

-- Aggregated reputation score for creators / sellers
CREATE TABLE IF NOT EXISTS creator_scores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  sales_generated   NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversion_rate   NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- percent 0-100
  engagement_score  NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- composite metric 0-100
  avg_rating        NUMERIC(3,2)  NOT NULL DEFAULT 0,   -- 0.00-5.00
  total_reviews     INTEGER       NOT NULL DEFAULT 0,
  delivery_score    NUMERIC(3,2)  NOT NULL DEFAULT 0,   -- 0.00-5.00 (avg delivery rating)
  reputation_score  NUMERIC(8,2)  NOT NULL DEFAULT 0,   -- computed composite score
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_scores_creator ON creator_scores(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_scores_score   ON creator_scores(reputation_score DESC);

-- Seed new reputation-related badges (skip if already present)
INSERT INTO badge_definitions (code, name, description, category, points_reward) VALUES
  ('top_seller',       'Top Sprzedawca',    'Jesteś w Top 10% sprzedawców na platformie',           'sales',     300),
  ('trusted_creator',  'Zaufany Kreator',   'Utrzymujesz średnią ocenę 4.5+ z min. 20 opinii',      'affiliate', 250),
  ('fast_shipping',    'Szybka Wysyłka',    'Średni czas wysyłki poniżej 24 godzin',                'special',   150)
ON CONFLICT (code) DO NOTHING;
