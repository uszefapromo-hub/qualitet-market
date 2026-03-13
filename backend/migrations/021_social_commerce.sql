-- Social Commerce Module
-- Tables: social_posts, social_likes, social_comments, social_shares, social_trending

CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id      UUID REFERENCES stores(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  media_urls    JSONB NOT NULL DEFAULT '[]',
  post_type     VARCHAR(30) NOT NULL DEFAULT 'general'
                  CHECK (post_type IN ('general','product','promotion','live_recap')),
  likes_count   INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count  INTEGER NOT NULL DEFAULT 0,
  views_count   INTEGER NOT NULL DEFAULT 0,
  viral_score   NUMERIC(10,4) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   VARCHAR(30) NOT NULL DEFAULT 'internal'
               CHECK (platform IN ('internal','facebook','instagram','tiktok','twitter','whatsapp')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_product ON social_posts(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_posts_viral ON social_posts(viral_score DESC, created_at DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_social_likes_post ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments(post_id) WHERE is_active = TRUE;
