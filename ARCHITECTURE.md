# Qualitet Platform – Architecture Map

> **Wersja:** 1.0 · **Data:** 2026-03 · **Właściciel:** UszefaQualitet

Dokument stanowi mapę architektury całego systemu Qualitet.
Wszystkie decyzje backendowe, bazodanowe i frontendowe są spójne z opisanym tutaj modelem.

---

## 1. Diagram modułów

```
┌─────────────────────────────────────────────────────────────────────┐
│                       QUALITET PLATFORM                             │
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐   │
│  │  PWA Frontend│     │  Admin Panel │     │  Sklep (Buyer)   │   │
│  │  (HTML/JS)   │     │ owner-panel  │     │  sklep.html      │   │
│  └──────┬───────┘     └──────┬───────┘     └────────┬─────────┘   │
│         │                   │                       │             │
│         │          js/api-client.js (QualitetAPI)   │             │
│         └──────────────────┬──────────────────────┘             │
│                            │                                      │
│                     ┌──────▼──────┐                              │
│                     │  REST API   │                              │
│                     │  (Node.js / │                              │
│                     │   Express)  │                              │
│                     └──────┬──────┘                              │
│                            │                                      │
│         ┌──────────────────┼──────────────────────┐             │
│         ▼                  ▼                      ▼             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │   Auth /    │  │   Business   │  │   Superadmin          │  │
│  │   Users     │  │   Domain     │  │   /api/admin/*        │  │
│  └─────────────┘  └──────┬───────┘  └───────────────────────┘  │
│                          │                                       │
│         ┌────────────────┼────────────────────────────┐         │
│         ▼                ▼                             ▼         │
│  ┌──────────┐   ┌──────────────┐              ┌────────────┐   │
│  │ Products │   │ Stores       │              │ Suppliers  │   │
│  │(Catalogue│   │ shop_products│              │(Hurtownie) │   │
│  │ central) │   │   Orders     │              │ Import/Sync│   │
│  └──────────┘   └──────────────┘              └────────────┘   │
│                                                                  │
│                     ┌──────────────┐                            │
│                     │  PostgreSQL  │                            │
│                     │  Database    │                            │
│                     └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### Warstwy systemu

| Warstwa | Technologia | Opis |
|---|---|---|
| Frontend PWA | HTML5 / Vanilla JS / CSS | Strony klienta, dostępne offline przez Service Worker |
| API Client | `js/api-client.js` (`QualitetAPI`) | Warstwa abstrakcji HTTP – bridge localStorage → API |
| REST API | Node.js + Express | Serwer backendowy, JSON API |
| Baza danych | PostgreSQL | Relacyjna baza z migracjami SQL |
| Auth | JWT (jsonwebtoken) | Bearer token, role: buyer/seller/admin/owner |

---

## 2. Schemat encji (Entity Relationship)

```
users
  id (PK, UUID)
  email (UNIQUE)
  password_hash
  name
  phone
  role: buyer | seller | admin | owner
  plan: trial | basic | pro | elite
  trial_ends_at
  created_at / updated_at

subscriptions
  id (PK, UUID)
  user_id (FK → users)
  plan
  price
  payment_reference
  status: active | cancelled | expired | superseded
  starts_at / ends_at
  created_at / updated_at

suppliers  (hurtownie)
  id (PK, UUID)
  name
  integration_type: api | xml | csv | manual
  api_url / api_key
  margin
  notes
  active (BOOL)
  last_sync_at
  created_at / updated_at

stores
  id (PK, UUID)
  owner_id (FK → users)
  name / slug (UNIQUE) / description
  margin
  plan: basic | pro | elite
  status: active | inactive | suspended
  logo_url
  created_at / updated_at

categories
  id (PK, UUID)
  name / slug (UNIQUE)
  parent_id (FK → categories, self-ref)
  description / icon / sort_order
  active (BOOL)
  created_at

products  ← CENTRALNY KATALOG
  id (PK, UUID)
  store_id (FK → stores, NULLABLE)   ← NULL = produkt centralny
  supplier_id (FK → suppliers)
  category_id (FK → categories)
  name / sku
  price_net / tax_rate / price_gross / selling_price / margin
  description / stock / image_url
  is_central (BOOL)                  ← true = zarządzany przez platform
  created_at / updated_at

product_images
  id (PK, UUID)
  product_id (FK → products)
  url / alt / sort_order
  created_at

shop_products  ← MOST: katalog → sklep
  id (PK, UUID)
  store_id (FK → stores)
  product_id (FK → products)
  price_override (NULLABLE)
  margin_override (NULLABLE)
  active (BOOL)
  sort_order
  UNIQUE (store_id, product_id)
  created_at / updated_at

orders
  id (PK, UUID)
  store_id (FK → stores)
  store_owner_id (FK → users)
  buyer_id (FK → users)
  status: pending | confirmed | shipped | delivered | cancelled
  subtotal / platform_fee / total
  shipping_address / notes
  created_at / updated_at

order_items
  id (PK, UUID)
  order_id (FK → orders)
  product_id (FK → products, nullable)
  name / quantity / unit_price / line_total / margin

carts
  id (PK, UUID)
  user_id (FK → users, NULLABLE for guests)
  store_id (FK → stores)
  session_id (for guest carts)
  status: active | checked_out | abandoned
  created_at / updated_at

cart_items
  id (PK, UUID)
  cart_id (FK → carts)
  product_id (FK → products)
  quantity / unit_price
  UNIQUE (cart_id, product_id)
  created_at / updated_at

payments
  id (PK, UUID)
  order_id (FK → orders)
  user_id (FK → users)
  amount / currency
  method: transfer | card | blik | p24
  status: pending | completed | failed | refunded
  external_ref / paid_at
  created_at / updated_at

audit_logs
  id (PK, UUID)
  user_id (FK → users, NULLABLE)
  action / resource / resource_id
  metadata (JSONB) / ip_address
  created_at
```

---

## 3. Lista endpointów API

Bazowy URL: `/api`

### Auth / Użytkownicy

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| POST | `/users/register` | Rejestracja | – |
| POST | `/users/login` | Logowanie, zwraca JWT | – |
| GET | `/users/me` | Profil zalogowanego | ✓ |
| PUT | `/users/me` | Aktualizacja profilu | ✓ |
| PUT | `/users/me/password` | Zmiana hasła | ✓ |
| GET | `/users/` | Lista użytkowników | owner/admin |

### Sklepy

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/stores/` | Lista sklepów (seller: własne; admin: wszystkie) | ✓ |
| GET | `/stores/:id` | Szczegóły sklepu | ✓ |
| POST | `/stores/` | Utwórz sklep | seller/owner/admin |
| PUT | `/stores/:id` | Edytuj sklep | owner (sklepu) / admin |
| DELETE | `/stores/:id` | Usuń sklep | owner/admin |

### Produkty (katalog centralny + sklepowy)

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/products/` | Lista produktów (filtr: `store_id`, `central=1`, `category`, `search`) | – |
| GET | `/products/:id` | Szczegóły produktu | – |
| POST | `/products/` | Utwórz produkt (bez `store_id` → katalog centralny) | seller/owner/admin |
| PUT | `/products/:id` | Edytuj produkt | owner (sklepu) / admin |
| DELETE | `/products/:id` | Usuń produkt | owner (sklepu) / admin |

### Produkty w sklepie (shop_products)

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/shop-products/?store_id=` | Lista produktów sklepu z cenami | – |
| POST | `/shop-products/` | Dodaj produkt do sklepu | seller/owner/admin |
| PUT | `/shop-products/:id` | Edytuj nadpisanie ceny/marży, aktywność | seller/owner/admin |
| DELETE | `/shop-products/:id` | Usuń produkt ze sklepu | seller/owner/admin |

### Zamówienia

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/orders/` | Lista zamówień (kupujący: własne; sprzedawca: sklep; admin: wszystkie) | ✓ |
| GET | `/orders/:id` | Szczegóły zamówienia z pozycjami | ✓ |
| POST | `/orders/` | Złóż zamówienie | ✓ |
| PATCH | `/orders/:id/status` | Aktualizuj status zamówienia | seller/owner/admin |

### Koszyk

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/cart/?store_id=` | Pobierz aktywny koszyk | ✓ |
| POST | `/cart/items` | Dodaj produkt do koszyka | ✓ |
| PUT | `/cart/items/:productId` | Zmień ilość | ✓ |
| DELETE | `/cart/items/:productId` | Usuń produkt z koszyka | ✓ |
| DELETE | `/cart/` | Wyczyść koszyk | ✓ |

### Subskrypcje

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/subscriptions/` | Lista subskrypcji | ✓ |
| GET | `/subscriptions/active` | Aktywna subskrypcja użytkownika | ✓ |
| POST | `/subscriptions/` | Utwórz / uaktualnij subskrypcję | ✓ |
| DELETE | `/subscriptions/:id` | Anuluj subskrypcję | ✓ / admin |
| PUT | `/subscriptions/:id` | Edytuj subskrypcję | owner/admin |

### Hurtownie (suppliers)

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/suppliers/` | Lista hurtowni | ✓ |
| GET | `/suppliers/:id` | Szczegóły hurtowni | ✓ |
| POST | `/suppliers/` | Dodaj hurtownię | owner/admin |
| PUT | `/suppliers/:id` | Edytuj hurtownię | owner/admin |
| POST | `/suppliers/:id/import` | Importuj produkty (CSV/XML; bez `store_id` → katalog) | seller/owner/admin |
| POST | `/suppliers/:id/sync` | Synchronizuj z API hurtowni | seller/owner/admin |

### Kategorie

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/categories/` | Lista kategorii | – |
| GET | `/categories/:id` | Szczegóły kategorii | – |
| POST | `/categories/` | Dodaj kategorię | owner/admin |
| PUT | `/categories/:id` | Edytuj kategorię | owner/admin |
| DELETE | `/categories/:id` | Usuń kategorię | owner/admin |

### Płatności

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/payments/` | Lista płatności | ✓ |
| GET | `/payments/:id` | Szczegóły płatności | ✓ |
| POST | `/payments/` | Utwórz płatność | ✓ |
| PATCH | `/payments/:id/status` | Aktualizuj status (webhook) | owner/admin |

### Superadmin `/api/admin/*`

| Metoda | Ścieżka | Opis | Auth |
|---|---|---|---|
| GET | `/admin/stats` | Statystyki platformy | owner/admin |
| GET | `/admin/users` | Lista użytkowników (paginated) | owner/admin |
| PATCH | `/admin/users/:id` | Zmień rolę / plan użytkownika | owner/admin |
| GET | `/admin/orders` | Lista zamówień (filtry) | owner/admin |
| GET | `/admin/stores` | Lista sklepów (paginated) | owner/admin |
| PATCH | `/admin/stores/:id` | Zmień status / plan / marżę sklepu | owner/admin |
| GET | `/admin/subscriptions` | Lista subskrypcji (paginated) | owner/admin |
| GET | `/admin/catalogue` | Katalog centralny (paginated, search) | owner/admin |
| GET | `/admin/audit-logs` | Logi audytu (paginated) | owner/admin |

---

## 4. Checklistka wdrożeniowa

### Infrastruktura

- [ ] Serwer VPS lub cloud (min. 2 vCPU, 4 GB RAM)
- [ ] PostgreSQL ≥ 15 z dedykowaną bazą `hurtdetal_qualitet`
- [ ] Node.js ≥ 18 zainstalowany na serwerze
- [ ] Certyfikat SSL/TLS (Let's Encrypt lub dostawca)
- [ ] Reverse proxy (nginx / Caddy) z HTTPS i HTTP/2
- [ ] Zmienne środowiskowe skonfigurowane (`.env` z `.env.example`)

### Baza danych

- [ ] Uruchomienie migracji w kolejności:
  1. `001_initial_schema.sql`
  2. `002_extended_schema.sql`
  3. `003_central_catalog.sql`
- [ ] Utworzenie użytkownika platformy z rolą `owner` przez `POST /api/users/register`
- [ ] Kopia zapasowa (pg_dump) skonfigurowana (min. codziennie)

### Backend

- [ ] `npm install --omit=dev` w katalogu `backend/`
- [ ] `JWT_SECRET` ustawiony na losowy ciąg ≥ 64 znaków
- [ ] `ALLOWED_ORIGINS` ustawione na domenę frontendu
- [ ] `PLATFORM_MARGIN_DEFAULT` ustawione zgodnie z polityką cenową
- [ ] Process manager (PM2 lub systemd) konfiguruje auto-restart
- [ ] Health check `/health` monitorowany przez Uptime Robot / Pingdom

### Frontend PWA

- [ ] `QUALITET_API_URL` ustawione w `index.html` (lub meta tag `api-base-url`)
- [ ] `js/api-client.js` dołączony przed `js/app.js` w stronach wymagających API
- [ ] Service Worker zarejestrowany i cache zaktualizowany po deployu
- [ ] `manifest.json` zaktualizowany (name, icons, start_url)
- [ ] CNAME wskazuje na właściwy serwer (lub GitHub Pages dla frontendu)

### Bezpieczeństwo

- [ ] Rate limiting skonfigurowany (`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`)
- [ ] Helmet headers aktywne (domyślnie włączone)
- [ ] Logowanie nieudanych prób logowania
- [ ] Brak sekretów w repozytorium (`backend/.gitignore` wyklucza `.env`)
- [ ] Walidacja danych wejściowych (express-validator, `validate` middleware)

### Przejście localStorage → API

- [ ] `js/api-client.js` wdrożony i dostępny globalnie jako `window.QualitetAPI`
- [ ] Strony `dashboard.html`, `panel-sklepu.html`, `owner-panel.html` zaktualizowane, by wywoływać `QualitetAPI.auth.me()` przy starcie
- [ ] Koszyk przeniesiony z `localStorage` na `QualitetAPI.cart.*`
- [ ] Produkty pobierane z `QualitetAPI.products.list()` / `QualitetAPI.shopProducts.list()`
- [ ] Zamówienia tworzone przez `QualitetAPI.orders.create()` zamiast `localStorage`
- [ ] Sesja użytkownika zarządzana tokenem JWT (`qualitet_token`) zamiast flagi `app_user_logged`

### Testy i monitoring

- [ ] `cd backend && npm test` – wszystkie testy przechodzą
- [ ] Smoke test API: `GET /health` zwraca `{ status: "ok" }`
- [ ] Smoke test auth: rejestracja → logowanie → `/users/me`
- [ ] Smoke test shop flow: utwórz sklep → dodaj produkt do katalogu → przypisz przez shop_products → złóż zamówienie

---

## 5. Model operatora marketplace

```
Platform (owner/admin)
  │
  ├── Central Product Catalogue (products WHERE is_central = true)
  │     ├── Imported from suppliers via /api/suppliers/:id/import
  │     └── Created directly via POST /api/products (no store_id)
  │
  ├── Stores (1 store per seller)
  │     └── shop_products (bridge)
  │           ├── price_override  – opcjonalna nadpisana cena
  │           └── margin_override – opcjonalna nadpisana marża
  │
  └── Orders
        ├── Assigned to store
        ├── Buyer → Order → Order Items
        └── platform_fee = subtotal × store.margin%
```

Każdy sprzedawca (seller) widzi tylko swój sklep i może:
- Przypisywać produkty z katalogu centralnego do swojego sklepu (`POST /shop-products`)
- Dodawać własne produkty sklepowe (`POST /products` z `store_id`)
- Zarządzać zamówieniami swojego sklepu (`PATCH /orders/:id/status`)

Platforma (owner/admin) może:
- Zarządzać katalogiem centralnym (`/api/admin/catalogue`)
- Zarządzać użytkownikami, sklepami, subskrypcjami (`/api/admin/*`)
- Importować produkty z hurtowni do katalogu centralnego (bez `store_id`)
