-- Migration 021: Notifications
-- Per-user notification inbox with read/unread tracking.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(50)              NOT NULL,
  title         TEXT                     NOT NULL,
  body          TEXT,
  resource_type VARCHAR(50),
  resource_id   UUID,
  is_read       BOOLEAN                  NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
