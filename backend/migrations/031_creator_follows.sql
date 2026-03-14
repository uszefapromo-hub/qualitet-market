-- Creator Follows – STEP 8 Social Commerce
-- Allows users to follow creators; tracks follower count on users table.

CREATE TABLE IF NOT EXISTS creator_follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, creator_id),
  CHECK(follower_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_follows_creator ON creator_follows(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_follows_follower ON creator_follows(follower_id);

-- Add followers_count to users if not present
ALTER TABLE users ADD COLUMN IF NOT EXISTS followers_count INTEGER NOT NULL DEFAULT 0;

-- Index for creator profile aggregation query (orders joined by seller_id)
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id) WHERE seller_id IS NOT NULL;
