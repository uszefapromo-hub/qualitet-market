# HurtDetalUszefaQUALITET – Backend API

Node.js / Express REST API z bazą danych PostgreSQL dla platformy HurtDetalUszefaQUALITET.

Architektura: **marketplace operatora** – centralny katalog produktów, sklepy użytkowników dodają produkty przez `shop_products`, klient kupuje od sklepu użytkownika.

---

## Diagram modułów

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PLATFORMA QUALITET                                   │
│                                                                             │
│  ┌────────────────┐    ┌──────────────────┐    ┌──────────────────────┐    │
│  │  PWA Frontend  │    │   Superadmin     │    │   Panel Sprzedawcy   │    │
│  │  (GitHub Pages)│    │  owner-panel.html│    │  panel-sklepu.html  │    │
│  └───────┬────────┘    └────────┬─────────┘    └──────────┬───────────┘    │
│          │                      │                          │                │
│          └──────────────────────┼──────────────────────────┘                │
│                                 │ js/api.js (QMApi)                         │
│                                 ▼                                           │
│                      ┌──────────────────┐                                  │
│                      │  Express API     │  port 3000                       │
│                      │  backend/src/    │                                  │
│                      └──────┬───────────┘                                  │
│                             │                                               │
│          ┌──────────────────┼────────────────────────────┐                 │
│          ▼                  ▼                             ▼                 │
│  ┌──────────────┐  ┌────────────────┐           ┌─────────────────┐       │
│  │  /api/users  │  │ /api/products  │           │  /api/admin     │       │
│  │  /api/auth   │  │ (katalog centr.)│          │  /api/stores    │       │
│  └──────────────┘  └────────────────┘           └─────────────────┘       │
│                             │                                               │
│                    ┌────────┴──────────┐                                   │
│                    ▼                   ▼                                    │
│           ┌─────────────────┐  ┌─────────────────┐                        │
│           │ /api/shop-prod. │  │  /api/orders    │                        │
│           │ (sklep→katalog) │  │  /api/cart      │                        │
│           └─────────────────┘  └─────────────────┘                        │
│                                                                             │
│                      ┌──────────────────┐                                  │
│                      │   PostgreSQL 14+ │                                  │
│                      └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Schemat encji (ERD)

```
users
  id (PK), email, password_hash, name, phone
  role: buyer | seller | admin | owner
  plan: trial | basic | pro | elite
  trial_ends_at, created_at, updated_at

stores
  id (PK), owner_id (FK→users), name, slug (UNIQUE)
  description, margin, plan, status: active|inactive|suspended|pending
  logo_url, created_at, updated_at

products  ◄── centralny katalog (is_central=true, store_id=NULL)
             lub produkt sprzedawcy (store_id NOT NULL)
  id (PK), store_id (FK→stores, NULL dozwolone), is_central (BOOL)
  supplier_id (FK→suppliers), name, sku
  price_net, tax_rate, price_gross, selling_price, margin
  category, category_id (FK→categories), description
  stock, image_url
  status: draft | pending | active | archived
  created_at, updated_at

shop_products  ◄── mostek sklep → produkt (marketplace)
  id (PK), store_id (FK→stores), product_id (FK→products)
  price_override, margin_override, margin_type: percent|fixed
  custom_title, custom_description
  active, sort_order, created_at, updated_at
  UNIQUE (store_id, product_id)

orders
  id (PK), store_id (FK→stores), store_owner_id (FK→users)
  buyer_id (FK→users), status: created|paid|processing|shipped|delivered|cancelled
  subtotal, platform_fee, total, shipping_address, notes
  created_at, updated_at

order_items
  id (PK), order_id (FK→orders), product_id (FK→products)
  name, quantity, unit_price, line_total, margin

payments
  id (PK), order_id (FK→orders), user_id (FK→users)
  amount, currency, method: transfer|card|blik|p24
  status: pending|paid|failed|refunded
  external_ref, paid_at, created_at, updated_at

subscriptions
  id (PK), user_id (FK→users), plan, price
  payment_reference, status: active|cancelled|expired|superseded
  starts_at, ends_at, created_at, updated_at

suppliers
  id (PK), name, integration_type: api|xml|csv|manual
  api_url, api_key, margin, notes, active
  last_sync_at, created_at, updated_at

categories
  id (PK), name, slug (UNIQUE), parent_id (FK→categories, self-ref)
  description, icon, sort_order, active, created_at, updated_at

carts
  id (PK), user_id (FK→users, NULL=gość), store_id (FK→stores)
  session_id, status: active|checked_out|abandoned
  created_at, updated_at

cart_items
  id (PK), cart_id (FK→carts), product_id (FK→products)
  quantity, unit_price, created_at, updated_at
  UNIQUE (cart_id, product_id)

product_images
  id (PK), product_id (FK→products), url, alt, sort_order, created_at

audit_logs
  id (PK), user_id (FK→users), action, resource, resource_id
  metadata (JSONB), ip_address, created_at
```

---

## Wymagania

- Node.js 18+
- PostgreSQL 14+
- (opcjonalnie) Docker & Docker Compose

---

## Szybki start – lokalnie

```bash
# 1. Zainstaluj zależności
cd backend
npm install

# 2. Skonfiguruj zmienne środowiskowe
cp .env.example .env
# Edytuj .env i uzupełnij dane do bazy danych oraz klucz JWT

# 3. Utwórz bazę danych PostgreSQL
createdb hurtdetal_qualitet

# 4. Uruchom migracje (tworzy schemat tabel)
npm run migrate

# 5. Uruchom serwer
npm start          # produkcja
npm run dev        # tryb deweloperski (auto-restart)
```

## Szybki start – Docker Compose

```bash
# Z katalogu głównego repozytorium:
cp backend/.env.example .env      # opcjonalnie – nadpisz w docker-compose.yml
docker compose up --build
# API dostępne pod: http://localhost:3000
```

---

## Lista migracji

| Plik | Opis |
|------|------|
| `001_initial_schema.sql` | Podstawowy schemat: `users`, `subscriptions`, `suppliers`, `stores`, `products`, `orders`, `order_items` |
| `002_extended_schema.sql` | Rozszerzony schemat marketplace: `categories`, `product_images`, `shop_products`, `carts`, `cart_items`, `payments`, `audit_logs` + kolumna `category_id` w `products` |
| `003_product_status.sql` | Status produktu (`draft/pending/active/archived`), pola `custom_title/description/margin_type` w `shop_products`, `updated_at` w `categories` |
| `004_central_catalog.sql` | Katalog centralny: `store_id` nullable w `products`, nowa kolumna `is_central` |

Uruchomienie wszystkich migracji:
```bash
npm run migrate
```

---

## Struktura backendu

```
backend/
├── Dockerfile
├── .env.example
├── package.json
├── migrations/
│   ├── migrate.js              # runner migracji
│   ├── 001_initial_schema.sql
│   ├── 002_extended_schema.sql
│   ├── 003_product_status.sql
│   └── 004_central_catalog.sql # katalog centralny
├── src/
│   ├── app.js                  # główna aplikacja Express
│   ├── config/
│   │   └── database.js         # pula połączeń PostgreSQL
│   ├── middleware/
│   │   ├── auth.js             # JWT authenticate + requireRole
│   │   └── validate.js         # express-validator wrapper
│   └── routes/
│       ├── users.js            # /api/users
│       ├── stores.js           # /api/stores
│       ├── shops.js            # /api/shops/:slug (publiczne)
│       ├── products.js         # /api/products  (centralny katalog)
│       ├── shop-products.js    # /api/shop-products (produkt w sklepie)
│       ├── categories.js       # /api/categories
│       ├── cart.js             # /api/cart
│       ├── orders.js           # /api/orders
│       ├── payments.js         # /api/payments
│       ├── subscriptions.js    # /api/subscriptions
│       ├── suppliers.js        # /api/suppliers
│       ├── my.js               # /api/my  (widok sprzedawcy/kupca)
│       └── admin.js            # /api/admin
└── tests/
    └── api.test.js             # testy integracyjne (mock DB)
```

---

## Lista endpointów API

Bazowy URL: `http://localhost:3000/api`

### Autoryzacja

Wszystkie chronione endpointy wymagają nagłówka:
```
Authorization: Bearer <token>
```
Token JWT zwracany po `POST /api/users/register` lub `POST /api/users/login`.

---

### Użytkownicy `/api/users`

| Metoda | Ścieżka        | Opis                          | Auth         |
|--------|----------------|-------------------------------|--------------|
| POST   | `/register`    | Rejestracja                   | nie          |
| POST   | `/login`       | Logowanie, zwraca token JWT   | nie          |
| GET    | `/me`          | Profil zalogowanego           | tak          |
| PUT    | `/me`          | Aktualizacja profilu          | tak          |
| PUT    | `/me/password` | Zmiana hasła                  | tak          |
| GET    | `/`            | Lista użytkowników            | admin/owner  |

---

### Sklepy `/api/stores`

| Metoda | Ścieżka | Opis                 | Auth               |
|--------|---------|----------------------|--------------------|
| GET    | `/`     | Lista sklepów        | tak                |
| GET    | `/:id`  | Szczegóły sklepu     | tak                |
| POST   | `/`     | Utwórz sklep         | seller/owner/admin |
| PUT    | `/:id`  | Aktualizuj sklep     | właściciel/admin   |
| DELETE | `/:id`  | Usuń sklep           | admin/owner        |

---

### Publiczne sklepy `/api/shops`

| Metoda | Ścieżka              | Opis                       | Auth |
|--------|----------------------|----------------------------|------|
| GET    | `/:slug`             | Profil sklepu (publiczny)  | nie  |
| GET    | `/:slug/products`    | Produkty sklepu (publiczne)| nie  |

---

### Produkty `/api/products` – centralny katalog

| Metoda | Ścieżka | Opis                                        | Auth               |
|--------|---------|---------------------------------------------|--------------------|
| GET    | `/`     | Lista produktów (publiczny)                 | nie                |
| GET    | `/:id`  | Szczegóły produktu                          | nie                |
| POST   | `/`     | Dodaj produkt (store_id=null → centralny)   | seller/owner/admin |
| PUT    | `/:id`  | Aktualizuj produkt                          | właściciel/admin   |
| DELETE | `/:id`  | Usuń produkt                                | właściciel/admin   |

Query params dla `GET /`: `store_id`, `category`, `search`, `is_central`, `status`, `page`, `limit`

---

### Produkty sklepu `/api/shop-products` – marketplace

Seller dodaje produkty z centralnego katalogu do swojego sklepu.

| Metoda | Ścieżka | Opis                              | Auth               |
|--------|---------|-----------------------------------|--------------------|
| GET    | `/`     | Lista produktów sklepu (publiczny)| nie (`store_id` wymagane) |
| POST   | `/`     | Dodaj produkt do sklepu           | seller/owner/admin |
| PUT    | `/:id`  | Aktualizuj (cena/marża/kolejność) | właściciel/admin   |
| DELETE | `/:id`  | Usuń produkt ze sklepu            | właściciel/admin   |

---

### Kategorie `/api/categories`

| Metoda | Ścieżka | Opis                   | Auth        |
|--------|---------|------------------------|-------------|
| GET    | `/`     | Lista kategorii        | nie         |
| GET    | `/:id`  | Szczegóły kategorii    | nie         |
| POST   | `/`     | Utwórz kategorię       | admin/owner |
| PUT    | `/:id`  | Aktualizuj kategorię   | admin/owner |
| DELETE | `/:id`  | Usuń kategorię         | admin/owner |

---

### Koszyk `/api/cart`

| Metoda | Ścieżka              | Opis                    | Auth |
|--------|----------------------|-------------------------|------|
| GET    | `/`                  | Pobierz koszyk          | tak  |
| POST   | `/items`             | Dodaj produkt do koszyka| tak  |
| PUT    | `/items/:productId`  | Zmień ilość             | tak  |
| DELETE | `/items/:productId`  | Usuń produkt z koszyka  | tak  |
| DELETE | `/`                  | Wyczyść koszyk          | tak  |

Params: `store_id` (wymagany dla GET, w body dla pozostałych)

---

### Zamówienia `/api/orders`

| Metoda | Ścieżka       | Opis                   | Auth              |
|--------|---------------|------------------------|-------------------|
| GET    | `/`           | Lista zamówień         | tak               |
| GET    | `/:id`        | Szczegóły zamówienia   | tak               |
| POST   | `/`           | Utwórz zamówienie      | tak               |
| PATCH  | `/:id/status` | Zmień status           | właściciel sklepu |

Statusy: `created` → `paid` → `processing` → `shipped` → `delivered` / `cancelled`

---

### Płatności `/api/payments`

| Metoda | Ścieżka          | Opis                        | Auth        |
|--------|------------------|-----------------------------|-------------|
| GET    | `/`              | Lista płatności             | tak         |
| GET    | `/:id`           | Szczegóły płatności         | tak         |
| POST   | `/`              | Utwórz zapis płatności      | tak         |
| PUT    | `/:id/status`    | Zmień status płatności      | admin/owner |

Metody płatności: `transfer`, `card`, `blik`, `p24`
Statusy: `pending`, `paid`, `failed`, `refunded`

---

### Subskrypcje `/api/subscriptions`

| Metoda | Ścieżka   | Opis                    | Auth        |
|--------|-----------|-------------------------|-------------|
| GET    | `/`       | Lista subskrypcji       | tak         |
| GET    | `/active` | Aktywna subskrypcja     | tak         |
| POST   | `/`       | Kup/zmień plan          | tak         |
| DELETE | `/:id`    | Anuluj subskrypcję      | tak         |
| PUT    | `/:id`    | Aktualizuj subskrypcję  | admin/owner |

Plany: `trial` (0 PLN / 7 dni), `basic` (49 PLN), `pro` (149 PLN), `elite` (399 PLN)

---

### Hurtownie `/api/suppliers`

| Metoda | Ścieżka       | Opis                         | Auth        |
|--------|---------------|------------------------------|-------------|
| GET    | `/`           | Lista hurtowni               | tak         |
| GET    | `/:id`        | Szczegóły hurtowni           | tak         |
| POST   | `/`           | Dodaj hurtownię              | admin/owner |
| PUT    | `/:id`        | Aktualizuj hurtownię         | admin/owner |
| POST   | `/:id/import` | Importuj produkty (CSV/XML)  | seller+     |
| POST   | `/:id/sync`   | Synchronizuj przez API       | seller+     |

---

### Mój profil `/api/my`

| Metoda | Ścieżka                   | Opis                               | Auth               |
|--------|---------------------------|------------------------------------|------------------- |
| GET    | `/orders`                 | Historia zamówień kupującego       | tak                |
| GET    | `/store`                  | Mój sklep (pierwszy sklep sellera) | seller/owner/admin |
| GET    | `/store/products`         | Produkty mojego sklepu             | seller/owner/admin |
| POST   | `/store/products`         | Dodaj produkt do mojego sklepu     | seller/owner/admin |
| PATCH  | `/store/products/:id`     | Aktualizuj produkt w moim sklepie  | seller/owner/admin |
| DELETE | `/store/products/:id`     | Usuń produkt z mojego sklepu       | seller/owner/admin |

---

### Panel admina `/api/admin`

| Metoda | Ścieżka                    | Opis                          | Auth        |
|--------|----------------------------|-------------------------------|-------------|
| GET    | `/stats`                   | Statystyki platformy          | admin/owner |
| GET    | `/users`                   | Lista użytkowników            | admin/owner |
| PATCH  | `/users/:id`               | Zmień rolę/plan użytkownika   | admin/owner |
| DELETE | `/users/:id`               | Usuń użytkownika              | admin/owner |
| GET    | `/orders`                  | Lista zamówień (wszystkie)    | admin/owner |
| GET    | `/stores`                  | Lista sklepów (wszystkie)     | admin/owner |
| PATCH  | `/stores/:id/status`       | Zmień status sklepu           | admin/owner |
| GET    | `/products`                | Lista produktów (wszystkie)   | admin/owner |
| PATCH  | `/products/:id/status`     | Zmień status produktu         | admin/owner |
| GET    | `/audit-logs`              | Dziennik audytu               | admin/owner |

Query params `/admin/users`: `role`, `search`, `page`, `limit`
Query params `/admin/stores`: `status`, `page`, `limit`
Query params `/admin/products`: `status`, `is_central`, `search`, `page`, `limit`

---

## Role użytkowników

| Rola   | Uprawnienia                                  |
|--------|----------------------------------------------|
| buyer  | przeglądanie produktów, składanie zamówień   |
| seller | zarządzanie własnym sklepem i produktami     |
| admin  | zarządzanie wszystkimi zasobami              |
| owner  | pełen dostęp (właściciel platformy)          |

---

## Zmienne środowiskowe

Patrz [.env.example](.env.example).

Kluczowe:
- `JWT_SECRET` – zmień na bezpieczny, losowy ciąg w produkcji
- `DB_*` – dane połączenia PostgreSQL
- `PLATFORM_MARGIN_DEFAULT` – domyślna marża platformy (%)
- `ALLOWED_ORIGINS` – dozwolone domeny CORS

---

## Testy

```bash
npm test
```

Testy używają mocków bazy danych – nie wymagają połączenia z PostgreSQL.

---

## Checklist wdrożeniowa

### Infrastruktura
- [ ] Baza danych PostgreSQL 14+ uruchomiona
- [ ] Zmienne środowiskowe skonfigurowane (`.env` lub env vars)
- [ ] Silny `JWT_SECRET` (min. 32 znaki)
- [ ] `ALLOWED_ORIGINS` ustawione na domeny frontend
- [ ] Uruchomione migracje: `npm run migrate`

### Backend
- [ ] `npm start` lub `pm2 start backend/src/app.js`
- [ ] Health check: `GET /health` zwraca `{ status: 'ok' }`
- [ ] Rate limiting aktywny (`/api/` + `/api/users/login`)
- [ ] Helmet (security headers) aktywny

### Frontend PWA
- [ ] `window.QM_API_BASE` ustawiony na URL backendu (`https://api.uszefaqualitet.pl/api`)
- [ ] `<script src="js/api.js">` załadowany przed resztą skryptów
- [ ] Token JWT przechowywany jako `qm_token` w localStorage
- [ ] Nagłówek `Authorization: Bearer <token>` wysyłany przez `QMApi`

### Migracja z localStorage na API

| Funkcja frontend         | Endpoint API                         | Status  |
|--------------------------|--------------------------------------|---------|
| Logowanie / rejestracja  | `POST /api/users/login`, `/register` | ← priorytet |
| Profil użytkownika       | `GET /api/users/me`                  | ← priorytet |
| Mój sklep                | `GET /api/my/store`                  | ← priorytet |
| Lista produktów sklepu   | `GET /api/shop-products?store_id=…`  | ← priorytet |
| Koszyk                   | `GET/POST/PUT/DELETE /api/cart`      | ← priorytet |
| Składanie zamówień       | `POST /api/orders`                   | ← priorytet |
| Lista zamówień           | `GET /api/my/orders`                 | |
| Subskrypcja              | `POST /api/subscriptions`            | |
| Kategorie                | `GET /api/categories`                | |
| Panel superadmin         | `GET /api/admin/stats`               | |
| Zarządzanie użytkownikami| `PATCH /api/admin/users/:id`         | |
| Zarządzanie sklepami     | `PATCH /api/admin/stores/:id/status` | |

### Service Worker
- [ ] `/api/` wyłączone z cache (`NetworkFirst` lub brak cache)
- [ ] Statyczne assety w cache (CSS, JS, obrazy)

### Bezpieczeństwo
- [ ] HTTPS na domenie produkcyjnej
- [ ] Brak `JWT_SECRET = 'change_this_secret'` w produkcji
- [ ] Kolumna `api_key` w `suppliers` nie jest eksponowana w publicznych odpowiedziach
- [ ] Rate limiting dla endpointów logowania

---

## Hosting

### Docker Compose (zalecane)

```bash
docker compose up --build -d
```

### Render

1. Utwórz **Web Service** z repozytorium
2. **Root Directory**: `backend`
3. **Build Command**: `npm install && npm run migrate`
4. **Start Command**: `npm start`
5. Dodaj **PostgreSQL** w Render
6. Uzupełnij zmienne środowiskowe

### Railway

1. Utwórz projekt, dodaj **PostgreSQL plugin**
2. Wdróż z repozytorium, root: `backend/`
3. `START_COMMAND=npm start`

### VPS (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql
sudo -u postgres createdb hurtdetal_qualitet
sudo npm install -g pm2
pm2 start backend/src/app.js --name hurtdetal-api
pm2 startup && pm2 save
```
