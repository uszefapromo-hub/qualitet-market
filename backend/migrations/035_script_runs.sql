-- Migration 035: System script run log
-- Tracks every execution of a system automation script (owner panel).
-- The table is deliberately lightweight – only the most recent run per script
-- is kept in the upsert logic used by the run handler, so the table stays small.

CREATE TABLE IF NOT EXISTS script_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   VARCHAR(60) NOT NULL UNIQUE,
  status      VARCHAR(20) NOT NULL DEFAULT 'idle',   -- idle | ok | error
  last_run_at TIMESTAMPTZ,
  last_result TEXT,
  run_count   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_script_runs_script_id   ON script_runs (script_id);
CREATE INDEX IF NOT EXISTS idx_script_runs_last_run_at ON script_runs (last_run_at DESC);
