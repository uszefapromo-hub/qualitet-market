-- Migration 016: Announcements / Communications system
-- Adds tables for platform-wide announcements and mail-message queues.

CREATE TABLE IF NOT EXISTS announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NOT NULL,
  type         VARCHAR(50)  NOT NULL DEFAULT 'info',  -- info | warning | success | alert
  target_role  VARCHAR(50)  DEFAULT NULL,              -- NULL = all, or 'seller'/'buyer'/'admin'
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at DESC);

-- Mail message queue for platform-to-user communications
CREATE TABLE IF NOT EXISTS mail_messages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email     VARCHAR(255) NOT NULL,
  to_user_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  subject      VARCHAR(500) NOT NULL,
  body         TEXT         NOT NULL,
  status       VARCHAR(50)  NOT NULL DEFAULT 'queued',  -- queued | sent | failed
  sent_at      TIMESTAMP WITH TIME ZONE,
  error        TEXT,
  created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_status ON mail_messages(status, created_at DESC);
