-- Migration 023: Live Commerce
-- Live streaming sessions with chat, pinned products and order tracking.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS live_streams (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id      UUID                     REFERENCES stores(id) ON DELETE SET NULL,
  title         TEXT                     NOT NULL,
  description   TEXT,
  status        VARCHAR(20)              NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled', 'live', 'ended')),
  stream_key    VARCHAR(100),
  viewer_count  INTEGER                  NOT NULL DEFAULT 0,
  scheduled_at  TIMESTAMP WITH TIME ZONE,
  started_at    TIMESTAMP WITH TIME ZONE,
  ended_at      TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_messages (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id  UUID                     NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  user_id    UUID                     REFERENCES users(id) ON DELETE SET NULL,
  message    TEXT                     NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_pinned_products (
  id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id        UUID                     NOT NULL REFERENCES live_streams(id) ON DELETE CASCADE,
  shop_product_id  UUID                     NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  discount_percent NUMERIC(5,2)             NOT NULL DEFAULT 0,
  is_active        BOOLEAN                  NOT NULL DEFAULT TRUE,
  pinned_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_orders (
  id         UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id  UUID                     REFERENCES live_streams(id) ON DELETE SET NULL,
  order_id   UUID                     REFERENCES orders(id) ON DELETE SET NULL,
  shop_product_id UUID,
  buyer_id   UUID                     REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_streams_stream_key ON live_streams(stream_key) WHERE stream_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_messages_stream   ON live_messages(stream_id, created_at);
