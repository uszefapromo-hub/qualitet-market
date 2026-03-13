-- Collaborative Stores Module
-- Tables: store_collaborators, revenue_shares

CREATE TABLE IF NOT EXISTS store_collaborators (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'creator'
                CHECK (role IN ('owner','manager','creator','marketer')),
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','suspended','removed')),
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(store_id, user_id)
);

CREATE TABLE IF NOT EXISTS revenue_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  collaborator_id UUID NOT NULL REFERENCES store_collaborators(id) ON DELETE CASCADE,
  share_type  VARCHAR(20) NOT NULL DEFAULT 'percent'
                CHECK (share_type IN ('percent','fixed')),
  share_value NUMERIC(10,4) NOT NULL CHECK (share_value >= 0),
  applies_to  VARCHAR(30) NOT NULL DEFAULT 'all'
                CHECK (applies_to IN ('all','sales','affiliate','live')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, collaborator_id, applies_to)
);

-- Collaboration invitations (separate from collaborators – used before acceptance)
CREATE TABLE IF NOT EXISTS collaboration_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'creator'
                CHECK (role IN ('manager','creator','marketer')),
  token       VARCHAR(100) UNIQUE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','expired','cancelled')),
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_collaborators_store ON store_collaborators(store_id);
CREATE INDEX IF NOT EXISTS idx_store_collaborators_user ON store_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_shares_store ON revenue_shares(store_id);
CREATE INDEX IF NOT EXISTS idx_collab_invitations_token ON collaboration_invitations(token);
CREATE INDEX IF NOT EXISTS idx_collab_invitations_store ON collaboration_invitations(store_id);
