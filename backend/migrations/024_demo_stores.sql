-- Migration 024: Demo stores seed
-- Creates 10 fully-functional demo stores with products so the marketplace
-- does not look empty for first users.
--
-- Stores:
--   tech-gadgets-demo       | phone-accessories-demo | home-gadgets-demo
--   fitness-gear-demo       | beauty-tools-demo      | pet-products-demo
--   kids-toys-demo          | fashion-accessories-demo
--   car-accessories-demo    | trending-products-demo
--
-- Each store has 15 products with images, descriptions, categories, and pricing.
-- All are owned by a single demo seller account (demo@qualitet.pl).
-- Idempotent: uses ON CONFLICT DO NOTHING / WHERE NOT EXISTS.

-- ─── 1. Mark demo stores ──────────────────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Demo seller account ──────────────────────────────────────────────────
-- Bcrypt hash (cost 12) for the demo seller login password.
-- The demo password is documented separately in the platform admin guide.
INSERT INTO users (id, email, password_hash, name, role, plan, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@qualitet.pl',
  '$2a$12$LjiKKFyL8IBeedYHGAqMiepN4HS0W89Mo54y7gdvcVtMlwKfpiIQu',
  'Demo Seller',
  'seller',
  'elite',
  NOW()
)
ON CONFLICT DO NOTHING;

-- ─── 3. Active elite subscription for demo seller (10-year validity) ─────────
INSERT INTO subscriptions (user_id, plan, price, status, starts_at, ends_at)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'elite',
  0.00,
  'active',
  NOW(),
  NOW() + INTERVAL '10 years'
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions
  WHERE user_id = '00000000-0000-0000-0000-000000000001'
    AND status = 'active'
);

-- ─── 4. Demo stores ──────────────────────────────────────────────────────────
INSERT INTO stores (id, owner_id, name, slug, description, margin, plan, status, logo_url, is_demo, created_at)
VALUES
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Tech Gadgets',
   'tech-gadgets-demo',
   'Discover the latest tech gadgets – smartwatches, speakers, projectors and more cutting-edge devices for everyday life.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-tg/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000002',
   '00000000-0000-0000-0000-000000000001',
   'Phone Accessories',
   'phone-accessories-demo',
   'Everything your smartphone needs – cases, chargers, earbuds, mounts and accessories for every model.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-pa/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000003',
   '00000000-0000-0000-0000-000000000001',
   'Home Gadgets',
   'home-gadgets-demo',
   'Smart devices that make your home smarter – robot vacuums, smart bulbs, air purifiers and connected home gadgets.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-hg/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000004',
   '00000000-0000-0000-0000-000000000001',
   'Fitness Gear',
   'fitness-gear-demo',
   'Reach your fitness goals with top-quality gear – yoga mats, resistance bands, dumbbells, trackers and more.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-fg/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000005',
   '00000000-0000-0000-0000-000000000001',
   'Beauty Tools',
   'beauty-tools-demo',
   'Professional beauty tools for home use – hair dryers, straighteners, facial devices and grooming essentials.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-bt/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000006',
   '00000000-0000-0000-0000-000000000001',
   'Pet Products',
   'pet-products-demo',
   'Everything your pets need – automatic feeders, GPS collars, grooming tools, beds and fun toys.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-pp/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000007',
   '00000000-0000-0000-0000-000000000001',
   'Kids Toys',
   'kids-toys-demo',
   'Safe, creative and educational toys for children of all ages – building sets, RC cars, games and more.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-kt/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000008',
   '00000000-0000-0000-0000-000000000001',
   'Fashion Accessories',
   'fashion-accessories-demo',
   'Style-defining accessories – sunglasses, wallets, watches, bags, scarves and jewellery for every occasion.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-fa/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000009',
   '00000000-0000-0000-0000-000000000001',
   'Car Accessories',
   'car-accessories-demo',
   'Upgrade your drive with premium car accessories – dash cams, phone mounts, organisers and safety gear.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-ca/200/200',
   TRUE, NOW()),

  ('00000000-0000-0000-0001-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'Trending Products',
   'trending-products-demo',
   'Today''s hottest products curated for you – viral gadgets, lifestyle items and must-have innovations.',
   20, 'elite', 'active',
   'https://picsum.photos/seed/store-tr/200/200',
   TRUE, NOW())
ON CONFLICT DO NOTHING;

-- ─── 5. Products: Tech Gadgets ───────────────────────────────────────────────
-- Pricing:
--   sp = base selling price (price_net = platform_price)
--   supplier_price = sp × 0.75   (platform acquisition cost)
--   selling_price  = sp × 1.20   (20% store margin on top)
--   price_gross    = sp × 1.23   (price_net + 23% VAT)
-- Requires partial unique index on products(store_id, sku)
--   WHERE store_id IS NOT NULL AND sku IS NOT NULL  (created in 003a_central_catalog.sql)
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  -- sku, product name, description, base price (sp), stock qty
  ('TG-001','Smartwatch Pro X','Premium smartwatch with GPS, heart-rate monitor, SpO2 sensor and 7-day battery life. Compatible with iOS and Android.',199.00,150),
  ('TG-002','Wireless Bluetooth Speaker 20W','360° sound with deep bass, IPX7 waterproof, 12-hour battery, built-in microphone.',89.00,200),
  ('TG-003','Mini Pocket Projector','Portable LED projector, 200 lumens, HDMI+USB, 100" image, built-in speaker.',299.00,80),
  ('TG-004','Wireless Charging Pad 15W','Fast Qi wireless charger compatible with iPhone, Samsung and all Qi-enabled devices.',49.00,300),
  ('TG-005','Smart Home Hub','Central hub connecting all your smart home devices. Supports Zigbee, Z-Wave and Wi-Fi.',149.00,120),
  ('TG-006','Gaming Headset 7.1 Surround','Virtual 7.1 surround sound, RGB lighting, noise-cancelling microphone, USB connection.',99.00,180),
  ('TG-007','VR Headset for Smartphone','Immersive VR for 4.7"–6.5" smartphones, 120° FOV, adjustable pupil distance.',59.00,200),
  ('TG-008','4K Action Camera','Waterproof to 30 m, 4K 60fps, EIS stabilisation, wide-angle 170°, Wi-Fi sharing.',249.00,100),
  ('TG-009','Mini Drone with Camera','720p camera drone, 6-axis gyro, 15-min flight, one-key return, beginner friendly.',199.00,120),
  ('TG-010','USB-C Hub 7-in-1','HDMI 4K, 3×USB 3.0, SD/microSD slots, 100W PD pass-through, aluminium shell.',89.00,250),
  ('TG-011','Smart LED Desk Lamp','Adjustable brightness and colour temperature, USB charging port, touch controls.',59.00,300),
  ('TG-012','Portable SSD 500GB','USB 3.2 Gen 2, 1050 MB/s read speed, shock-resistant, pocket-sized.',179.00,100),
  ('TG-013','Mechanical Keyboard TKL','Tenkeyless layout, Cherry-compatible blue switches, RGB backlight, USB-A.',129.00,150),
  ('TG-014','Wireless Trackpad','Multi-touch gestures, 2.4 GHz dongle, up to 3-month battery, Windows/macOS.',79.00,180),
  ('TG-015','Digital Photo Frame 10"','10-inch IPS display, Wi-Fi, cloud photo sharing from your smartphone.',149.00,130)
)
SELECT
  '00000000-0000-0000-0001-000000000001',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2),
  23,
  ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2),
  ROUND(pd.sp, 2),
  ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2),
  20,
  pd.stock, 'tech gadgets',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 6. Products: Phone Accessories ──────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('PA-001','Premium Silicone Phone Case','Soft-touch silicone with microfibre lining. Anti-slip grip, raised camera bezels.',39.00,500),
  ('PA-002','Military-Grade Armour Case','Triple-layer protection: aluminium frame, TPU+PC back, dust-proof ports.',49.00,400),
  ('PA-003','Tempered Glass Screen Protector','9H hardness, 0.3mm thin, oleophobic coating, full-edge coverage.',19.00,800),
  ('PA-004','True Wireless Earbuds ANC','Active noise cancellation, 6-hour playtime + 24h case, touch controls.',99.00,300),
  ('PA-005','65W GaN Fast Charger','GaN III technology, 65W total output, 3 ports (2×USB-C + USB-A), foldable plug.',79.00,350),
  ('PA-006','Magnetic Phone Stand','Adjustable angle, MagSafe compatible, strong magnetic hold, desktop or bedside.',29.00,600),
  ('PA-007','Universal Car Phone Mount','360° rotation, one-touch clamp, dashboard + windshield + vent mounting.',29.00,500),
  ('PA-008','Selfie Ring Light 10"','10-inch LED ring light, 3 colour modes, 10 brightness levels, phone holder included.',49.00,400),
  ('PA-009','Clip-On Camera Lens Kit 5-in-1','Wide-angle, fisheye, macro, telephoto and CPL lenses. Universal clip, all phones.',39.00,350),
  ('PA-010','Phone Card Wallet Sleeve','Stick-on card holder, holds 3 cards, RFID blocking, ultra-slim.',19.00,700),
  ('PA-011','PopSocket Grip & Stand','Collapsible phone grip and stand. Easy to apply and reposition.',15.00,900),
  ('PA-012','Braided USB-C Cable 2m','2-metre braided nylon, USB-C to USB-C, 100W PD, 10 Gbps data transfer.',25.00,600),
  ('PA-013','Lightning Certified Cable 1.5m','MFi-certified Lightning cable, braided nylon, 20W fast charging.',29.00,500),
  ('PA-014','Power Bank 20000 mAh','20 000 mAh, Quick Charge 3.0 + PD 22.5W, 2×USB-A + 1×USB-C, LED display.',99.00,280),
  ('PA-015','Wireless Charging Stand 3-in-1','Simultaneously charges phone, smartwatch and earbuds. 15W max.',69.00,250)
)
SELECT
  '00000000-0000-0000-0001-000000000002',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'phone accessories',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 7. Products: Home Gadgets ────────────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('HG-001','Smart LED Bulb E27 RGB','16 million colours, 9W, Wi-Fi, voice control via Alexa/Google Home.',29.00,800),
  ('HG-002','Robot Vacuum Cleaner','2500 Pa suction, LiDAR mapping, app scheduling, auto-recharging, 150 min runtime.',499.00,60),
  ('HG-003','True HEPA Air Purifier','HEPA + activated carbon filter, 360 m³/h CADR, quiet mode 25 dB, PM2.5 sensor.',299.00,80),
  ('HG-004','Smart Wi-Fi Thermostat','7-day programmable, touch screen, energy reports, compatible with Alexa/Google.',149.00,100),
  ('HG-005','Outdoor Security Camera 2K','2K resolution, colour night vision, IP67, 2-way audio, AI motion alerts.',179.00,120),
  ('HG-006','Drip Coffee Maker 12-Cup','12-cup thermal carafe, programmable 24h timer, adjustable brew strength.',129.00,90),
  ('HG-007','5L Digital Air Fryer','5-litre basket, 8 preset programmes, touchscreen, 1500W, dishwasher-safe basket.',149.00,110),
  ('HG-008','Smart Wi-Fi Door Lock','Fingerprint + keypad + app access, auto-lock, tamper alarm, easy DIY install.',349.00,70),
  ('HG-009','Wi-Fi Water Leak Sensor','Instant app alert on water detection, 2-year battery, works with SmartThings.',39.00,400),
  ('HG-010','Video Doorbell with Chime','1080p video, night vision, motion zones, 2-way talk, cloud + local storage.',199.00,100),
  ('HG-011','Ultrasonic Cool Mist Humidifier','4L tank, 30-hour runtime, whisper quiet, auto shut-off, night light.',69.00,200),
  ('HG-012','Smart Plug 16A with Energy Monitor','Wi-Fi smart socket, real-time energy consumption, timer, Alexa/Google.',39.00,500),
  ('HG-013','Electric Kettle 1.7L Temperature Control','Variable temperature 40–100°C, keep-warm 60 min, 3000W, BPA-free.',89.00,150),
  ('HG-014','Smart Indoor Camera Pan-Tilt','1080p, 355° pan / 90° tilt, night vision, 2-way audio, micro-SD slot.',99.00,180),
  ('HG-015','Portable Mini Projector Wi-Fi','Built-in Android, 300 ANSI lumens, keystone correction, 120" image, HDMI.',399.00,70)
)
SELECT
  '00000000-0000-0000-0001-000000000003',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'home gadgets',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 8. Products: Fitness Gear ───────────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('FG-001','Premium Yoga Mat 6mm','Non-slip, extra-thick 6mm TPE mat, 183×61 cm, with carry strap.',59.00,300),
  ('FG-002','Resistance Bands Set (5 pcs)','Five progressive resistance levels (10–50 lbs), latex-free, with carry bag.',39.00,400),
  ('FG-003','Foam Roller High-Density 33cm','Deep tissue massage roller, high-density EVA foam, grid texture, 33 cm.',49.00,300),
  ('FG-004','Jump Rope with Counter','Steel ball bearings, adjustable cable, digital rep counter, carry bag.',29.00,500),
  ('FG-005','Neoprene Dumbbell Pair 2×5 kg','5 kg pair, neoprene coated, hex base prevents rolling, colour-coded.',69.00,200),
  ('FG-006','Cast Iron Kettlebell 16 kg','16 kg cast iron, powder-coated, flat base, ergonomic handle.',89.00,150),
  ('FG-007','Smart Fitness Tracker Band','Steps, calories, heart rate, SpO2, sleep tracking, 7-day battery, IP68.',79.00,250),
  ('FG-008','Heart Rate Monitor Chest Strap','Bluetooth + ANT+, accurate optical + electrical sensors, 400-hour battery.',69.00,180),
  ('FG-009','Workout Gloves Full-Finger','Anti-slip silicone palm grip, wrist support strap, breathable mesh.',29.00,400),
  ('FG-010','Doorway Pull-Up Bar','No drilling, adjustable 60–100 cm, padded grips, 150 kg capacity.',79.00,200),
  ('FG-011','Push-Up Handles Rotating','360° rotation to reduce wrist strain, non-slip foam grips, 200 kg rated.',39.00,350),
  ('FG-012','Ab Roller with Knee Mat','Dual-wheel ab wheel, extra-wide 30 cm, includes knee protection mat.',49.00,300),
  ('FG-013','Balance Board Cork','Cork + natural rubber, 40 cm diameter, 300 kg capacity, improves stability.',59.00,250),
  ('FG-014','Running Belt Waterproof','Zip pockets for phone up to 6.5", keys and cards, reflective strips, unisex.',29.00,450),
  ('FG-015','BPA-Free Protein Shaker 700ml','BlenderBall wire whisk, flip lid, measurement marks, 700 ml capacity.',19.00,600)
)
SELECT
  '00000000-0000-0000-0001-000000000004',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'fitness',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 9. Products: Beauty Tools ───────────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('BT-001','Professional Hair Dryer 2200W','Ionic technology, 2200W, 3 heat + 2 speed settings, cool-shot button, diffuser.',89.00,250),
  ('BT-002','Ceramic Hair Straightener','Ceramic plates, 230°C max, MCH heating in 30s, floating plates, 3 m swivel cord.',79.00,280),
  ('BT-003','Curling Wand 32mm','Ceramic-tourmaline barrel, 9 temperature settings, auto shut-off, heat-resistant glove.',69.00,250),
  ('BT-004','Rose Quartz Face Roller','100% natural rose quartz, dual-ended, cold stone glow effect, reduces puffiness.',39.00,500),
  ('BT-005','Sonic Electric Face Brush','12 000 oscillations/min, 3 modes, waterproof IPX7, 2 brush heads, travel pouch.',69.00,300),
  ('BT-006','LED Face Mask 7-Colour','7 LED wavelengths, anti-aging, acne treatment, 20-minute timer, adjustable strap.',129.00,150),
  ('BT-007','Electric Nail Drill 35 000 RPM','Professional 35k RPM nail drill, 6 drill bits, LCD speed display, forward/reverse.',59.00,350),
  ('BT-008','Lash Curler with Heating Pad','Heated lash curler, 2 heat settings, salon-style curl, battery-operated.',29.00,600),
  ('BT-009','Derma Roller 0.3mm','540 titanium micro-needles, 0.3mm depth, improves serum absorption.',39.00,400),
  ('BT-010','Professional Makeup Brush Set 16pcs','16-piece synthetic brush set, includes foundation, powder, contour, eye brushes.',49.00,450),
  ('BT-011','Boar Bristle Hair Brush','100% boar bristle, distributes natural oils, reduces frizz, wooden handle.',39.00,400),
  ('BT-012','Electric Scalp Massager','Wireless, 4 massage heads, waterproof, promotes hair growth, USB rechargeable.',49.00,350),
  ('BT-013','36W UV/LED Nail Lamp','36W dual light source, 3 timer settings, auto sensor, cures all gel polishes.',45.00,400),
  ('BT-014','Facial Sauna Steamer','Warm mist nano-steamer, 10-min auto timer, unclogs pores, 30 ml water tank.',49.00,300),
  ('BT-015','Exfoliating Silicone Body Scrubber','Double-sided silicone bristles, eco-friendly, antibacterial, quick-drying.',19.00,700)
)
SELECT
  '00000000-0000-0000-0001-000000000005',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'beauty',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 10. Products: Pet Products ──────────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('PP-001','Automatic Pet Feeder 6L','6-litre hopper, programmable 6 meals/day, portion control, voice recorder.',149.00,120),
  ('PP-002','GPS Pet Tracker Collar','Real-time GPS, waterproof, unlimited range via app, geofence alerts, 30-day battery.',99.00,200),
  ('PP-003','Soft-Sided Pet Carrier M','IATA-approved, mesh ventilation, shoulder strap, foldable, for cats/dogs up to 8 kg.',79.00,180),
  ('PP-004','Slicker Brush Self-Cleaning','Self-cleaning button, fine bent pins, ergonomic handle, suitable for all coat types.',29.00,500),
  ('PP-005','Pet Water Fountain 2.5L','2.5-litre circulating fountain, triple-filtration, ultra-quiet pump, BPA-free.',59.00,250),
  ('PP-006','Retractable Dog Leash 5m','5-metre nylon cord, one-button brake and lock, reflective stitching, up to 50 kg.',29.00,600),
  ('PP-007','Cat Tree with Scratching Post','5-tier cat tree, sisal-wrapped posts, plush hammock, dangling toys, 2 condos.',149.00,100),
  ('PP-008','Interactive Puzzle Feeder Toy','Slow feeder bowl with multi-level puzzles, slows eating, mental stimulation.',39.00,350),
  ('PP-009','Orthopedic Pet Bed XL','Memory foam base, waterproof liner, removable washable cover, non-slip bottom.',99.00,150),
  ('PP-010','LED Safety Collar Night Light','USB rechargeable, 3 light modes, waterproof, visible 500 m, adjustable.',25.00,700),
  ('PP-011','Stainless Steel Pet Bowl Set','Double non-slip stainless bowls on raised stand, dishwasher safe, 2×800 ml.',39.00,450),
  ('PP-012','Pet Deshedding Glove','5-finger design, 255 silicone tips, removes loose fur while petting, washable.',25.00,600),
  ('PP-013','Foldable Pet Playpen XL','8-panel steel playpen, no-tool assembly, foldable for storage, gate latch.',129.00,80),
  ('PP-014','Interactive Laser Toy Cat','Automatic rotating laser pointer, 5 patterns, USB rechargeable, auto shut-off.',35.00,400),
  ('PP-015','Dog Training Clicker with Wrist Strap','Ergonomic clicker, loud clear click, wrist strap, set of 3 colours.',12.00,900)
)
SELECT
  '00000000-0000-0000-0001-000000000006',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'pet products',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 11. Products: Kids Toys ─────────────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('KT-001','Classic Building Blocks 500pcs','500 colourful ABS plastic bricks, compatible with major brands, storage box.',79.00,200),
  ('KT-002','Remote Control Car 1:16','1:16 scale RC car, 2.4 GHz, 4WD, 25 km/h, rechargeable Li-ion, ages 6+.',99.00,180),
  ('KT-003','Kids Educational Tablet 7"','7-inch Android tablet, 32 GB, parental controls, 200+ learning apps, durable case.',149.00,120),
  ('KT-004','Family Board Game Strategy','Strategy board game for 2–6 players, ages 8+, average 45-min play time.',49.00,300),
  ('KT-005','Soft Plush Teddy Bear 40cm','Ultra-soft plush bear, 40 cm, hypoallergenic filling, machine washable, ages 0+.',29.00,500),
  ('KT-006','Wooden Play Kitchen Set','27-piece wooden kitchen set, pretend play stove + sink + oven, non-toxic paint.',119.00,100),
  ('KT-007','Magnetic Drawing Board A4','A4 colourful magnetic drawing board, erase-all slider, no mess, durable frame.',25.00,600),
  ('KT-008','Outdoor Bubble Machine','Automatic bubble blower, 1000 bubbles/min, USB + battery, includes 500 ml solution.',45.00,350),
  ('KT-009','Electronic Musical Keyboard 37 Keys','37 mini keys, 8 timbres, 6 rhythms, demo songs, microphone input, ages 3+.',69.00,200),
  ('KT-010','Diamond Kite 120cm','Dual-line stunt delta kite, 120 cm span, ripstop nylon, 30 m string, carry bag.',29.00,400),
  ('KT-011','Science Experiment Kit for Kids','20 science experiments, ages 8–12, step-by-step guide, all materials included.',49.00,250),
  ('KT-012','Programmable Coding Robot','Visual block coding, obstacle avoidance sensors, app-controlled, ages 6+.',149.00,100),
  ('KT-013','Balance Bike 12" Adjustable','No-pedal balance bike, adjustable seat 33–42 cm, rubber tyres, 2–5 years.',129.00,100),
  ('KT-014','Wooden Dollhouse 3-Storey','3-storey wooden dollhouse, 13 accessories, non-toxic paints, ages 3+.',199.00,80),
  ('KT-015','Kids Art Supplies Set 120pcs','120-piece art set: crayons, coloured pencils, watercolours, sketch pad, ages 4+.',39.00,350)
)
SELECT
  '00000000-0000-0000-0001-000000000007',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'kids & toys',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 12. Products: Fashion Accessories ───────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('FA-001','Polarised Aviator Sunglasses','UV400 polarised lenses, lightweight alloy frame, anti-glare, comes with case.',49.00,400),
  ('FA-002','Genuine Leather Bifold Wallet','Full-grain leather, 6 card slots, ID window, billfold, RFID blocking layer.',69.00,300),
  ('FA-003','Reversible Leather Belt 35mm','Genuine leather, solid brass buckle, reversible black/brown, 5 sizes.',49.00,350),
  ('FA-004','Classic Quartz Wristwatch','Stainless-steel case, mineral glass, 3 ATM water-resistant, 5-year battery.',99.00,250),
  ('FA-005','Unisex Fitted Cap','100% cotton twill, structured six-panel, pre-curved peak, adjustable strap.',29.00,600),
  ('FA-006','Merino Wool Beanie Hat','100% merino wool, ribbed knit, one size fits all, anti-itch, 12 colours.',39.00,500),
  ('FA-007','Cashmere-Feel Scarf 180×30cm','Acrylic cashmere blend, 180×30 cm, fringe ends, 16 colours, unisex.',35.00,450),
  ('FA-008','Touchscreen Leather Gloves','Genuine nappa leather outer, thermal fleece lining, touchscreen fingertips.',49.00,350),
  ('FA-009','Crossbody Shoulder Bag','Faux leather, adjustable strap, 3 pockets, magnetic closure, 22×16×8 cm.',59.00,300),
  ('FA-010','Minimalist Canvas Backpack 20L','20L capacity, 15.6" laptop pocket, USB charging port, water-resistant.',79.00,200),
  ('FA-011','Natural Jute Tote Bag','Large reusable tote, natural jute + cotton lining, reinforced handles, 42×38 cm.',25.00,700),
  ('FA-012','Crystal Jewellery Set (Necklace+Earrings)','Hypoallergenic sterling-silver plated chain and earrings, Swarovski-style crystal.',45.00,400),
  ('FA-013','Beaded Friendship Bracelet Set 6pcs','6 elastic bracelets, semi-precious stone beads, unisex, one-size-fits-all.',25.00,800),
  ('FA-014','Stainless Steel Ring Set 5pcs','Set of 5 stackable rings, tarnish-resistant 316L steel, hypoallergenic, sized.',35.00,600),
  ('FA-015','Leather Keychain Multi-Tool','Genuine leather strap, includes bottle opener + screwdriver + nail file.',19.00,900)
)
SELECT
  '00000000-0000-0000-0001-000000000008',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'fashion accessories',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 13. Products: Car Accessories ───────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('CA-001','Magnetic Dashboard Phone Mount','Strong 15N magnet, 360° rotation, compatible with MagSafe, no-scratch pad.',29.00,600),
  ('CA-002','Dash Cam 4K Front + Rear','4K front + 1080p rear, 170° FOV, night vision, loop recording, parking mode.',199.00,150),
  ('CA-003','USB-C + USB-A Dual Car Charger 38W','38W total, USB-C PD 20W + USB-A 18W QC3.0, flush design, compatible all phones.',29.00,700),
  ('CA-004','Universal Seat Cover Set','Full set (front + rear), polyester mesh, anti-slip backing, airbag-compatible.',119.00,100),
  ('CA-005','Leather Steering Wheel Cover 37-39cm','Genuine leather, 37–39 cm, anti-slip stitching, breathable, universal fit.',39.00,400),
  ('CA-006','Vent Air Freshener 3-Pack','Clip-on vent freshener, 3 scents (ocean, forest, citrus), 45-day fragrance each.',19.00,1000),
  ('CA-007','Car Emergency Kit 20pcs','Jump leads, reflective triangle, first-aid kit, torch, tow rope, tyre inflator.',99.00,120),
  ('CA-008','Boot Organiser Foldable 50L','50-litre foldable organiser, non-slip base, 3 compartments, carry handles.',59.00,250),
  ('CA-009','Reverse Parking Sensor Kit 4-Probe','4 ultrasonic probes, buzzer + LED display, DIY install, detects 0.3–2.5 m.',79.00,180),
  ('CA-010','Windshield Sun Shade Foldable','Accordion fold, UV and heat reflector, fits 130–155 cm windscreens, carry bag.',25.00,700),
  ('CA-011','Seat Gap Filler Organiser (Pair)','Fills gap between seat and console, storage pocket, cup holder, PU leather.',29.00,600),
  ('CA-012','Cordless Car Vacuum 100W','100W cyclone suction, HEPA filter, 10 000 Pa, 6-metre power cord, 5 attachments.',79.00,200),
  ('CA-013','Digital Tyre Pressure Gauge','LCD digital gauge, 5–99 PSI, Schrader valve, auto-shutoff, includes battery.',19.00,800),
  ('CA-014','Premium Wiper Blades Pair 600+450mm','Frameless flat blades, 600 mm + 450 mm, graphite coating, universal U-hook.',35.00,400),
  ('CA-015','RGB LED Interior Ambient Light Kit','4-piece RGB strip, 16 colours + music sync, app-controlled, easy peel-and-stick.',45.00,350)
)
SELECT
  '00000000-0000-0000-0001-000000000009',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'car accessories',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;

-- ─── 14. Products: Trending Products ─────────────────────────────────────────
INSERT INTO products (
  store_id, supplier_id, name, sku, description,
  price_net, tax_rate, price_gross,
  supplier_price, platform_price, min_selling_price,
  selling_price, margin,
  stock, category, image_url,
  is_central, status, created_at
)
WITH pd (sku, name, description, sp, stock) AS (VALUES
  ('TR-001','RGB LED Strip Lights 10m','10 m smart LED strip, 16 million colours, music sync, app + voice control, cuttable.',49.00,500),
  ('TR-002','Portable Bluetooth Karaoke Mic','Built-in speaker + echo, Bluetooth 5.0, 6-hour battery, compatible all phones.',59.00,400),
  ('TR-003','Magnetic Levitating Plant Pot','Magnetically levitating and rotating pot, electromagnetic base, LED spotlight.',129.00,150),
  ('TR-004','Acupressure Back & Foot Mat Set','Lotus mat + pillow + foot pad set, 8820 acupressure points, improves circulation.',69.00,250),
  ('TR-005','Cold Brew Coffee Maker 1L','1-litre glass carafe, fine-mesh filter, makes cold brew in 12–24 h, airtight lid.',59.00,300),
  ('TR-006','Countertop Ice Maker 12kg/day','Makes 9 ice cubes in 6 min, 12 kg/day capacity, self-cleaning, quiet 35 dB.',199.00,100),
  ('TR-007','Electric Heated Blanket 160×120cm','160×120 cm, 9 heat settings, fast-heat in 3 min, auto shut-off after 3 h.',99.00,180),
  ('TR-008','Smart Posture Corrector','Vibration reminder, Bluetooth app tracking, adjustable straps, discreet under shirt.',49.00,400),
  ('TR-009','Mini Bluetooth Thermal Printer','Prints 57mm photos/labels from phone, 200 dpi, rechargeable, no ink needed.',99.00,250),
  ('TR-010','Fingerprint Padlock Keyless','30 fingerprints, USB-C rechargeable, IP66 weatherproof, 0.5-second unlock.',79.00,300),
  ('TR-011','Neck & Shoulder Massager Heated','Shiatsu 3D kneading, infrared heat, 8 massage nodes, auto shut-off, USB power.',89.00,250),
  ('TR-012','Personal Air Cooler Mini USB','Evaporative cooling, 3 speeds, 500 ml tank, 8-hour runtime, whisper quiet.',49.00,450),
  ('TR-013','Weighted Blanket 7kg 150×200cm','7 kg, 150×200 cm, breathable glass bead fill, reduces anxiety and improves sleep.',149.00,120),
  ('TR-014','Sunrise Alarm Clock with Light','Sunrise simulation, nature sounds, FM radio, dimmable night light, USB port.',79.00,200),
  ('TR-015','Reusable Smart Notebook A5','Microwave-erasable, 36 pages, cloud sync via app (Evernote/Google Drive), pen included.',59.00,350)
)
SELECT
  '00000000-0000-0000-0001-000000000010',
  NULL,
  pd.name, pd.sku, pd.description,
  ROUND(pd.sp, 2), 23, ROUND(pd.sp * 1.23, 2),
  ROUND(pd.sp * 0.75, 2), ROUND(pd.sp, 2), ROUND(pd.sp, 2),
  ROUND(pd.sp * 1.20, 2), 20,
  pd.stock, 'trending',
  'https://picsum.photos/seed/' || pd.sku || '/400/400',
  FALSE, 'active', NOW()
FROM pd
ON CONFLICT (store_id, sku)
  WHERE store_id IS NOT NULL AND sku IS NOT NULL
  DO NOTHING;
