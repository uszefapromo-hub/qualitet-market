-- Migration 007: subdomain support
-- Adds subdomain_blocked flag to stores table.
-- When true, the store's subdomain (slug.qualitetmarket.pl) is disabled and returns 404.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS subdomain_blocked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_subdomain_blocked ON stores (subdomain_blocked);
