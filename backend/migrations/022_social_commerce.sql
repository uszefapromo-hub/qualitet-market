-- Migration 022: Social Commerce
-- Posts, likes, and comments feed for the marketplace.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                     REFERENCES users(id) ON DELETE SET NULL,
  store_id      UUID                     REFERENCES stores(id) ON DELETE SET NULL,
  product_id    UUID,
  content       TEXT,
  image_url     TEXT,
  post_type     VARCHAR(30)              NOT NULL DEFAULT 'product',
  like_count    INTEGER                  NOT NULL DEFAULT 0,
  comment_count INTEGER                  NOT NULL DEFAULT 0,
  share_count   INTEGER                  NOT NULL DEFAULT 0,
  is_active     BOOLEAN                  NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_likes (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID                     NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS social_comments (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID                     NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  content    TEXT                     NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_active_created  ON social_posts(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_like_count      ON social_posts(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_social_likes_post_id         ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id      ON social_comments(post_id);
