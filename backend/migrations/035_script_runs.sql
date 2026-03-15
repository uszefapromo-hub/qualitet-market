-- Migration 035: script_runs table
-- Requires: users table (from migration 001_initial_schema.sql)
-- Tracks execution history for all system scripts run from the Super Admin panel.
-- One row per script_id (upserted on each run); full audit trail preserved in
-- script_run_logs (append-only).

CREATE TABLE IF NOT EXISTS script_runs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   TEXT        NOT NULL UNIQUE,
  status      TEXT        NOT NULL DEFAULT 'idle',
  last_run_at TIMESTAMPTZ,
  last_result TEXT,
  run_count   INTEGER     NOT NULL DEFAULT 0,
  run_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Full audit log: one row per execution
CREATE TABLE IF NOT EXISTS script_run_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   TEXT        NOT NULL,
  run_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  dry_run     BOOLEAN     NOT NULL DEFAULT false,
  status      TEXT        NOT NULL,          -- 'ok' | 'error'
  result      TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_script_run_logs_script_id ON script_run_logs (script_id);
CREATE INDEX IF NOT EXISTS idx_script_run_logs_run_by    ON script_run_logs (run_by);
