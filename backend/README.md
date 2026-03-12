# HurtDetalUszefaQUALITET – Backend API

Node.js / Express REST API z bazą danych PostgreSQL dla platformy HurtDetalUszefaQUALITET.

Architektura: **marketplace operatora** – centralny katalog produktów, sklepy użytkowników dodają produkty przez `shop_products`, klient kupuje od sklepu użytkownika.

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
| `003_product_status.sql` | Kolumna `status` (draft/pending/active/archived) w `products` oraz dodatkowe pola w `shop_products` |
| `003_central_catalog.sql` | `store_id` opcjonalny w `products`; flaga `is_central` dla produktów zarządzanych przez platformę (równoległa migracja 003) |
| `004_central_catalog.sql` | Uzupełnienie centralnego katalogu: `store_id` nullable, indeksy na `is_central` |
| `005_performance_indexes.sql` | Indeksy wydajnościowe i rozszerzenie schematu dla 1 000+ sprzedawców i 100 000+ produktów |
| `006_subscription_marketplace.sql` | Subskrypcje oparte na sklepie (`shop_id`), limity produktów, prowizja, daty start/end |

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
│   ├── 003_central_catalog.sql
│   ├── 004_central_catalog.sql
│   ├── 005_performance_indexes.sql
│   └── 006_subscription_marketplace.sql
├── src/
│   ├── app.js                  # główna aplikacja Express
│   ├── config/
│   │   └── database.js         # pula połączeń PostgreSQL
│   ├── middleware/
│   │   ├── auth.js             # JWT authenticate + requireRole + requireActiveSubscription
│   │   └── validate.js         # express-validator wrapper
│   └── routes/
│       ├── auth.js             # /api/auth  (kanoniczne endpointy onboardingu)
│       ├── users.js            # /api/users
│       ├── stores.js           # /api/stores
│       ├── shops.js            # /api/shops (publiczny profil sklepu)
│       ├── my.js               # /api/my    (widok sprzedawcy)
│       ├── products.js         # /api/products  (centralny katalog)
│       ├── shop-products.js    # /api/shop-products (produkt w sklepie)
│       ├── categories.js       # /api/categories
│       ├── cart.js             # /api/cart
│       ├── orders.js           # /api/orders
│       ├── payments.js         # /api/payments
│       ├── subscriptions.js    # /api/subscriptions
│       ├── suppliers.js        # /api/suppliers
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
Token JWT zwracany po `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/users/register` lub `POST /api/users/login`.

---

### Autoryzacja (onboarding) `/api/auth`

Kanoniczne endpointy używane przez flow rejestracji i logowania. Domyślna rola nowego konta to `seller`.

| Metoda | Ścieżka     | Opis                                          | Auth |
|--------|-------------|-----------------------------------------------|------|
| POST   | `/register` | Rejestracja (domyślna rola: seller)           | nie  |
| POST   | `/login`    | Logowanie, zwraca token JWT                   | nie  |
| GET    | `/me`       | Profil zalogowanego użytkownika               | tak  |
| PUT    | `/me`       | Aktualizacja profilu (name, phone)            | tak  |

Odpowiedź `POST /register` zawiera pole `next_step: "create_shop"` – jest ono zawsze zwracane dla tej ścieżki (domyślna rola to `seller`), wskazując kolejny krok onboardingu.

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

### Sklepy (onboarding) `/api/shops`

Uproszczone endpointy do tworzenia sklepu i przeglądania publicznego profilu.

| Metoda | Ścieżka              | Opis                                              | Auth               |
|--------|----------------------|---------------------------------------------------|--------------------|
| POST   | `/`                  | Utwórz sklep (auto-tworzy trial subskrypcję)      | seller/owner/admin |
| GET    | `/:slug`             | Publiczny profil sklepu                           | nie                |
| GET    | `/:slug/products`    | Publiczny listing produktów sklepu                | nie                |

---

### Mój sklep (sprzedawca) `/api/my`

Endpointy widoku sprzedawcy – dostęp tylko dla zalogowanego właściciela sklepu.

| Metoda | Ścieżka                  | Opis                                       | Auth                |
|--------|--------------------------|--------------------------------------------|---------------------|
| GET    | `/store`                 | Pobierz swój główny sklep                  | seller/owner/admin  |
| PATCH  | `/store`                 | Aktualizuj dane swojego sklepu             | seller/owner/admin  |
| GET    | `/orders`                | Historia zamówień kupującego               | tak                 |
| GET    | `/store/products`        | Lista produktów w moim sklepie             | seller/owner/admin  |
| POST   | `/store/products`        | Dodaj produkt do swojego sklepu            | seller/owner/admin  |
| PATCH  | `/store/products/:id`    | Aktualizuj produkt w moim sklepie          | seller/owner/admin  |
| DELETE | `/store/products/:id`    | Usuń produkt z mojego sklepu               | seller/owner/admin  |

---

### Produkty `/api/products` – centralny katalog

| Metoda | Ścieżka | Opis                         | Auth               |
|--------|---------|------------------------------|--------------------|
| GET    | `/`     | Lista produktów (publiczny)  | nie                |
| GET    | `/:id`  | Szczegóły produktu           | nie                |
| POST   | `/`     | Dodaj produkt do katalogu    | seller/owner/admin |
| PUT    | `/:id`  | Aktualizuj produkt           | właściciel/admin   |
| DELETE | `/:id`  | Usuń produkt                 | właściciel/admin   |

Query params dla `GET /`: `store_id`, `category`, `search`, `page`, `limit`

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

| Metoda | Ścieżka              | Opis                                             | Auth |
|--------|----------------------|--------------------------------------------------|------|
| GET    | `/`                  | Pobierz koszyk (`?store_id=` wymagane)           | tak  |
| POST   | `/`                  | Dodaj produkt do koszyka (przez `shop_product_id`)| tak  |
| POST   | `/items`             | Dodaj produkt do koszyka (legacy: przez `product_id`)| tak |
| PUT    | `/items/:productId`  | Zmień ilość produktu                             | tak  |
| DELETE | `/items/:itemId`     | Usuń element koszyka po UUID elementu            | tak  |
| DELETE | `/items/:productId`  | Usuń element koszyka po UUID produktu (legacy)   | tak  |
| DELETE | `/`                  | Wyczyść koszyk (`store_id` wymagane w body)      | tak  |

**Preferowany flow (nowy):** `POST /api/cart` z `{ shop_product_id, quantity }` oraz `DELETE /api/cart/items/:itemId`.

**Legacy flow:** `POST /api/cart/items` z `{ store_id, product_id, quantity }` (nadal obsługiwane).

---

### Zamówienia `/api/orders`

| Metoda | Ścieżka       | Opis                   | Auth              |
|--------|---------------|------------------------|-------------------|
| GET    | `/`           | Lista zamówień         | tak               |
| GET    | `/:id`        | Szczegóły zamówienia   | tak               |
| POST   | `/`           | Utwórz zamówienie      | tak               |
| PATCH  | `/:id/status` | Zmień status           | właściciel sklepu |

Statusy: `pending` → `confirmed` → `shipped` → `delivered` / `cancelled`

---

### Płatności `/api/payments`

| Metoda | Ścieżka          | Opis                        | Auth        |
|--------|------------------|-----------------------------|-------------|
| GET    | `/`              | Lista płatności             | tak         |
| GET    | `/:id`           | Szczegóły płatności         | tak         |
| POST   | `/`              | Utwórz zapis płatności      | tak         |
| PUT    | `/:id/status`    | Zmień status płatności      | admin/owner |

Metody płatności: `transfer`, `card`, `blik`, `p24`
Statusy: `pending`, `completed`, `failed`, `refunded`

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

### Panel admina `/api/admin`

| Metoda | Ścieżka        | Opis                      | Auth        |
|--------|----------------|---------------------------|-------------|
| GET    | `/stats`       | Statystyki platformy      | admin/owner |
| GET    | `/users`       | Lista użytkowników        | admin/owner |
| GET    | `/orders`      | Lista zamówień (wszystkie)| admin/owner |
| GET    | `/stores`      | Lista sklepów (wszystkie) | admin/owner |
| GET    | `/audit-logs`  | Dziennik audytu           | admin/owner |

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
124 testów pokrywa: users, auth, stores, shops, my store/products, products, categories, cart, orders, payments, shop-products, admin stats, subscriptions, suppliers.

---

## Checklist – podpięcie frontendu PWA

### Konfiguracja

- [ ] Ustaw `API_BASE_URL` w frontend (np. `https://api.uszefaqualitet.pl/api`)
- [ ] Obsłuż token JWT – przechowuj w `localStorage` jako `qm_token`
- [ ] Dodaj nagłówek `Authorization: Bearer <token>` do każdego żądania

### Migracja z localStorage na API

| Funkcja frontend | Endpoint API | Uwagi |
|-----------------|--------------|-------|
| Logowanie / rejestracja | `POST /api/auth/login`, `POST /api/auth/register` | Kanoniczny flow onboardingu |
| Logowanie / rejestracja (alternatywny) | `POST /api/users/login`, `POST /api/users/register` | Starszy endpoint |
| Profil użytkownika | `GET /api/auth/me` | Zastąp `localStorage.getItem('qm_user')` |
| Tworzenie sklepu (onboarding) | `POST /api/shops` | Po rejestracji (`next_step: "create_shop"`) |
| Lista sklepów | `GET /api/stores` | `StoreManager` → API |
| Mój sklep | `GET /api/my/store` | Widok sprzedawcy |
| Produkty sklepu | `GET /api/shop-products?store_id=…` | Listing produktów |
| Koszyk | `GET /api/cart`, `POST /api/cart`, `DELETE /api/cart/items/:itemId` | Nowy flow z `shop_product_id` |
| Składanie zamówień | `POST /api/orders` | `sklep.html` checkout |
| Historia zamówień | `GET /api/my/orders` | Panel kupującego |
| Subskrypcja | `POST /api/subscriptions` | `cennik.html` |
| Kategorie | `GET /api/categories` | Filtry na listingu |
| Panel admina | `GET /api/admin/stats` | `owner-panel.html` |

### Koszyk (priorytet)

```js
// Przykład: dodaj do koszyka (nowy flow – przez shop_product_id)
const res = await fetch(`${API_BASE_URL}/cart`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('qm_token')}`,
  },
  body: JSON.stringify({ shop_product_id, quantity: 1 }),
});
const cart = await res.json();
```

### Uwierzytelnianie

```js
// Przykład: login (kanoniczny endpoint)
const res = await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { token, user } = await res.json();
localStorage.setItem('qm_token', token);
localStorage.setItem('qm_user', JSON.stringify(user));
```

### Service Worker – cache API

W `service-worker.js` dodaj strategię `NetworkFirst` dla `/api/`:
```js
// Nie cachuj zapytań API – zawsze pobieraj z sieci
if (event.request.url.includes('/api/')) {
  event.respondWith(fetch(event.request));
  return;
}
```

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

