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
│   └── 002_extended_schema.sql
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
42 testów pokrywa: users, stores, products, categories, cart, orders, payments, shop-products, admin stats, subscriptions, suppliers.

---

## Checklist – podpięcie frontendu PWA

### Konfiguracja

- [ ] Ustaw `API_BASE_URL` w frontend (np. `https://api.uszefaqualitet.pl/api`)
- [ ] Obsłuż token JWT – przechowuj w `localStorage` jako `qm_token`
- [ ] Dodaj nagłówek `Authorization: Bearer <token>` do każdego żądania

### Migracja z localStorage na API

| Funkcja frontend | Endpoint API | Uwagi |
|-----------------|--------------|-------|
| Logowanie / rejestracja | `POST /api/users/login`, `POST /api/users/register` | Zastąp mock auth |
| Profil użytkownika | `GET /api/users/me` | Zastąp `localStorage.getItem('qm_user')` |
| Lista sklepów | `GET /api/stores` | `StoreManager` → API |
| Tworzenie sklepu | `POST /api/stores` | `generator-sklepu.html` |
| Produkty sklepu | `GET /api/shop-products?store_id=…` | Listing produktów |
| Koszyk | `GET/POST/PUT/DELETE /api/cart` | Zastąp `localStorage` koszyk |
| Składanie zamówień | `POST /api/orders` | `sklep.html` checkout |
| Status zamówień | `GET /api/orders` | Panel kupującego |
| Subskrypcja | `POST /api/subscriptions` | `cennik.html` |
| Kategorie | `GET /api/categories` | Filtry na listingu |
| Panel admina | `GET /api/admin/stats` | `owner-panel.html` |

### Koszyk (priorytet)

```js
// Przykład: dodaj do koszyka
const res = await fetch(`${API_BASE_URL}/cart/items`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('qm_token')}`,
  },
  body: JSON.stringify({ store_id, product_id, quantity: 1 }),
});
const cart = await res.json();
```

### Uwierzytelnianie

```js
// Przykład: login
const res = await fetch(`${API_BASE_URL}/users/login`, {
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

