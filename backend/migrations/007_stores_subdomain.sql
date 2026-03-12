-- HurtDetalUszefaQUALITET – Add subdomain column to stores

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS subdomain VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_stores_subdomain ON stores (subdomain);
