-- Migration 033: Real marketplace category hierarchy
-- Inserts 9 main categories and 35 sub-categories mirroring large e-commerce
-- store structures (Electronics, Home & Garden, Fashion, …).
--
-- Idempotent: uses INSERT … ON CONFLICT (slug) DO NOTHING so re-running is safe.

-- ─── Main categories ──────────────────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('11100000-0000-0000-0000-000000000001', 'Elektronika',          'elektronika',          NULL, 'Smartfony, laptopy, TV, gaming i więcej.',         '📱', 10, true, NOW()),
  ('22200000-0000-0000-0000-000000000002', 'Dom i Ogród',          'dom-i-ogrod',          NULL, 'Meble, dekoracje, sprzęt AGD i oświetlenie.',     '🏠', 20, true, NOW()),
  ('33300000-0000-0000-0000-000000000003', 'Moda',                 'moda',                 NULL, 'Odzież, obuwie i dodatki dla kobiet i mężczyzn.', '👗', 30, true, NOW()),
  ('44400000-0000-0000-0000-000000000004', 'Zdrowie i Uroda',      'zdrowie-i-uroda',      NULL, 'Kosmetyki, perfumy, pielęgnacja włosów i skóry.', '💄', 40, true, NOW()),
  ('55500000-0000-0000-0000-000000000005', 'Sport i Outdoor',      'sport-i-outdoor',      NULL, 'Siłownia, rowery, camping i sprzęt outdoorowy.',   '🏋️', 50, true, NOW()),
  ('66600000-0000-0000-0000-000000000006', 'Dzieci i Zabawki',     'dzieci-i-zabawki',     NULL, 'Zabawki, produkty dla niemowląt i artykuły szkolne.','🧸', 60, true, NOW()),
  ('77700000-0000-0000-0000-000000000007', 'Motoryzacja',          'motoryzacja',          NULL, 'Akcesoria samochodowe, narzędzia i motocyklowe.',  '🚗', 70, true, NOW()),
  ('88800000-0000-0000-0000-000000000008', 'Zoologia',             'zoologia',             NULL, 'Produkty dla psów, kotów i akwariów.',             '🐾', 80, true, NOW()),
  ('99900000-0000-0000-0000-000000000009', 'Biuro i Biznes',       'biuro-i-biznes',       NULL, 'Sprzęt biurowy, drukarki i meble biurowe.',        '🖨️', 90, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Elektronika ──────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('11100000-0000-0000-0000-000000000011', 'Smartfony',            'smartfony',            '11100000-0000-0000-0000-000000000001', NULL, '📱', 10, true, NOW()),
  ('11100000-0000-0000-0000-000000000012', 'Komputery i Laptopy',  'komputery-i-laptopy',  '11100000-0000-0000-0000-000000000001', NULL, '💻', 20, true, NOW()),
  ('11100000-0000-0000-0000-000000000013', 'TV i Audio',           'tv-i-audio',           '11100000-0000-0000-0000-000000000001', NULL, '📺', 30, true, NOW()),
  ('11100000-0000-0000-0000-000000000014', 'Gaming',               'gaming',               '11100000-0000-0000-0000-000000000001', NULL, '🎮', 40, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Dom i Ogród ──────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('22200000-0000-0000-0000-000000000021', 'Meble',                'meble',                '22200000-0000-0000-0000-000000000002', NULL, '🪑', 10, true, NOW()),
  ('22200000-0000-0000-0000-000000000022', 'Dekoracje',            'dekoracje',            '22200000-0000-0000-0000-000000000002', NULL, '🖼️', 20, true, NOW()),
  ('22200000-0000-0000-0000-000000000023', 'Sprzęt AGD',           'sprzet-agd',           '22200000-0000-0000-0000-000000000002', NULL, '🍳', 30, true, NOW()),
  ('22200000-0000-0000-0000-000000000024', 'Oświetlenie',          'oswietlenie',          '22200000-0000-0000-0000-000000000002', NULL, '💡', 40, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Moda ─────────────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('33300000-0000-0000-0000-000000000031', 'Odzież Męska',         'odziez-meska',         '33300000-0000-0000-0000-000000000003', NULL, '👔', 10, true, NOW()),
  ('33300000-0000-0000-0000-000000000032', 'Odzież Damska',        'odziez-damska',        '33300000-0000-0000-0000-000000000003', NULL, '👗', 20, true, NOW()),
  ('33300000-0000-0000-0000-000000000033', 'Obuwie',               'obuwie',               '33300000-0000-0000-0000-000000000003', NULL, '👟', 30, true, NOW()),
  ('33300000-0000-0000-0000-000000000034', 'Dodatki',              'dodatki',              '33300000-0000-0000-0000-000000000003', NULL, '👜', 40, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Zdrowie i Uroda ──────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('44400000-0000-0000-0000-000000000041', 'Kosmetyki',            'kosmetyki',            '44400000-0000-0000-0000-000000000004', NULL, '💋', 10, true, NOW()),
  ('44400000-0000-0000-0000-000000000042', 'Perfumy',              'perfumy',              '44400000-0000-0000-0000-000000000004', NULL, '🌸', 20, true, NOW()),
  ('44400000-0000-0000-0000-000000000043', 'Pielęgnacja Włosów',   'pielegnacja-wlosow',   '44400000-0000-0000-0000-000000000004', NULL, '💇', 30, true, NOW()),
  ('44400000-0000-0000-0000-000000000044', 'Pielęgnacja Skóry',    'pielegnacja-skory',    '44400000-0000-0000-0000-000000000004', NULL, '🧴', 40, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Sport i Outdoor ──────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('55500000-0000-0000-0000-000000000051', 'Sprzęt Fitness',       'sprzet-fitness',       '55500000-0000-0000-0000-000000000005', NULL, '🏋️', 10, true, NOW()),
  ('55500000-0000-0000-0000-000000000052', 'Kolarstwo',            'kolarstwo',            '55500000-0000-0000-0000-000000000005', NULL, '🚴', 20, true, NOW()),
  ('55500000-0000-0000-0000-000000000053', 'Camping',              'camping',              '55500000-0000-0000-0000-000000000005', NULL, '⛺', 30, true, NOW()),
  ('55500000-0000-0000-0000-000000000054', 'Sprzęt Outdoorowy',    'sprzet-outdoorowy',    '55500000-0000-0000-0000-000000000005', NULL, '🏕️', 40, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Dzieci i Zabawki ────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('66600000-0000-0000-0000-000000000061', 'Zabawki',              'zabawki',              '66600000-0000-0000-0000-000000000006', NULL, '🧸', 10, true, NOW()),
  ('66600000-0000-0000-0000-000000000062', 'Produkty dla Niemowląt','produkty-dla-niemowlat','66600000-0000-0000-0000-000000000006', NULL, '🍼', 20, true, NOW()),
  ('66600000-0000-0000-0000-000000000063', 'Artykuły Szkolne',     'artykuly-szkolne',     '66600000-0000-0000-0000-000000000006', NULL, '📚', 30, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Motoryzacja ──────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('77700000-0000-0000-0000-000000000071', 'Akcesoria Samochodowe','akcesoria-samochodowe','77700000-0000-0000-0000-000000000007', NULL, '🚗', 10, true, NOW()),
  ('77700000-0000-0000-0000-000000000072', 'Narzędzia',            'narzedzia',            '77700000-0000-0000-0000-000000000007', NULL, '🔧', 20, true, NOW()),
  ('77700000-0000-0000-0000-000000000073', 'Akcesoria Motocyklowe','akcesoria-motocyklowe','77700000-0000-0000-0000-000000000007', NULL, '🏍️', 30, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Zoologia ─────────────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('88800000-0000-0000-0000-000000000081', 'Dla Psa',              'dla-psa',              '88800000-0000-0000-0000-000000000008', NULL, '🐕', 10, true, NOW()),
  ('88800000-0000-0000-0000-000000000082', 'Dla Kota',             'dla-kota',             '88800000-0000-0000-0000-000000000008', NULL, '🐈', 20, true, NOW()),
  ('88800000-0000-0000-0000-000000000083', 'Akwaria',              'akwaria',              '88800000-0000-0000-0000-000000000008', NULL, '🐠', 30, true, NOW())
ON CONFLICT (slug) DO NOTHING;

-- ─── Sub-categories: Biuro i Biznes ──────────────────────────────────────────

INSERT INTO categories (id, name, slug, parent_id, description, icon, sort_order, active, created_at)
VALUES
  ('99900000-0000-0000-0000-000000000091', 'Sprzęt Biurowy',       'sprzet-biurowy',       '99900000-0000-0000-0000-000000000009', NULL, '🖥️', 10, true, NOW()),
  ('99900000-0000-0000-0000-000000000092', 'Drukarki',             'drukarki',             '99900000-0000-0000-0000-000000000009', NULL, '🖨️', 20, true, NOW()),
  ('99900000-0000-0000-0000-000000000093', 'Meble Biurowe',        'meble-biurowe',        '99900000-0000-0000-0000-000000000009', NULL, '🪑', 30, true, NOW())
ON CONFLICT (slug) DO NOTHING;
