-- Migration 037: Track updated-vs-created product counts in import_logs
--
-- Adds:
--   import_logs.updated – number of existing products updated (vs. created) in a sync run
--
-- This allows the sync-all execution report to distinguish freshly-imported
-- products from price/stock refreshes on already-known SKUs.

ALTER TABLE import_logs
  ADD COLUMN IF NOT EXISTS updated INTEGER NOT NULL DEFAULT 0;
