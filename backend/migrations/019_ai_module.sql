-- Migration 019: AI module – conversation history and generation requests
-- Enables the /api/ai/* endpoints for chat, product-description, and store-description generation.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── AI conversations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT                     NOT NULL DEFAULT 'Nowa rozmowa',
  context_type  VARCHAR(50),                        -- 'product' | 'store' | 'general'
  context_id    UUID,                               -- e.g. product_id or store_id
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── AI messages inside each conversation ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id               UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID                     NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role             VARCHAR(20)              NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT                     NOT NULL,
  tokens_used      INTEGER,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── AI generation log (one-shot requests, e.g. product/store descriptions) ───
CREATE TABLE IF NOT EXISTS ai_generation_log (
  id             UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           VARCHAR(50)              NOT NULL,  -- 'product_description' | 'store_description'
  prompt         TEXT                     NOT NULL,
  result         TEXT,
  tokens_used    INTEGER,
  duration_ms    INTEGER,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id  ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation  ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_log_user    ON ai_generation_log(user_id);
