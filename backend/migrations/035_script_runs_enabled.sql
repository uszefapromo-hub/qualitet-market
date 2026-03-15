-- Migration 035: add enabled column to script_runs
-- Allows superadmin to enable/disable individual system scripts.

ALTER TABLE script_runs
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
