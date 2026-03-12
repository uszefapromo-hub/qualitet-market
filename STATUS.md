# STATUS PLATFORMY QUALITET

> Data przeglądu: 2026-03-12

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

---

## 13. Testy — GOTOWE ✅

```
Test Suites: 1 passed
Tests:       239 passed
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
11. **Migracje** – kompletna historia schematu bazy danych
12. **Testy** – 239 testów przechodzi

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
