-- Migration 036: add enabled column to script_runs
-- Allows Super Admin to disable individual system scripts via PATCH /api/admin/scripts/:id.
-- Default TRUE keeps all existing rows enabled.

ALTER TABLE script_runs
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
