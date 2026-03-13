-- Gamification Module
-- Tables: user_points, user_badges, badge_definitions, user_levels, leaderboard_cache

CREATE TABLE IF NOT EXISTS badge_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(60) UNIQUE NOT NULL,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  icon_url    TEXT,
  category    VARCHAR(30) NOT NULL DEFAULT 'general'
                CHECK (category IN ('sales','affiliate','social','platform','special')),
  points_reward INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_points (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points      INTEGER NOT NULL CHECK (points != 0),
  reason      VARCHAR(120) NOT NULL,
  source      VARCHAR(30) NOT NULL DEFAULT 'system'
                CHECK (source IN ('order','affiliate','social','badge','admin','bonus','referral')),
  reference_id UUID,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id    UUID NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  awarded_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS user_levels (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  level_name   VARCHAR(60) NOT NULL DEFAULT 'Nowicjusz',
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard cache (refreshed periodically or on demand)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_type VARCHAR(30) NOT NULL DEFAULT 'global'
                    CHECK (leaderboard_type IN ('global','weekly','monthly','sellers','creators')),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank          INTEGER NOT NULL,
  total_points  INTEGER NOT NULL DEFAULT 0,
  refreshed_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(leaderboard_type, user_id)
);

-- Seed default badge definitions
INSERT INTO badge_definitions (code, name, description, category, points_reward) VALUES
  ('first_sale',       'Pierwsza sprzedaż',      'Dokonałeś pierwszej sprzedaży na platformie',        'sales',     50),
  ('ten_sales',        '10 sprzedaży',            'Dokonałeś 10 sprzedaży na platformie',               'sales',    100),
  ('hundred_sales',    '100 sprzedaży',           'Dokonałeś 100 sprzedaży – prawdziwy sprzedawca!',    'sales',    500),
  ('first_affiliate',  'Pierwszy partner',        'Wygenerowałeś pierwszy link afiliacyjny',            'affiliate',  30),
  ('top_creator',      'Top kreator',             'Osiągnąłeś status Top Kreatora',                     'affiliate', 200),
  ('social_star',      'Social Star',             'Zdobyłeś 100 polubień swoich postów',                'social',     75),
  ('welcome',          'Witamy!',                 'Ukończyłeś rejestrację na platformie',               'platform',   10),
  ('verified_seller',  'Zweryfikowany sprzedawca','Twój sklep został zweryfikowany',                    'platform',  100)
ON CONFLICT (code) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_created ON user_points(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_cache(leaderboard_type, rank);
