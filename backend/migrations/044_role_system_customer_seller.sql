-- Migration 044: Role system – customer vs seller
--
-- Introduces the `customer` role (formerly `buyer`) and seller approval flow.
--
--  • Adds `approved` column to users (sellers must be approved by admin).
--  • Renames existing `buyer` role to `customer` for clarity.
--  • Existing approved sellers keep their role unchanged.

-- ── 1. Add `approved` column ──────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Existing sellers are considered already approved (legacy migration) ─────
UPDATE users SET approved = TRUE WHERE role = 'seller';

-- ── 3. Rename `buyer` role to `customer` ─────────────────────────────────────
UPDATE users SET role = 'customer' WHERE role = 'buyer';

-- ── 4. Index for pending-seller queries ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_role_approved ON users (role, approved);
