# RAPORT PROJEKTU – QUALITET PLATFORM

> Data przeglądu: 2026-03-13 (aktualizacja po stabilizacji MVP)

---

## INFORMACJE O PROJEKCIE

| | |
|---|---|
| **Nazwa repozytorium** | `HurtDetalUszefaQUALITET` |
| **Pełny link do repozytorium** | https://github.com/uszefapromo-hub/HurtDetalUszefaQUALITET |
| **Strona produkcyjna** | https://uszefaqualitet.pl |
| **Architektura** | REST API (Node.js/Express) + PWA frontend (HTML5/Vanilla JS) + Next.js Mobile Web + Expo React Native |
| **Baza danych** | PostgreSQL |

---

## UKOŃCZONE ✅

### Frontend – poprawki krytyczne

| Zmiana | Status |
|---|---|
| JWT refresh: obsługa 401 w `js/api.js` (wyczyszczenie tokena + redirect do login) | ✅ GOTOWE |
| Usunięcie starych zapisów `app_user_logged` / `app_user_email` z `pwa-connect.js` | ✅ GOTOWE |
| Usunięcie niebezpiecznego fallbacku: dostęp bez auth przy braku sieci | ✅ GOTOWE |
| „Otwórz aplikację" – zmiana z modalki na bottom sheet (CSS + animacja slide-up) | ✅ GOTOWE |
| Bottom sheet respektuje dolny obszar bezpieczeństwa (`env(safe-area-inset-bottom)`) | ✅ GOTOWE |
| Bottom sheet nie zasłania dolnej nawigacji (`body.has-bottom-nav`) | ✅ GOTOWE |
| Na desktopie (>640px) modalka pozostaje wycentrowana jak dotychczas | ✅ GOTOWE |

### Migracje bazy danych – poprawki numeracji

| Zmiana | Status |
|---|---|
| `007_subdomain_support.sql` → `007a_subdomain_support.sql` | ✅ ZMIENIONA NAZWA |
| `007_suppliers_import.sql` → `007b_suppliers_import.sql` | ✅ ZMIENIONA NAZWA |
| `009_price_tiers.sql` → `009a_price_tiers.sql` | ✅ ZMIENIONA NAZWA |
| `020_live_commerce.sql` → `020a_live_commerce.sql` | ✅ ZMIENIONA NAZWA |
| Kolejność alfabetyczna zapewniona, brak duplikatów numerów | ✅ GOTOWE |

### Expo React Native (`mobile/`) – nowe ekrany

| Ekran | Plik | Status |
|---|---|---|
| Logowanie / Rejestracja | `mobile/app/login.tsx` | ✅ GOTOWE |
| Koszyk | `mobile/app/cart.tsx` | ✅ GOTOWE |
| Kasa / Checkout (3 kroki: Dostawa, Płatność, Przegląd) | `mobile/app/checkout.tsx` | ✅ GOTOWE |
| Moje zamówienia | `mobile/app/orders.tsx` | ✅ GOTOWE |
| Nawigacja dolna: dodano zakładkę Koszyk, Polskie etykiety | `mobile/app/_layout.tsx` | ✅ GOTOWE |

### Expo React Native – poprawki homepage

| Zmiana | Status |
|---|---|
| Nagłówek hero po polsku: „Odkryj Niesamowite Produkty" | ✅ GOTOWE |
| Przycisk „Otwórz aplikację" otwiera bottom sheet (Modal) | ✅ GOTOWE |
| Bottom sheet nie zasłania dolnej nawigacji | ✅ GOTOWE |
| Przycisk zamknięcia w bottom sheet | ✅ GOTOWE |
| Dolny obszar bezpieczeństwa (`useSafeAreaInsets`) | ✅ GOTOWE |
| Polskie etykiety: „NA ŻYWO", „Teraz popularne", „Na żywo" | ✅ GOTOWE |



---

## CO JUŻ JEST ZROBIONE ✅

### Backend API (Node.js / Express)

| Moduł | Endpointy | Status |
|---|---|---|
| **Auth** | POST /register, POST /login, GET /me, PUT /me | ✅ GOTOWE |
| **Users** | GET /, GET /me, PUT /me, PUT /me/password | ✅ GOTOWE |
| **Stores** | CRUD + lista sklepów, subdomeny | ✅ GOTOWE |
| **Products** | CRUD + katalog centralny, tiery cen | ✅ GOTOWE |
| **Shop Products** | Produkty w sklepie, marże, ceny sprzedaży | ✅ GOTOWE |
| **Cart** | Koszyk (dodawanie, edycja, usuwanie produktów) | ✅ GOTOWE |
| **Orders** | Tworzenie zamówień, statusy, order_items | ✅ GOTOWE |
| **Payments** | Stripe, Przelewy24, BLIK, przelew, webhook HMAC | ✅ GOTOWE |
| **Suppliers** | Hurtownie, import CSV/XML/API, auto-sync co 12h | ✅ GOTOWE |
| **Admin** | Dashboard, użytkownicy, sklepy, produkty, zamówienia, import, audit-log, ustawienia | ✅ GOTOWE |
| **Seller (my/)** | Dashboard sprzedawcy, produkty, zamówienia, statystyki | ✅ GOTOWE |
| **Subscriptions** | Plany trial/basic/pro/elite, limity produktów | ✅ GOTOWE |
| **Categories** | Kategorie produktów | ✅ GOTOWE |
| **Referral (promo)** | Kody QM-, system polecający, bonus_months, tiers 0-3 | ✅ GOTOWE |
| **Affiliate** | Program partnerski, linki, prowizje, wypłaty | ✅ GOTOWE |
| **AI Module** | Chat, opisy produktów/sklepów, generate-store, marketing-pack | ✅ GOTOWE |
| **Social Commerce** | Feed, posty, polubienia, komentarze, udostępnienia | ✅ GOTOWE |
| **Live Commerce** | Streamy, wiadomości, przypięte produkty, zamówienia live | ✅ GOTOWE |
| **Gamification** | Punkty, odznaki, leaderboard, poziomy | ✅ GOTOWE |
| **Collaboration** | Zaproszenia do sklepu, role (owner/manager/creator/marketer), revenue_shares | ✅ GOTOWE |
| **Creator Referrals** | System polecania twórców, prowizje 2%, anty-abuse | ✅ GOTOWE |
| **Analytics** | Snapshots, eventy, trendy produktów | ✅ GOTOWE |
| **Notifications** | Powiadomienia (GET/PATCH) | ✅ GOTOWE |
| **User Profiles** | Profile publiczne użytkowników | ✅ GOTOWE |

### System cenowy

- ✅ Łańcuch: `supplier_price → platform_price (tiery) → selling_price (marża sprzedawcy)`
- ✅ `computePlatformPrice()` – automatyczne przeliczanie przy tworzeniu/aktualizacji produktu
- ✅ Admin konfiguruje tiery marży przez `PUT /api/admin/platform-margins`
- ✅ Domyślne tiery: ≤20 zł: 60%, ≤100 zł: 40%, ≤300 zł: 25%, >300 zł: 15%
- ✅ Egzekucja minimalnej ceny (`min_selling_price = platform_price`)

### Baza danych (PostgreSQL)

- ✅ 23+ migracji SQL (`001` – `023`) pokrywających pełną historię schematu
- ✅ Tabele: users, stores, products, shop_products, orders, order_items, payments, carts, suppliers, subscriptions, categories, referral_codes, referral_uses, affiliate_creators, creator_referrals, social_posts, live_streams, gamification, store_collaborators, revenue_shares, notifications, user_profiles, analytics_events, audit_logs i wiele innych

### PWA Frontend (HTML5 / Vanilla JS)

- ✅ `js/api.js` – pełny klient REST API (`window.QMApi`) – Auth, Products, Cart, Orders, Admin, Social, Live, AI, Creator, Gamification, Collaboration
- ✅ `js/pwa-connect.js` – mostek frontend → backend (login, rejestracja, checkout)
- ✅ `js/flow.js` – koordynator przepływów stron
- ✅ `js/api-client.js` – shim kompatybilności `QualitetAPI → QMApi`
- ✅ Service Worker (`service-worker.js`) – tryb offline/PWA
- ✅ Strony HTML: `login.html`, `dashboard.html`, `sklep.html`, `koszyk.html`, `panel-sklepu.html`, `owner-panel.html`, `listing.html`, `generator-sklepu.html`, `affiliate.html`, `live.html`, `intelligence.html`, `zarabiaj.html`, `hurtownie.html`, `brand.html`, `cennik.html`, `crm.html`, `qualitetverse.html`, `qualitetmarket.html`

### Next.js Frontend (`frontend/`)

- ✅ Aplikacja Next.js 15 z App Router, Tailwind CSS, Radix UI, Framer Motion
- ✅ Strony: `/` (landing), `/stores`, `/product`, `/profile`, `/ai`, `/admin`, `/seller`, `/creator`, `/trending`, `/cart`, `/checkout`
- ✅ Glassmorphism UI z design systemem QualitetVerse (deep space + purple/cyan)
- ✅ Komponenty: StoreCard, ProductCard, GlassCard, StatCard, LoadingSkeleton

### Expo React Native (`mobile/`)

- ✅ Aplikacja Expo + React Native z expo-router
- ✅ Ekrany: Home (index), Stores, Creator, Profile, Trending
- ✅ Klient API (`mobile/lib/api.ts`) do backendu
- ✅ Komponenty: GlassCard, ProductCard, StatCard
- ✅ Motyw kolorystyczny QualitetVerse

### Testy

- ✅ **540 testów** w `backend/tests/api.test.js` (Jest + supertest)
- ✅ Pokrycie: auth, users, stores, products, cart, orders, payments, admin, seller, referral, affiliate, AI, social, live, gamification, collaboration, creator referrals

---

## CO JEST W TRAKCIE 🔄

### Frontend Next.js – podłączenie do API

- 🔄 Strony `stores`, `cart`, `checkout`, `ai` używają jeszcze **mock danych** zamiast prawdziwego API backendu
- 🔄 Brak warstwy autoryzacji (JWT) w Next.js – strony nie są chronione dla zalogowanych użytkowników
- 🔄 Strona `/checkout` – formularz płatności jest UI-only, nie wywołuje `/api/payments`

### Mobile (Expo) – podłączenie do API

- 🔄 Ekran `stores` używa **hardcoded danych** (`STORES = [...]`) zamiast `api.stores.list()`
- 🔄 Brak obsługi logowania/rejestracji przez UI w apce mobilnej
- 🔄 Brak obsługi koszyka i zamówień w apce mobilnej

### CRM i Zadania

- 🔄 `crm.html` i `tasks.html` – strony istnieją, ale integracja z backendem nie jest potwierdzona
- 🔄 `tasks/` katalog zawiera tylko `index.html`

---

## CZEGO JESZCZE BRAKUJE ❌

### Frontend

1. ❌ **Email notifications** – brak wysyłki emaili (potwierdzenia zamówień, rejestracji, reset hasła)
2. ❌ **Reset hasła** – brak endpointu i UI `forgot password / reset password`
3. ❌ **Subdomenowe sklepy** – infrastruktura DNS/reverse proxy dla `*.qualitetmarket.pl`
4. ❌ **Paginacja w UI** – listy produktów/zamówień nie mają pełnej paginacji po stronie frontendu

### Mobile

1. ❌ **Autentykacja** – brak ekranu logowania/rejestracji w apce mobilnej
2. ❌ **Koszyk i zamówienia** – brak flow zakupowego w Expo
3. ❌ **Push Notifications** – brak systemu powiadomień push (np. expo-notifications)
4. ❌ **Głęboka integracja z API** – większość ekranów mobilnych używa mock danych

### Backend

1. ❌ **Reset hasła / weryfikacja email** – brak obsługi tokenów reset password
2. ❌ **Testy dla modułu collaboration** – testy częściowe
3. ❌ **Webhooks przychodzące od hurtowni** – brak obsługi webhooków od dostawców

---

## BŁĘDY DO NAPRAWY 🐛

### Frontend (PWA + Next.js)

| # | Opis | Plik | Priorytet |
|---|---|---|---|
| F-1 | Strony `stores`, `cart`, `checkout`, `ai` w `frontend/` używają mock danych – nie pobierają z API | `frontend/src/app/stores/page.tsx`, `cart/page.tsx`, `checkout/page.tsx`, `ai/page.tsx` | Wysoki |
| F-2 | Brak ochrony tras (auth guard) w Next.js – każdy może wejść na `/admin`, `/seller` bez JWT | `frontend/src/app/admin/`, `seller/`, `creator/` | Wysoki |
| F-3 | `mobile/app/stores.tsx` używa hardcoded `STORES = [...]` zamiast `api.stores.list()` | `mobile/app/stores.tsx` | Średni |

### Backend

| # | Opis | Plik | Priorytet |
|---|---|---|---|
| B-1 | `mobile/lib/api.ts` ma hardcoded `API_BASE = 'http://localhost:5000/api'` – nie działa na urządzeniu | `mobile/lib/api.ts` | Wysoki |
| B-2 | Duplikat numerów migracji: `003_product_status.sql` i `003a_central_catalog.sql` i `007_subdomain_support.sql` i `007_stores_subdomain.sql` – ryzyko kolizji przy migrate | `backend/migrations/` | Średni |
| B-3 | `STRIPE_SECRET_KEY` i `P24_MERCHANT_ID` niezdefiniowane w środowisku produkcyjnym – płatności działają w sandbox | `.env` (konfiguracja) | Niski (wymaga konfiguracji) |

### Mobile (Expo)

| # | Opis | Plik | Priorytet |
|---|---|---|---|
| M-1 | Hardcoded URL API (`localhost:5000`) nie działa na fizycznym urządzeniu ani w trybie produkcyjnym | `mobile/lib/api.ts:1` | Wysoki |
| M-2 | Brak obsługi błędów sieciowych w ekranach – crash przy braku połączenia | `mobile/app/*.tsx` | Średni |
| M-3 | Brak ekranu ładowania/splash screen po starcie aplikacji | `mobile/app/_layout.tsx` | Niski |

---

## NASTĘPNE ZADANIA 📋

### Priorytet KRYTYCZNY (przed produkcją)

1. **Podłączyć Next.js frontend do backendu** – zastąpić mock dane prawdziwymi wywołaniami API w `/stores`, `/cart`, `/checkout`, `/ai`
2. **Dodać auth guard w Next.js** – middleware chroniący trasy `/admin`, `/seller`, `/creator`
3. **Skonfigurować URL API w Expo** – użyć zmiennej środowiskowej zamiast `localhost:5000`
4. **Ustawić `.env` produkcyjny** – `JWT_SECRET`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`, `P24_MERCHANT_ID`, `ALLOWED_ORIGINS`

### Priorytet WYSOKI

5. **System powiadomień email** – wdrożyć nodemailer/SendGrid dla potwierdzeń zamówień, rejestracji
6. **Reset hasła** – endpoint `POST /api/auth/reset-password` + UI
7. **Pełna integracja Expo z API** – ekran logowania, koszyk, zamówienia w apce mobilnej
8. **Push notifications w Expo** – expo-notifications + powiązanie z systemem powiadomień backendu

### Priorytet ŚREDNI

9. **Subdomenowe sklepy** – konfiguracja reverse proxy (nginx/Vercel) dla `*.qualitetmarket.pl`
10. **Naprawić duplikaty migracji** – ujednolicić numerację (`007a`, `007b` lub scalić)
11. **CRM i Tasks** – podłączyć `crm.html` i `tasks.html` do backendu
12. **Testy E2E** – dodać testy end-to-end dla flow zakupowego (np. Playwright)

### Priorytet NISKI

13. **Panel admina UI** – dopracować dedykowane panele w `owner-panel.html` i `operator-panel.html`
14. **Dokumentacja API** – wygenerować Swagger/OpenAPI dla wszystkich endpointów
15. **App Store / Google Play** – przygotować Expo build do publikacji

---

# STATUS PLATFORMY QUALITET (szczegóły techniczne)

> Data przeglądu: 2026-03-13

---

## 1. Backend API — GOTOWE ✅

Wszystkie endpointy zaimplementowane i działają:

| Endpoint | Metody | Status |
|---|---|---|
| `/api/auth` | POST /register, POST /login, GET /me, PUT /me | GOTOWE |
| `/api/users` | GET /, GET /me, PUT /me, PUT /me/password, POST /register, POST /login | GOTOWE |
| `/api/stores` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id | GOTOWE |
| `/api/products` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id | GOTOWE |
| `/api/shop-products` | GET /, POST /, PUT /:id, DELETE /:id | GOTOWE |
| `/api/cart` | GET /, POST /, POST /items, PUT /items/:id, DELETE /, DELETE /items/:id, DELETE /items/:itemId | GOTOWE |
| `/api/orders` | GET /, GET /:id, POST /, PATCH /:id/status | GOTOWE |
| `/api/payments` | GET /, GET /:id, POST /, PUT /:id/status, POST /webhook, POST /:orderId/initiate | GOTOWE |
| `/api/suppliers` | GET /, GET /:id, POST /, PUT /:id, DELETE /:id, POST /:id/sync | GOTOWE |
| `/api/admin` | Dashboard, users, stores, products, suppliers, orders, subscriptions, audit-logs, settings, import | GOTOWE |
| `/api/my` | GET /store, GET /store/stats, GET /store/orders, PATCH /store, GET /store/products, POST /store/products, PATCH /store/products/:id, DELETE /store/products/:id | GOTOWE |
| `/api/subscriptions` | POST /, GET /my | GOTOWE |
| `/api/categories` | GET /, POST /, DELETE /:id | GOTOWE |

---

## 2. Frontend PWA — GOTOWE ✅

- `js/api.js` – pełny klient REST API (`window.QMApi`) z obsługą Auth, Products, Cart, Orders, Admin
- `js/pwa-connect.js` – mostek frontend → backend: login/rejestracja, produkty, checkout, dashboard
- `js/flow.js` – koordynator przepływów: login, dashboard, sklep, koszyk, listing, panel-sklepu, owner-panel
- `js/api-client.js` – kompatybilny shim delegujący do `window.QMApi`
- Strony HTML: `login.html`, `dashboard.html`, `sklep.html`, `koszyk.html`, `panel-sklepu.html`, `owner-panel.html`, `listing.html`, `generator-sklepu.html`

Frontend nie używa już localStorage do API calls – połączony z backendem przez QMApi.

---

## 3. System produktów — GOTOWE ✅

Tabela `products` zawiera wszystkie wymagane pola:

| Pole | Opis | Status |
|---|---|---|
| `supplier_price` | Cena hurtownika (brutto) | GOTOWE |
| `platform_price` | Cena platformy (wyliczona z marży tierowej) | GOTOWE |
| `min_selling_price` | Minimalna cena sprzedaży (= platform_price) | GOTOWE |
| `price_net` | Cena netto | GOTOWE |
| `price_gross` | Cena brutto | GOTOWE |
| `selling_price` | Cena sprzedaży bazowa | GOTOWE |
| `margin` | Marża | GOTOWE |

**Naprawione w tej wersji:** `POST /api/products` oraz `PUT /api/products/:id` teraz automatycznie wyliczają i zapisują `supplier_price`, `platform_price`, `min_selling_price` przy tworzeniu/aktualizacji produktu.

---

## 4. System sklepów — GOTOWE ✅

| Funkcja | Status |
|---|---|
| Tworzenie sklepu (`POST /api/stores`) | GOTOWE |
| Auto-seed 100 produktów centralnych do nowego sklepu | GOTOWE |
| Dodawanie produktów do sklepu (`POST /api/shop-products`) | GOTOWE |
| Tabela `shop_products` z pełnymi polami | GOTOWE |
| `seller_margin` – marża sprzedawcy | GOTOWE |
| `selling_price` – obliczona cena sprzedaży | GOTOWE |
| `price_override` – nadpisanie ceny przez sprzedawcę | GOTOWE |
| Egzekucja minimalnej ceny platformy | GOTOWE |

---

## 5. System cen i marż — GOTOWE ✅

Łańcuch cenowy:

```
supplier_price → [marża tiery platformy] → platform_price = min_selling_price
                                            → [marża sprzedawcy]  → selling_price (sklepu)
```

| Komponent | Status |
|---|---|
| `computePlatformPrice()` w `backend/src/helpers/pricing.js` | GOTOWE |
| Tiery marży (konfigurowane przez admina) | GOTOWE |
| Domyślne tiery (≤20 zł: 60%, ≤100 zł: 40%, ≤300 zł: 25%, >300 zł: 15%) | GOTOWE |
| Admin może modyfikować tiery: `PUT /api/admin/platform-margins` | GOTOWE |
| Automatyczne przeliczenie platform_price przy tworzeniu produktu | GOTOWE |
| Automatyczne przeliczenie platform_price przy aktualizacji ceny produktu | GOTOWE |

---

## 6. Import produktów z hurtowni — GOTOWE ✅

| Format | Endpoint | Status |
|---|---|---|
| CSV | `POST /api/admin/products/import` | GOTOWE |
| XML | `POST /api/admin/products/import` | GOTOWE |
| API (fetch URL) | `POST /api/admin/suppliers/import` | GOTOWE |
| Sync hurtowni | `POST /api/admin/suppliers/sync` | GOTOWE |
| Auto-sync co 12 godzin | `app.js` scheduler | GOTOWE |

Import upsertuje produkty do katalogu centralnego (`is_central=true, store_id=NULL`) z wyliczonym `platform_price`.

---

## 7. Zamówienia — GOTOWE ✅

| Funkcja | Status |
|---|---|
| Koszyk (`/api/cart`) | GOTOWE |
| Tworzenie zamówienia (`POST /api/orders`) | GOTOWE |
| Tabela `order_items` | GOTOWE |
| Statusy zamówień: created, pending, paid, processing, confirmed, shipped, delivered, cancelled | GOTOWE |
| Zmiana statusu (`PATCH /api/orders/:id/status`) | GOTOWE |
| Obsługa produktów z katalogu centralnego (`store_id IS NULL`) | GOTOWE |

---

## 8. Płatności — GOTOWE ✅

| Funkcja | Status |
|---|---|
| Zapis w tabeli `payments` | GOTOWE |
| Stripe – inicjowanie płatności | GOTOWE |
| Przelewy24 (P24) – inicjowanie płatności | GOTOWE |
| BLIK – obsługa kodu | GOTOWE |
| Przelew tradycyjny | GOTOWE |
| Webhook (`POST /api/payments/webhook`) z HMAC-SHA256 | GOTOWE |
| Aktualizacja statusu zamówienia po płatności | GOTOWE |
| Zwroty (`refunded`) | GOTOWE |

**Uwaga:** Bramki zewnętrzne (Stripe/P24) wymagają konfiguracji `STRIPE_SECRET_KEY` i `P24_MERCHANT_ID` w `.env`. Bez tych zmiennych działają w trybie sandbox (bez realnych transakcji).

---

## 9. Prowizja platformy — GOTOWE ✅

| Komponent | Status |
|---|---|
| `commission_rate` (konfigurowalne przez admina) | GOTOWE |
| `platform_commission` (wyliczana przy każdym zamówieniu) | GOTOWE |
| `seller_revenue` = order_total − platform_commission | GOTOWE |
| Domyślna prowizja: 8% | GOTOWE |
| Zmiana prowizji: `PATCH /api/admin/settings` | GOTOWE |

---

## 10. Panel admin — GOTOWE ✅

Admin (`role: 'owner'` lub `'admin'`) ma dostęp do:

| Funkcja | Status |
|---|---|
| Zarządzanie użytkownikami (lista, edycja roli/planu, usuwanie) | GOTOWE |
| Zarządzanie sklepami (lista, zmiana statusu, blokowanie) | GOTOWE |
| Zarządzanie produktami (lista, edycja, platform_price, import) | GOTOWE |
| Zarządzanie hurtowniami (lista, dodawanie, sync, import) | GOTOWE |
| Zarządzanie zamówieniami (lista, zmiana statusu) | GOTOWE |
| Zarządzanie subskrypcjami (lista, edycja planu) | GOTOWE |
| Dashboard ze statystykami platformy | GOTOWE |
| Audit logs | GOTOWE |
| Ustawienia prowizji (`commission_rate`) | GOTOWE |
| Konfiguracja tierów marży (`platform_margin_config`) | GOTOWE |
| Import produktów CSV/XML do katalogu centralnego | GOTOWE |

---

## 11. Panel sprzedawcy — GOTOWE ✅

Seller ma dostęp przez `/api/my/...`:

| Funkcja | Status |
|---|---|
| Produkty sklepu (lista z `platform_price`, `min_selling_price`, `supplier_price`) | GOTOWE |
| Dodawanie/edycja produktów z marżą sprzedawcy | GOTOWE |
| Egzekucja minimalnej ceny (nie można sprzedać poniżej `platform_price`) | GOTOWE |
| Zamówienia sklepu | GOTOWE |
| Statystyki sklepu (przychód, prowizja, liczba zamówień) | GOTOWE |
| Ustawienia sklepu (nazwa, opis, logo, marża) | GOTOWE |
| Kontrola limitu produktów (subscription) | GOTOWE |

---

## 12. Migracje bazy danych — GOTOWE ✅

| Plik migracji | Zawartość |
|---|---|
| `001_initial_schema.sql` | users, subscriptions, suppliers, stores, products, orders, order_items |
| `002_extended_schema.sql` | categories, product_images, shop_products, carts, cart_items, payments, audit_logs |
| `003_product_status.sql` | Pole status w products |
| `003a_central_catalog.sql` | Katalog centralny (is_central, store_id=NULL) |
| `004_central_catalog.sql` | Rozszerzenie katalogu centralnego |
| `005_performance_indexes.sql` | Indeksy wydajnościowe |
| `006_subscription_marketplace.sql` | Subskrypcje per-sklep (shop_id) |
| `007_subdomain_support.sql` | Subdomeny sklepów |
| `007_stores_subdomain.sql` | Pole subdomain w stores |
| `007_suppliers_import.sql` | Pola import w suppliers (xml_endpoint, csv_endpoint) |
| `008_bigbuy_seed.sql` | Seed danych BigBuy |
| `009_platform_price.sql` | Pole platform_price w products |
| `009_price_tiers.sql` | Pola supplier_price, min_selling_price, seller_margin, tiery marży |
| `010_payments_provider.sql` | Pole payment_provider w payments |
| `011_platform_commission.sql` | Tabela platform_settings, prowizja platformy |
| `012_initial_products_seed.sql` | Seed 200+ produktów do katalogu centralnego |
| `013_owner_phone.sql` | Pole phone w users |
| `014_referral_analytics_scripts.sql` | Tabele referral_codes (discount), referral_uses, scripts, analytics_snapshots |
| `015_referral_promo.sql` | Kolumny promo systemu: user_id w referral_codes; referral_code_id / referrer_id / new_user_id / bonus_months w referral_uses; referred_by_code w users |

---

## 13. Testy — GOTOWE ✅

```
Test Suites: 1 passed
Tests:       319 passed
```

Pokrycie testami obejmuje wszystkie kluczowe endpointy:
- Auth (register, login, profil)
- Users, Stores, Products, Shop products
- Cart, Orders, Payments (Stripe, P24, webhook)
- Admin (dashboard, users, stores, products, suppliers, subscriptions, audit-logs, settings, import)
- Seller dashboard (my/store, products, orders, stats)
- System cen i marż (platform_price, min_selling_price, seller_margin)
- Prowizja platformy (commission_rate, seller_revenue)
- Subskrypcje i limity produktów
- System polecający promo (referral/my, referral/admin, promo tiers, ensureReferralCode)
- Analytics i scripts

---

## Podsumowanie

### Co jest w 100% gotowe

1. **Backend API** – wszystkie endpointy działają: auth, users, stores, products, shop_products, cart, orders, payments, suppliers, admin
2. **System produktów** – pełny łańcuch cenowy: `supplier_price → platform_price → selling_price` z automatycznym przeliczaniem tierów marży
3. **System sklepów** – tworzenie, zarządzanie, auto-seed produktów, marże sprzedawców
4. **Zamówienia** – koszyk, tworzenie, order_items, statusy, komisja platformy
5. **Płatności** – Stripe, P24, BLIK, webhook z HMAC, automatyczna aktualizacja statusu zamówień
6. **Prowizja platformy** – commission_rate konfigurowalne, platform_commission i seller_revenue obliczane przy każdym zamówieniu
7. **Panel admin** – pełne zarządzanie platformą
8. **Panel sprzedawcy** – dashboard z produktami, zamówieniami, statystykami
9. **Import z hurtowni** – CSV, XML, API, auto-sync co 12h
10. **Frontend PWA** – podłączony do backend API przez QMApi
11. **Migracje** – kompletna historia schematu bazy danych (001–015)
12. **Testy** – 319 testów przechodzi
13. **System polecający promo** – `ensureReferralCode` auto-tworzy kod QM- dla każdego sprzedawcy przy rejestracji; schemat DB rozszerzony (migacja 015) o user_id / referral_code_id / referrer_id / new_user_id / bonus_months

### Co jeszcze warto poprawić (opcjonalne usprawnienia)

1. **Konfiguracja bramek płatności** – wymaga ustawienia `STRIPE_SECRET_KEY` i/lub `P24_MERCHANT_ID` w `.env` dla realnych transakcji
2. **Email notifications** – brak systemu powiadomień email (do zamówień, rejestracji itp.)
3. **Subdomenowe sklepy** – infrastruktura DNS/reverse proxy do obsługi subdomen `*.qualitetmarket.pl`
4. **Panele administracyjne UI** – backend jest gotowy, ale dedykowane UI panele mogą wymagać dopracowania

### Czy platforma jest gotowa na pierwszych sprzedawców?

**TAK** – platforma jest gotowa na pierwszych sprzedawców. Wszystkie krytyczne komponenty działają:

- ✅ Rejestracja i logowanie sprzedawców
- ✅ Auto-tworzenie sklepu z subskrypcją trial (14 dni)
- ✅ Katalog centralny z produktami gotowy do użycia
- ✅ Sprzedawca może ustawić własną marżę i publikować produkty
- ✅ Klienci mogą przeglądać produkty, dodawać do koszyka i składać zamówienia
- ✅ System płatności (przynajmniej przelew tradycyjny bez konfiguracji zewnętrznej)
- ✅ Prowizja platformy automatycznie naliczana
- ✅ Dashboard sprzedawcy z podstawowymi statystykami

Przed wdrożeniem produkcyjnym należy skonfigurować:
- `JWT_SECRET` – silny sekret JWT
- `DB_PASSWORD` – hasło bazy danych
- `PAYMENT_WEBHOOK_SECRET` – sekret dla webhooków płatności
- `STRIPE_SECRET_KEY` lub `P24_MERCHANT_ID` – dla realnych płatności
- `ALLOWED_ORIGINS` – dozwolone domeny CORS

---

## RAPORT PLANOWANIA – BIEŻĄCY STATUS MVP

### UKOŃCZONE ✅

- Backend API – wszystkie endpointy (auth, products, stores, cart, orders, payments, admin, seller)
- System cen – łańcuch supplier_price → platform_price → selling_price
- PWA frontend – podłączony do backend przez QMApi
- JWT auth – obsługa 401, automatyczny redirect do logowania po wygaśnięciu tokena
- Usunięto insecure auth fallback w pwa-connect.js
- Migracje DB – uporządkowana numeracja bez duplikatów (007, 009, 020 rozwiązane)
- Expo Mobile – ekrany: Home (PL), Logowanie, Koszyk, Checkout, Zamówienia
- Bottom sheet „Otwórz aplikację" – slide-up, nie zasłania dolnej nawigacji, safe area
- Service Worker / PWA offline mode

### W TOKU 🔄

- Next.js frontend (`frontend/`) – podłączenie do backend API (strony istnieją, brak rzeczywistych danych)
- Next.js auth flow – brak połączenia z `QMApi`
- Expo Mobile – ekrany Creator, Trending, Stores używają danych mockowanych (nie z API)

### BRAKUJE ❌

- Wdrożenie produkcyjne – konfiguracja env: `JWT_SECRET`, `DB_PASSWORD`, `STRIPE_SECRET_KEY`, `ALLOWED_ORIGINS`
- Email notifications (potwierdzenie zamówienia, rejestracja)
- Subdomenowe sklepy – infrastruktura DNS/reverse proxy dla `*.qualitetmarket.pl`
- Testy e2e (Playwright/Cypress) dla krytycznych przepływów
- Testy mobilne (Detox) dla Expo

### BŁĘDY DO NAPRAWIENIA 🐛

- Next.js `frontend/` – brak podłączenia API (wszystkie dane mockowane)
- Expo Mobile – Creator/Trending/Stores nie pobierają danych z API
- Brak obsługi refresh tokenu (JWT wygasa, wymaga ponownego logowania)

### NASTĘPNE ZADANIA 📋

1. Podłączyć Next.js do backend API (`API_BASE_URL`, auth context)
2. Podłączyć Expo do real API (zastąpić mock data w index.tsx, stores.tsx, trending.tsx)
3. Dodać JWT refresh token endpoint w backend + obsługę w frontend
4. Skonfigurować środowisko produkcyjne (env, CORS, SSL)
5. Wdrożyć email notifications (nodemailer lub zewnętrzny provider)
