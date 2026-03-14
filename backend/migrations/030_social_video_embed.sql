-- Social Video Embed: add video_url and video_type to social_posts
-- Supports TikTok, YouTube, YouTube Shorts, Instagram Reels embedded directly in the feed

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS video_url   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS video_type  VARCHAR(20) DEFAULT NULL
    CHECK (video_type IN ('tiktok', 'youtube', 'short', 'reel'));

-- Extend post_type to support 'video' posts
ALTER TABLE social_posts
  DROP CONSTRAINT IF EXISTS social_posts_post_type_check;

ALTER TABLE social_posts
  ADD CONSTRAINT social_posts_post_type_check
    CHECK (post_type IN ('general', 'product', 'promotion', 'live_recap', 'video'));

-- Index for video posts
CREATE INDEX IF NOT EXISTS idx_social_posts_video ON social_posts(video_type) WHERE video_url IS NOT NULL;
