# STATUS PLATFORMY QUALITET — PEŁNY RAPORT

> Data przeglądu: 2026-03-14  
> Cel: Pełny przegląd systemu dla architekta platformy — podstawa do planowania kolejnych etapów.

---

## 1. STRUKTURA PROJEKTU

### Katalog główny

```
/
├── .github/
│   └── copilot-instructions.md       # Instrukcje dla GitHub Copilot
├── assets/
│   ├── icons/                        # Ikony PWA (SVG 192px, 512px)
│   └── images/                       # Obrazy statyczne
├── backend/                          # Node.js REST API
│   ├── migrations/                   # Pliki SQL migracji bazy danych (001–018)
│   ├── scripts/                      # Narzędzia CLI (seed-owner.js)
│   ├── src/
│   │   ├── app.js                    # Główna aplikacja Express
│   │   ├── config/
│   │   │   └── database.js           # Klient PostgreSQL (pg)
│   │   ├── helpers/
│   │   │   ├── audit.js              # auditLog() + computeSellingPrice()
│   │   │   ├── pricing.js            # computePlatformPrice() z tierami marży
│   │   │   ├── promo.js              # getPromoSlots() – early-access slots
│   │   │   └── slug.js               # generateSlug() – URL slug
│   │   ├── middleware/
│   │   │   ├── auth.js               # authenticate, requireRole, requireActiveSubscription
│   │   │   ├── subdomain.js          # Subdomain resolver middleware
│   │   │   └── validate.js           # express-validator wrapper
│   │   ├── routes/
│   │   │   ├── admin.js              # /api/admin – panel administracyjny
│   │   │   ├── affiliate.js          # /api/affiliate – system twórców afiliacyjnych
│   │   │   ├── analytics.js          # /api/analytics – snapshoty analityczne
│   │   │   ├── auth.js               # /api/auth – login, register, me
│   │   │   ├── cart.js               # /api/cart – koszyk
│   │   │   ├── categories.js         # /api/categories – kategorie produktów
│   │   │   ├── my.js                 # /api/my – dashboard sprzedawcy
│   │   │   ├── orders.js             # /api/orders – zamówienia
│   │   │   ├── payments.js           # /api/payments – płatności (Stripe, P24, BLIK)
│   │   │   ├── products.js           # /api/products – produkty publiczne
│   │   │   ├── referral.js           # /api/referral – kody polecające
│   │   │   ├── referrals.js          # /api/referrals – zarządzanie kodami
│   │   │   ├── scripts.js            # /api/scripts – skrypty storefrontu
│   │   │   ├── shop-products.js      # /api/shop-products – produkty w sklepach
│   │   │   ├── shops.js              # /api/shops – sklepy (alias)
│   │   │   ├── store.js              # /api/store – publiczny widok sklepu
│   │   │   ├── stores.js             # /api/stores – zarządzanie sklepami
│   │   │   ├── subscriptions.js      # /api/subscriptions – subskrypcje + Stripe checkout
│   │   │   ├── suppliers.js          # /api/suppliers – hurtownicy
│   │   │   └── users.js              # /api/users – konta użytkowników
│   │   └── services/
│   │       └── supplier-import.js    # Import CSV/XML/API z hurtowni
│   ├── tests/
│   │   └── api.test.js               # ~404 testów Jest + supertest (5 356 linii)
│   ├── .env.example                  # Wzorzec zmiennych środowiskowych
│   ├── Dockerfile                    # Obraz Docker dla API
│   └── package.json
├── css/
│   └── style.css                     # Globalne style CSS
├── js/
│   ├── api.js                        # window.QMApi – klient REST API
│   ├── api-client.js                 # window.QualitetAPI – shim kompatybilności
│   ├── app.js                        # Główna logika PWA
│   ├── cart.js                       # Logika koszyka
│   ├── flow.js                       # Koordynator przepływów stron
│   └── pwa-connect.js                # Mostek frontend → backend
├── tasks/
│   └── index.html                    # Strona zadań wewnętrznych
├── *.html                            # 22 strony PWA
├── *.css                             # Style stron (landing.css, panel.css, shop.css, styles.css)
├── shop.js                           # Logika sklepu publicznego
├── stores.js                         # Logika listowania sklepów
├── service-worker.js                 # PWA Service Worker (offline/cache)
├── manifest.json                     # PWA manifest
├── CNAME                             # GitHub Pages – domena uszefaqualitet.pl
├── docker-compose.yml                # PostgreSQL + API w Dockerze
├── ARCHITECTURE.md                   # Opis architektury
└── README.md                         # Dokumentacja projektu
```

### Pliki konfiguracyjne

| Plik | Przeznaczenie |
|------|---------------|
| `backend/.env.example` | Wzorzec .env z opisem wszystkich zmiennych |
| `backend/Dockerfile` | Build obrazu Docker (Node.js 18 Alpine) |
| `docker-compose.yml` | Orkiestracja: PostgreSQL 16 + API Node.js |
| `manifest.json` | PWA manifest (nazwa, ikony, kolory) |
| `service-worker.js` | Cache assets + tryb offline |
| `CNAME` | Domena: `uszefaqualitet.pl` |
| `.nojekyll` | Wyłączenie Jekyll na GitHub Pages |

---

## 2. STATUS BACKENDU

### Serwer Node.js

| Parametr | Wartość |
|----------|---------|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4.x |
| Port | 3000 (konfigurowalny przez `PORT`) |
| Health check | `GET /health` → `{ status: "ok", timestamp }` |
| Readiness check | `GET /api/readiness` → pełny status wszystkich subsystemów |
| Rate limiting | 100 req/15min (global), 20 req/15min (auth endpoints) |
| Body limit | 1 MB JSON + urlencoded |
| Security headers | Helmet.js |
| CORS | Konfigurowalny przez `ALLOWED_ORIGINS` |

### Zaimplementowane API

| Prefix | Plik | Kluczowe endpointy |
|--------|------|--------------------|
| `/api/auth` | auth.js | POST /register, POST /login, GET /me, PUT /me |
| `/api/users` | users.js | GET /, GET /me, PUT /me, PUT /me/password, POST /register, POST /login |
| `/api/stores` | stores.js | GET /, GET /:id, POST /, PUT /:id (social media), DELETE /:id |
| `/api/shops` | shops.js | (alias stores) |
| `/api/products` | products.js | GET /?sort=new|bestsellers|price_asc|price_desc, GET /:id, POST /, PUT /:id, DELETE /:id |
| `/api/shop-products` | shop-products.js | GET /, POST /, PUT /:id, DELETE /:id |
| `/api/cart` | cart.js | GET /, POST /, POST /items, PUT /items/:id, DELETE /, DELETE /items/:id |
| `/api/orders` | orders.js | GET /, GET /:id, POST /, PATCH /:id/status |
| `/api/payments` | payments.js | GET /, GET /:id, POST /, PUT /:id/status, POST /webhook, POST /:orderId/initiate, POST /stripe/webhook |
| `/api/subscriptions` | subscriptions.js | GET /, POST /, GET /my, GET /plans, POST /:id/checkout (Stripe) |
| `/api/suppliers` | suppliers.js | GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /:id/sync, POST /import |
| `/api/categories` | categories.js | GET /, POST /, DELETE /:id |
| `/api/admin` | admin.js | Dashboard, users, stores, products, suppliers, orders, subscriptions, audit-logs, settings, import, announcements, mail |
| `/api/my` | my.js | GET /store, GET /store/stats, GET /store/orders, PATCH /store, GET|POST|PATCH|DELETE /store/products, POST /store/generate, POST /promotion/generate, GET /orders, POST /store/products/bulk |
| `/api/store` | store.js | Publiczny widok sklepu po slug/subdomain |
| `/api/referral` | referral.js | GET /my-code, GET /stats, GET /admin |
| `/api/referrals` | referrals.js | GET /, GET /:id, GET /:id/uses, POST /, PATCH /:id, DELETE /:id, POST /redeem |
| `/api/scripts` | scripts.js | GET /, POST /, GET /store/:storeId, PATCH /:id, DELETE /:id |
| `/api/analytics` | analytics.js | GET /, GET /latest, POST /capture |
| `/api/affiliate` | affiliate.js | Dashboard, links, earnings, balance, withdraw, products, click/:code, seller/*, admin/* |
| `/api/promo/slots` | app.js | GET – liczba dostępnych slotów early-access |
| `/api/announcements` | app.js | GET – aktywne komunikaty platformy |

### System autentykacji

- **JWT Bearer tokens** – `jsonwebtoken`, wygasanie: 7 dni (konfigurowalnie przez `JWT_EXPIRES_IN`)
- **Bcrypt** – hashowanie haseł (`bcryptjs`)
- **Role**: `buyer`, `seller`, `admin`, `owner`, `superadmin`
- **Middleware**: `authenticate`, `requireRole(...roles)`, `requireSuperAdmin`, `requireActiveSubscription`
- **Subskrypcja**: `requireActiveSubscription` – sprawdza czy sklep ma aktywną subskrypcję (pass-through jeśli brak store_id)
- **Rate limiting** na `/api/users/login`, `/api/users/register`, `/api/auth/login`, `/api/auth/register` (20 req/15min)

### System produktów

| Pole | Opis |
|------|------|
| `supplier_price` | Cena hurtownika (brutto) |
| `platform_price` | Cena platformy (wyliczona z tierów marży) |
| `min_selling_price` | Minimalna cena sprzedaży (= platform_price) |
| `price_net` / `price_gross` | Ceny netto/brutto |
| `selling_price` | Cena sprzedaży (z marżą sprzedawcy) |
| `is_central` | Czy produkt należy do katalogu centralnego |

Łańcuch cenowy: `supplier_price → [tier marży platformy] → platform_price → [marża sprzedawcy] → selling_price`

Sortowanie: `?sort=new` (domyślnie), `bestsellers`, `price_asc`, `price_desc`

### System hurtowników (Supplier)

- Import produktów: CSV, XML, API (fetch URL) — `POST /api/admin/products/import`, `POST /api/admin/suppliers/import`
- Auto-sync co 12 godzin (scheduler w `app.js`)
- Formaty obsługiwane przez `supplier-import.js`: JSON REST, CSV, XML
- Domyślna stawka VAT: 23% (polska norma)
- Deduplication: `(supplier_id, sku)` — upsert przy konflikcie

### Koszyk i Checkout

- Koszyk: persystowany w bazie danych (tabela `carts`, `cart_items`)
- Obsługa produktów z katalogu centralnego (`store_id IS NULL`)
- Checkout: `POST /api/orders` tworzy zamówienie z `order_items`
- Prowizja: automatycznie naliczana przy każdym zamówieniu

### Integracja Stripe

| Funkcja | Status |
|---------|--------|
| Inicjowanie płatności (`POST /api/payments/:orderId/initiate`) | ✅ GOTOWE |
| Stripe Checkout Session (`POST /api/subscriptions/:id/checkout`) | ✅ GOTOWE |
| Webhook Stripe (`POST /api/payments/stripe/webhook`) | ✅ GOTOWE |
| Weryfikacja sygnatury Stripe | ✅ GOTOWE |
| Konfiguracja przez `STRIPE_SECRET_KEY` | ⚙️ Wymaga klucza prod |

### Affiliate Tracking

| Funkcja | Status |
|---------|--------|
| Linki afiliacyjne twórców | ✅ GOTOWE |
| Śledzenie kliknięć (`GET /api/affiliate/click/:code`) | ✅ GOTOWE |
| Konwersje i prowizje | ✅ GOTOWE |
| Wypłaty (withdraw) z zatwierdzeniem przez admina | ✅ GOTOWE |
| Dashboard twórcy (kliknięcia, konwersje, saldo) | ✅ GOTOWE |
| Panel sprzedawcy (ustawienia prowizji per produkt) | ✅ GOTOWE |
| Panel administratora (przegląd wszystkich wypłat, statystyki) | ✅ GOTOWE |

### Schemat bazy danych

#### Tabele główne (migracje 001–018)

| Tabela | Opis |
|--------|------|
| `users` | Konta użytkowników (role, promo_tier, referred_by_code) |
| `stores` | Sklepy sprzedawców (subdomain, social_*, owner_id) |
| `subscriptions` | Subskrypcje sklepów (plan, status, expires_at) |
| `suppliers` | Hurtownicy (api_url, xml_endpoint, csv_endpoint) |
| `products` | Katalog centralny i produkty sklepów (pełny łańcuch cenowy) |
| `categories` | Drzewo kategorii |
| `product_images` | Zdjęcia produktów |
| `shop_products` | Produkty w sklepach (seller_margin, price_override, selling_price) |
| `carts` | Koszyki użytkowników |
| `cart_items` | Pozycje w koszyku |
| `orders` | Zamówienia |
| `order_items` | Pozycje zamówień |
| `payments` | Płatności (provider, status, HMAC webhook) |
| `audit_logs` | Dziennik audytu (actorUserId, action, resource, resourceId) |
| `platform_settings` | Ustawienia platformy (commission_rate, margin_tiers) |
| `referral_codes` | Kody polecające (user_id, code, discount) |
| `referral_uses` | Użycia kodów polecających |
| `scripts` | Skrypty storefrontu (JS/CSS per sklep) |
| `analytics_snapshots` | Snapshoty analityczne (GMV, sellers, orders) |
| `announcements` | Komunikaty platformy (type, target_role, is_active) |
| `affiliate_links` | Linki afiliacyjne twórców |
| `affiliate_conversions` | Konwersje afiliacyjne |
| `affiliate_withdrawals` | Wnioski o wypłatę |

#### Migracje

| Plik | Zawartość |
|------|-----------|
| `001_initial_schema.sql` | users, subscriptions, suppliers, stores, products, orders, order_items |
| `002_extended_schema.sql` | categories, product_images, shop_products, carts, cart_items, payments, audit_logs |
| `003_product_status.sql` | Pole `status` w products |
| `003a_central_catalog.sql` | Katalog centralny (is_central, store_id=NULL) |
| `004_central_catalog.sql` | Rozszerzenie katalogu centralnego |
| `005_performance_indexes.sql` | Indeksy wydajnościowe |
| `006_subscription_marketplace.sql` | Subskrypcje per-sklep (shop_id) |
| `007_subdomain_support.sql` | Subdomeny sklepów |
| `007_stores_subdomain.sql` | Pole `subdomain` w stores |
| `007_suppliers_import.sql` | Pola import w suppliers (xml_endpoint, csv_endpoint) |
| `008_bigbuy_seed.sql` | Seed danych BigBuy |
| `009_platform_price.sql` | Pole `platform_price` w products |
| `009_price_tiers.sql` | supplier_price, min_selling_price, seller_margin, tiery marży |
| `010_payments_provider.sql` | Pole `payment_provider` w payments |
| `011_platform_commission.sql` | Tabela `platform_settings`, prowizja platformy |
| `012_initial_products_seed.sql` | Seed 200+ produktów do katalogu centralnego |
| `013_owner_phone.sql` | Pole `phone` w users |
| `014_referral_analytics_scripts.sql` | referral_codes (discount), referral_uses, scripts, analytics_snapshots |
| `015_referral_promo.sql` | Rozszerzenie systemu polecającego (user_id, referrer_id, bonus_months) |
| `016_announcements.sql` | Tabela `announcements` |
| `017_store_social_media.sql` | Pola social_facebook/instagram/tiktok/twitter w stores |
| `018_affiliate_creators.sql` | affiliate_links, affiliate_conversions, affiliate_withdrawals |

---

## 3. STATUS FRONTENDU

### Strony HTML (22 stron)

| Plik | Opis | Status |
|------|------|--------|
| `index.html` | Strona główna PWA / landing | ✅ GOTOWE |
| `login.html` | Logowanie i rejestracja | ✅ GOTOWE |
| `dashboard.html` | Dashboard użytkownika | ✅ GOTOWE |
| `sklep.html` | Publiczny widok sklepu | ✅ GOTOWE |
| `koszyk.html` | Koszyk i checkout | ✅ GOTOWE |
| `listing.html` | Listing produktów | ✅ GOTOWE |
| `panel-sklepu.html` | Panel sprzedawcy | ✅ GOTOWE |
| `owner-panel.html` | Panel właściciela / superadmin | ✅ GOTOWE |
| `operator-panel.html` | Panel operatora (admin) | ✅ GOTOWE |
| `generator-sklepu.html` | Generator sklepu dropshipping | ✅ GOTOWE |
| `hurtownie.html` | Strona hurtowników (10 kart) | ✅ GOTOWE |
| `zarabiaj.html` | Landing "Zarabiaj" – early access | ✅ GOTOWE |
| `cennik.html` | Cennik planów subskrypcyjnych | ✅ GOTOWE |
| `qualitetmarket.html` | QualitetMarket – marketplace B2B/B2C | ✅ GOTOWE |
| `market-landing.html` | Landing strona marketu | ✅ GOTOWE |
| `affiliate.html` | Program partnerski / twórcy | ✅ GOTOWE |
| `linki-sprzedazowe.html` | Linki sprzedażowe afiliacyjne | ✅ GOTOWE |
| `zostan-dostawca.html` | Onboarding dostawców | ✅ GOTOWE |
| `crm.html` | CRM (widok wewnętrzny) | ✅ GOTOWE |
| `intelligence.html` | Intelligence / analityka | ✅ GOTOWE |
| `tasks.html` | Widok zadań | ✅ GOTOWE |
| `404.html` | Strona błędu 404 | ✅ GOTOWE |

### Pliki JavaScript

| Plik | Opis |
|------|------|
| `js/api.js` | `window.QMApi` – klient REST: Auth, Products, Cart, Orders, Admin, Affiliate, Analytics |
| `js/api-client.js` | `window.QualitetAPI` – shim kompatybilności delegujący do QMApi |
| `js/app.js` | Główna logika PWA: PWA install bar, app promo (wyłączone auto-triggery), initPlanGates() |
| `js/cart.js` | Logika koszyka (dodawanie, aktualizacja, podsumowanie) |
| `js/flow.js` | Koordynator przepływów: login, dashboard, sklep, koszyk, listing, panel-sklepu, owner-panel |
| `js/pwa-connect.js` | Mostek frontend → backend: login, rejestracja, checkout, dashboard |
| `shop.js` | Logika publicznego widoku sklepu |
| `stores.js` | Logika listowania sklepów |
| `service-worker.js` | PWA Service Worker (cache assets, offline fallback) |

### Responsywność mobilna

- Viewport meta tag ustawiony (`width=device-width, initial-scale=1`)
- PWA manifest z ikonami 192×512 px (SVG)
- Tryb standalone PWA (bez paska przeglądarki)
- CSS: `landing.css`, `panel.css`, `shop.css`, `styles.css` — style responsywne
- Brak zewnętrznego frameworka (Bootstrap / Tailwind) — custom CSS
- Apple Mobile Web App capable + status bar style zdefiniowane

### Panel Sprzedawcy

- `panel-sklepu.html` + `js/flow.js` → `/api/my/*`
- Widoki: produkty sklepu, zamówienia, statystyki, ustawienia
- Generowanie sklepu: `POST /api/my/store/generate`
- Generowanie promocji: `POST /api/my/promotion/generate`
- Bulk-import produktów: `POST /api/my/store/products/bulk`

### Panel Dostawcy

- `hurtownie.html` – 10 statycznych kart hurtowników (BigBuy, Syncee, Spocket, Dropcom, EU-Trade, VidaXL, SaleHoo, Avasam, BrandsGateway, Modalyst)
- Selektory hurtowników jako przyciski z `aria-pressed`
- Przyciski importu widoczne tylko dla admin (`[data-admin-only]` – ukryte przez CSS)
- `zostan-dostawca.html` – formularz onboarding dostawcy

### System kont użytkownika

- Rejestracja / logowanie przez `login.html` → `js/pwa-connect.js` → `/api/auth`
- JWT przechowywane w localStorage
- Profil użytkownika przez `GET /api/users/me`
- Zmiana hasła przez `PUT /api/users/me/password`

### Framework UI

- **Vanilla JavaScript** – brak frameworków (React, Vue, Angular)
- **Custom CSS** – własne style, bez zewnętrznych bibliotek CSS
- **PWA** – Service Worker, manifest.json, standalone mode
- **Ikony**: SVG (icon-192.svg, icon-512.svg)

---

## 4. MOBILE STORE

| Aspekt | Status |
|--------|--------|
| Viewport meta tag | ✅ Ustawiony |
| PWA manifest | ✅ Kompletny |
| Standalone mode (bez paska) | ✅ Skonfigurowany |
| Apple Web App capable | ✅ Skonfigurowany |
| Service Worker (offline) | ✅ Zaimplementowany |
| App install bar (custom) | ✅ Auto-dismiss po 8s, localStorage dismiss key |
| App promo auto-trigger | ⛔ Wyłączony (scheduleAppPromoTriggers = no-op) |
| Subscription plan gates | ⛔ Wyłączone (initPlanGates usuwa locked state) |
| Touch targets | ⚠️ Wymaga testów na urządzeniach fizycznych |
| Offline catalog | ⚠️ Service Worker cache – zakres nieokreślony |
| Native payment (Apple/Google Pay) | ❌ Brak – tylko Stripe/P24/BLIK |

**Braki mobilne:**
- Brak natywnych powiadomień PUSH
- Brak deep linków (URL scheme)
- Brak testów urządzeniowych (iOS Safari, Android Chrome)
- Brak dedykowanej nawigacji bottombar na mobile

---

## 5. SYSTEM DOSTAWCÓW (SUPPLIER)

| Funkcja | Status |
|---------|--------|
| Lista hurtowników (`GET /api/suppliers`) | ✅ GOTOWE – zwraca array (auth required) |
| Szczegóły hurtownika (`GET /api/suppliers/:id`) | ✅ GOTOWE |
| Dodawanie hurtownika (admin) | ✅ GOTOWE |
| Edycja hurtownika (admin) | ✅ GOTOWE |
| Usuwanie hurtownika (admin) | ✅ GOTOWE |
| Sync hurtowni (`POST /api/suppliers/:id/sync`) | ✅ GOTOWE (store_id wymagany dla non-admin) |
| Import CSV/XML/API | ✅ GOTOWE |
| Auto-sync co 12 godzin | ✅ GOTOWE (scheduler w app.js) |
| 10 pre-seeded hurtowni (BigBuy itp.) | ✅ GOTOWE |
| Deduplication (supplier_id + sku) | ✅ GOTOWE |
| VAT kalkulacja (23%) | ✅ GOTOWE |

**Onboarding dostawcy:**
- Strona `zostan-dostawca.html` – formularz zgłoszeniowy
- Backend: dodanie dostawcy przez admina (`POST /api/admin/suppliers`)
- Brak self-service onboardingu dla dostawców (wymaga interwencji admina)

**Profil dostawcy:**
- Pola: `name`, `api_url`, `xml_endpoint`, `csv_endpoint`, `api_key`, `status`
- Brak publicznego profilu dostawcy widocznego dla sprzedawców

---

## 6. FUNKCJE SOCIAL COMMERCE

| Funkcja | Status |
|---------|--------|
| Social media linki dla sklepów (FB, IG, TikTok, Twitter) | ✅ GOTOWE – w `stores` tabeli |
| Waluta komunikatów platformy (`announcements`) | ✅ GOTOWE |
| Program polecający (referral codes) | ✅ GOTOWE |
| Affiliate creator system | ✅ GOTOWE |
| Blog (`blog.html`) | ✅ Strona z sekcjami (trending, guides, viral, news) |
| Community feed (posty, lajki, komentarze) | ❌ BRAK – brak tabeli `social_posts` |
| Followers / creator profiles | ❌ BRAK |
| Trending algorithm | ❌ BRAK |
| Viral content / shares | ❌ BRAK |
| Live shopping | ❌ BRAK |
| Video embed (TikTok/YouTube) | ❌ BRAK w aktualnych migracjach |

**Obecny stan Social:** Social commerce ograniczone do linków zewnętrznych (FB/IG) w profilu sklepu i programu polecającego. Brak natywnego community feed, postów, lajków czy komentarzy w systemie.

---

## 7. SYSTEM PŁATNOŚCI

### Integracje płatności

| Metoda | Status |
|--------|--------|
| Przelew tradycyjny | ✅ GOTOWE (bez konfiguracji) |
| BLIK (kod 6-cyfrowy) | ✅ GOTOWE |
| Stripe (card) | ✅ GOTOWE (wymaga STRIPE_SECRET_KEY) |
| Przelewy24 (P24) | ✅ GOTOWE (wymaga P24_MERCHANT_ID) |
| Stripe Checkout Session | ✅ GOTOWE |
| Stripe Webhook | ✅ GOTOWE (weryfikacja `whsec_*`) |
| HMAC-SHA256 webhook | ✅ GOTOWE |
| Refund (status `refunded`) | ✅ GOTOWE |
| Apple Pay / Google Pay | ❌ BRAK |

### Plany subskrypcyjne

| Plan | Cena (PLN/mies.) | Produkty | Prowizja | Czas |
|------|-----------------|----------|----------|------|
| `trial` | 0 (darmowy) | 10 | 15% | 14 dni |
| `basic` | 99 | 100 | 10% | 30 dni |
| `pro` | 199 | 500 | 7% | 30 dni |
| `elite` | 499 | ∞ | 5% | 30 dni |

> Ceny zsynchronizowane: `PLAN_CONFIG` w `subscriptions.js` i `cennik.html` (monthly). Ceny roczne (zniżka): basic=79, pro=159, elite=399 PLN.

### Stripe Subscription Checkout

- `POST /api/subscriptions/:id/checkout` – tworzy Stripe Checkout Session dla planu
- Obsługa webhooków: `checkout.session.completed`, `checkout.session.expired`
- Lazily initialised Stripe SDK (tylko gdy `STRIPE_SECRET_KEY` jest ustawione)

### Mobilny przepływ płatności

- Checkout przez stronę `koszyk.html` → `js/pwa-connect.js`
- Stripe Checkout: redirect do hosted Stripe page (działa na mobile)
- Brak natywnych płatności mobilnych (Apple Pay / Google Pay)

---

## 8. MARKETPLACE CORE

| Funkcja | Status |
|---------|--------|
| Onboarding sprzedawcy (rejestracja + auto-sklep) | ✅ GOTOWE |
| Tworzenie sklepu (`POST /api/stores`) | ✅ GOTOWE |
| Auto-seed 100 produktów centralnych do nowego sklepu | ✅ GOTOWE |
| Subskrypcja trial (14 dni) przy rejestracji | ✅ GOTOWE |
| Subdomena sklepu (DNS stub) | ✅ GOTOWE (middleware + DB) |
| Publikowanie produktów | ✅ GOTOWE |
| Marża sprzedawcy (fixed/percent) | ✅ GOTOWE |
| Minimalna cena (egzekucja `platform_price`) | ✅ GOTOWE |
| Limit produktów per plan | ✅ GOTOWE |
| Koszyk + checkout | ✅ GOTOWE |
| Zamówienia z statusami | ✅ GOTOWE |
| Prowizja platformy (8% domyślnie) | ✅ GOTOWE |
| Seller revenue = total − commission | ✅ GOTOWE |
| Bulk import produktów do sklepu | ✅ GOTOWE |
| Generator sklepu (AI prompt) | ✅ GOTOWE |
| Generator promocji (AI prompt) | ✅ GOTOWE |
| Skrypty storefrontu (JS/CSS per sklep) | ✅ GOTOWE |
| Subdomenowe sklepy (produkcja) | ⚠️ Wymaga DNS wildcard + reverse proxy |
| Email powiadomienia (zamówienia, rejestracja) | ❌ BRAK SMTP skonfigurowane |
| Recenzje produktów | ❌ BRAK |
| Wishlist | ❌ BRAK |

---

## 9. STATUS WDROŻENIA

### Platforma hostingowa

| Komponent | Platforma |
|-----------|-----------|
| Frontend (HTML/JS/CSS) | GitHub Pages |
| Backend API | Docker (Dockerfile + docker-compose.yml) |
| Baza danych | PostgreSQL 16 (Docker container) |
| Domena | `uszefaqualitet.pl` (CNAME na GitHub Pages) |
| CDN | GitHub Pages (globalny CDN) |

### Zmienne środowiskowe (wymagane dla produkcji)

| Zmienna | Opis | Produkcja |
|---------|------|-----------|
| `JWT_SECRET` | Sekret JWT | ⚠️ Zmień z domyślnego! |
| `DB_PASSWORD` | Hasło PostgreSQL | ⚠️ Ustaw silne hasło |
| `ALLOWED_ORIGINS` | Dozwolone domeny CORS | ⚙️ Ustaw domenę prod |
| `STRIPE_SECRET_KEY` | Klucz Stripe API | ⚙️ Klucz live |
| `STRIPE_WEBHOOK_SECRET` | Sekret webhooka Stripe | ⚙️ Z dashboard Stripe |
| `PAYMENT_WEBHOOK_SECRET` | Sekret webhooka P24 | ⚙️ Ustaw |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Konfiguracja emaili | ❌ Nie skonfigurowane |
| `P24_MERCHANT_ID` / `P24_API_KEY` | Przelewy24 | ❌ Opcjonalne |

### Konfiguracja domeny

- Frontend: `uszefaqualitet.pl` → GitHub Pages (przez CNAME)
- Backend: brak skonfigurowanej domeny (`api.uszefaqualitet.pl`)
- SSL: GitHub Pages dostarcza SSL dla frontendu; backend wymaga osobnej konfiguracji (np. nginx + Let's Encrypt)

### Gotowość produkcyjna

| Aspekt | Status |
|--------|--------|
| Frontend – GitHub Pages | ✅ Aktywny |
| Backend Docker image | ✅ Gotowy (Dockerfile) |
| DB migrations runner | ✅ Gotowy (auto-discovery) |
| Health check endpoint | ✅ `/health` |
| Readiness check endpoint | ✅ `/api/readiness` |
| Seed owner account | ✅ `npm run seed:owner` |
| Rate limiting | ✅ Aktywny |
| Helmet.js security headers | ✅ Aktywny |
| CORS konfiguracja | ✅ Przez `ALLOWED_ORIGINS` |
| Backend – hosting | ⚠️ Wymaga VPS/cloud deployment |
| SSL na backend API | ⚠️ Wymaga nginx + certbot |
| Subdomeny sklepów (`*.qualitetmarket.pl`) | ⚠️ Wymaga DNS wildcard |
| Email SMTP | ⚠️ Wymaga konfiguracji Proton Bridge lub SMTP |
| Stripe live keys | ⚠️ Wymaga konta Stripe |

---

## 10. BŁĘDY / BLOKERY

### Krytyczne

| Problem | Opis |
|---------|------|
| Brak wdrożenia backendu | API działa tylko lokalnie (Docker) – brak public URL |
| Brak SMTP | Email powiadomienia (zamówienia, rejestracje) nie działają |
| JWT_SECRET domyślny | W `.env.example` jest `change_this_in_production` – ryzyko przy wdrożeniu bez zmiany |

### Nieukończone moduły

| Moduł | Stan |
|-------|------|
| Community Feed (social_posts) | ❌ Brak implementacji w bieżących migracjach |
| Followers / creator profiles | ❌ Brak |
| Email notifications | ❌ Brak (SMTP_HOST pusty) |
| Self-service onboarding dostawcy | ❌ Wymaga admina |
| Subdomenowe sklepy (prod DNS) | ⚠️ Infrastruktura DB gotowa, brak DNS/proxy |
| Recenzje produktów | ❌ Brak |
| Wishlist | ❌ Brak |
| Powiadomienia PUSH | ❌ Brak |

### Potencjalne problemy

| Problem | Ryzyko |
|---------|--------|
| `requireActiveSubscription` bez store_id jest pass-through | Nieautoryzowany dostęp jeśli store_id nie podane |
| Brak walidacji wejść w niektórych endpointach | Wymaga audytu |
| Tajemny `JWT_SECRET` w domyślnym `docker-compose.yml` (`change_this_in_production`) | Krytyczny jeśli niezmieniony |
| Brak mechanizmu refresh tokenów | Użytkownik logowany co 7 dni |
| Brak systemu emaili – brak weryfikacji email przy rejestracji | Konta bez weryfikacji |

---

## 11. LISTA PRIORYTETÓW – GOTOWOŚĆ NA PIERWSZYCH UŻYTKOWNIKÓW

### 🔴 Krytyczne (blokują uruchomienie)

1. **Wdrożyć backend API** na VPS/cloud (np. DigitalOcean, AWS, Railway.app) z publicznym URL
2. **Skonfigurować nginx + SSL** dla `api.uszefaqualitet.pl`
3. **Zmienić JWT_SECRET** na silny losowy ciąg (min 64 znaki)
4. **Skonfigurować SMTP** (Proton Bridge lub zewnętrzny SMTP) dla emaili transakcyjnych
5. **Uruchomić migracje** (`npm run migrate`) na produkcyjnej bazie danych
6. **Uruchomić seed:owner** (`npm run seed:owner`) – konto właściciela platformy

### 🟡 Ważne (wdrożyć przed pierwszymi sprzedawcami)

7. **Skonfigurować Stripe** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) dla realnych płatności
8. **Ustawić `ALLOWED_ORIGINS`** na `https://uszefaqualitet.pl` (bez `localhost`)
9. **Ustawić `PAYMENT_WEBHOOK_SECRET`** dla P24 webhooków
10. **Email powiadomienia**: potwierdzenie zamówienia, rejestracja sprzedawcy

### 🟢 Usprawnienia (po pierwszym uruchomieniu)

11. **Community Feed** – tabela `social_posts`, posty, lajki, komentarze
12. **Subdomenowe sklepy** – DNS wildcard `*.qualitetmarket.pl` + nginx subdomain routing
13. **Weryfikacja email** przy rejestracji
14. **Recenzje produktów** (reviews/ratings)
15. **PUSH notifications** dla zamówień i aktywności
16. **Self-service onboarding dostawcy** – bez admina
17. **Refresh tokens** (bezpieczniejsza sesja)
18. **Publiczny profil dostawcy** widoczny dla sprzedawców
19. **Mobile deep links** / PWA share targets

---

## 12. BEZPIECZEŃSTWO

### Autentykacja

| Aspekt | Status |
|--------|--------|
| JWT z wygasaniem (7 dni) | ✅ |
| Bcrypt hashowanie haseł | ✅ |
| Rate limiting na endpointach auth | ✅ (20 req/15min) |
| HTTPS enforcement | ⚠️ GitHub Pages (frontend), backend wymaga konfiguracji |
| Weryfikacja email | ❌ BRAK |
| Refresh tokens | ❌ BRAK |
| JWT revocation (blacklist) | ❌ BRAK |

### Bezpieczeństwo płatności

| Aspekt | Status |
|--------|--------|
| HMAC-SHA256 weryfikacja webhooków | ✅ |
| Stripe webhook signature verify | ✅ |
| Klucze Stripe w env (nie w kodzie) | ✅ |
| PCI DSS | ✅ Stripe Checkout (hosted) – nie przechowujemy danych kart |

### Ochrona API

| Aspekt | Status |
|--------|--------|
| Helmet.js security headers | ✅ |
| CORS z whitelist originsów | ✅ |
| Rate limiting (100 req/15min) | ✅ |
| SQL injection ochrona (parametryzowane zapytania) | ✅ |
| Input validation (express-validator) | ✅ |
| Audit log dla operacji admin | ✅ |
| Role-based access control (RBAC) | ✅ |
| Request body limit (1 MB) | ✅ |

### Luki do zamknięcia

- `requireActiveSubscription` bez `store_id` jest pass-through (potencjalny bypass)
- Brak weryfikacji email – możliwość rejestracji z fikcyjnym adresem
- Brak JWT refresh – sesja wygasa nagle po 7 dniach

---

## 13. WYDAJNOŚĆ

### Szybkość ładowania

| Aspekt | Status |
|--------|--------|
| GitHub Pages CDN (statyczne pliki) | ✅ Globalny CDN |
| Indeksy PostgreSQL (005_performance_indexes.sql) | ✅ Zaimplementowane |
| Paginacja API (limit/offset) | ✅ Max 100 wyników per page |
| Limit body request (1 MB) | ✅ |
| Rate limiting (ochrona przed DDoS) | ✅ |
| Gzip compression | ⚠️ Wymaga nginx konfiguracji |
| DB connection pooling | ⚠️ Używa `pg` pool – domyślna konfiguracja |
| API response caching | ❌ BRAK |

### Latencja API

- Brak skonfigurowanego APM (Application Performance Monitoring)
- Brak cache warstwy (Redis / Memcached)
- Snapshoty analityczne (`analytics_snapshots`) mogą być podstawą dla cache metrykowego
- Supplier sync co 12h może powodować load spike – brak throttlingu per supplier

### Optymalizacja bazy danych

| Aspekt | Status |
|--------|--------|
| Indeksy na kluczowych polach | ✅ (005_performance_indexes.sql) |
| UUID jako klucze (gen_random_uuid) | ✅ |
| TIMESTAMP WITH TIME ZONE | ✅ |
| Connection pool (pg) | ✅ Domyślny pool |
| VACUUM / ANALYZE | ⚠️ Wymaga konfiguracji cron na serwerze |
| Read replicas | ❌ BRAK (single DB) |
| DB backup strategy | ❌ BRAK zdefiniowanej strategii |

---

## PODSUMOWANIE EXECUTIVE

### Co jest w 100% gotowe ✅

1. **Backend API** – wszystkie 20+ endpointów działają (auth, users, stores, products, cart, orders, payments, suppliers, admin, affiliate, analytics, referral, scripts)
2. **System produktów** – pełny łańcuch cenowy z tierami marży, auto-przeliczanie
3. **Koszyk i zamówienia** – kompletny checkout flow z prowizją platformy
4. **Płatności** – Stripe, P24, BLIK, przelew + webhook verification
5. **Panel admina** – pełne zarządzanie platformą przez owner/admin
6. **Panel sprzedawcy** – dashboard z produktami, zamówieniami, statystykami
7. **Import hurtowni** – CSV, XML, API auto-sync co 12h
8. **System afiliacyjny** – linki, kliknięcia, konwersje, wypłaty dla twórców
9. **System polecający** – kody QM- auto-generowane, bonus_months, promo tiers
10. **Frontend PWA** – 22 strony, Service Worker, manifest, standalone mode
11. **Migracje DB** – kompletna historia schematu (001–018), auto-discovery runner
12. **Testy** – ~404 testów Jest + supertest (5 356 linii kodu testów)
13. **Bezpieczeństwo** – Helmet, CORS, rate limit, RBAC, HMAC webhooks, SQL params
14. **Readiness check** – `/api/readiness` raportuje status wszystkich subsystemów
15. **Docker** – Dockerfile + docker-compose gotowe do wdrożenia

### Przed wdrożeniem produkcyjnym wymagane ⚠️

1. Wdrożyć backend na serwerze publicznym (VPS + nginx + SSL)
2. Zmienić `JWT_SECRET` na silny sekret
3. Skonfigurować SMTP (emaile transakcyjne)
4. Skonfigurować Stripe live keys
5. Uruchomić `npm run migrate` i `npm run seed:owner`

### Czy platforma jest gotowa na pierwszych sprzedawców?

**TAK – po wykonaniu kroków wdrożeniowych** platforma jest gotowa na pierwszych sprzedawców:

- ✅ Rejestracja i logowanie sprzedawców
- ✅ Auto-tworzenie sklepu z subskrypcją trial (14 dni)
- ✅ Katalog centralny z 200+ produktami
- ✅ Ustawianie własnej marży i publikowanie produktów
- ✅ Klienci mogą kupować (koszyk → zamówienie → płatność)
- ✅ Prowizja platformy automatycznie naliczana
- ✅ Dashboard sprzedawcy ze statystykami
- ✅ System afiliacyjny dla twórców
