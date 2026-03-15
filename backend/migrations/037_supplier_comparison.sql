-- Migration 037: supplier comparison – import_logs table
-- Tracks each supplier sync/import run so the import center can show history.

CREATE TABLE IF NOT EXISTS import_logs (
  id            UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID                     REFERENCES suppliers(id) ON DELETE SET NULL,
  status        VARCHAR(20)              NOT NULL DEFAULT 'success',  -- 'success' | 'failure'
  count         INTEGER                  NOT NULL DEFAULT 0,
  featured      INTEGER                  NOT NULL DEFAULT 0,
  skipped       INTEGER                  NOT NULL DEFAULT 0,
  error_message TEXT,
  triggered_by  VARCHAR(50)              NOT NULL DEFAULT 'admin',    -- 'admin' | 'system'
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_logs_supplier_id_idx ON import_logs (supplier_id);
CREATE INDEX IF NOT EXISTS import_logs_created_at_idx  ON import_logs (created_at DESC);
