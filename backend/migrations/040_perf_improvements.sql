-- Migration 040: Performance improvements
-- Adds missing indexes identified during code review.

-- Composite index for seller/owner order list queries that filter by store_owner_id
-- and sort by created_at DESC (used in GET /api/orders and GET /api/my/store/orders).
CREATE INDEX IF NOT EXISTS idx_orders_store_owner_created
  ON orders (store_owner_id, created_at DESC);

-- Composite index for orders listing per buyer sorted by date
-- (complements existing idx_orders_buyer_created for the window-function query).
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status
  ON orders (buyer_id, status, created_at DESC);

-- Index on order_items for fast lookup by order_id
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);
