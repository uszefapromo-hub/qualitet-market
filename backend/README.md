# HurtDetalUszefaQUALITET – Backend API

Node.js / Express REST API z bazą danych PostgreSQL dla platformy HurtDetalUszefaQUALITET.

---

## Wymagania

- Node.js 18+
- PostgreSQL 14+

---

## Szybki start (lokalny)

```bash
# 1. Zainstaluj zależności
cd backend
npm install

# 2. Skonfiguruj zmienne środowiskowe
cp .env.example .env
# Edytuj .env i uzupełnij dane do bazy danych oraz klucz JWT

# 3. Utwórz bazę danych PostgreSQL
createdb hurtdetal_qualitet

# 4. Uruchom migracje (tworzy schemat tabel – uruchamia 001 i 002 automatycznie)
npm run migrate

# 5. Uruchom serwer
npm start          # produkcja
npm run dev        # tryb deweloperski (auto-restart)
```

---

## Docker (backend + PostgreSQL)

```bash
# Skopiuj zmienne środowiskowe
cp .env.example .env

# Uruchom stack (API na porcie 3000, PostgreSQL na porcie 5432)
docker compose up -d

# Logi
docker compose logs -f api

# Zatrzymaj
docker compose down
```

Migracje są uruchamiane automatycznie przy starcie kontenera `api`.

---

## Endpoints API

Bazowy URL: `http://localhost:3000/api`

### Autoryzacja

Wszystkie chronione endpointy wymagają nagłówka:
```
Authorization: Bearer <token>
```

Token JWT jest zwracany po rejestracji (`POST /api/users/register`) lub logowaniu (`POST /api/users/login`).

---

### Użytkownicy `/api/users`

| Metoda | Ścieżka             | Opis                          | Auth         |
|--------|---------------------|-------------------------------|--------------|
| POST   | `/register`         | Rejestracja nowego użytkownika| nie          |
| POST   | `/login`            | Logowanie, zwraca token JWT   | nie          |
| GET    | `/me`               | Profil zalogowanego użytkownika| tak         |
| PUT    | `/me`               | Aktualizacja profilu          | tak          |
| PUT    | `/me/password`      | Zmiana hasła                  | tak          |
| GET    | `/`                 | Lista użytkowników (admin)    | admin/owner  |

#### Rejestracja – przykład
```json
POST /api/users/register
{
  "email": "sprzedawca@example.pl",
  "password": "Tajne1234!",
  "name": "Jan Kowalski",
  "role": "seller"
}
```

---

### Sklepy `/api/stores`

| Metoda | Ścieżka    | Opis                    | Auth               |
|--------|------------|-------------------------|--------------------|
| GET    | `/`        | Lista sklepów           | tak                |
| GET    | `/:id`     | Szczegóły sklepu        | tak                |
| POST   | `/`        | Utwórz sklep            | seller/owner/admin |
| PUT    | `/:id`     | Aktualizuj sklep        | właściciel/admin   |
| DELETE | `/:id`     | Usuń sklep              | admin/owner        |

#### Tworzenie sklepu – przykład
```json
POST /api/stores
{
  "name": "Mój Sklep Meblowy",
  "slug": "moj-sklep-meblowy",
  "description": "Sklep z meblami premium",
  "margin": 20,
  "plan": "pro"
}
```

---

### Produkty `/api/products`

| Metoda | Ścieżka | Opis                         | Auth               |
|--------|---------|------------------------------|--------------------|
| GET    | `/`     | Lista produktów (publiczny)  | nie                |
| GET    | `/:id`  | Szczegóły produktu           | nie                |
| POST   | `/`     | Dodaj produkt                | seller/owner/admin |
| PUT    | `/:id`  | Aktualizuj produkt           | właściciel/admin   |
| DELETE | `/:id`  | Usuń produkt                 | właściciel/admin   |

Query params dla `GET /api/products`: `store_id`, `category`, `search`, `page`, `limit`

Ceny są obliczane automatycznie:
- `price_gross` = `price_net × (1 + tax_rate/100)`
- `selling_price` = `price_gross × (1 + store_margin/100)`

---

### Zamówienia `/api/orders`

| Metoda | Ścieżka           | Opis                   | Auth              |
|--------|-------------------|------------------------|-------------------|
| GET    | `/my`             | Moje zamówienia (kupujący) | tak           |
| GET    | `/`               | Lista zamówień         | tak               |
| GET    | `/:id`            | Szczegóły zamówienia   | tak               |
| POST   | `/`               | Utwórz zamówienie      | tak               |
| PATCH  | `/:id/status`     | Zmień status           | właściciel sklepu |

Statusy: `pending` → `confirmed` → `shipped` → `delivered` / `cancelled`

#### Tworzenie zamówienia z koszyka – przykład
```json
POST /api/orders
{
  "cart_id": "uuid-koszyka",
  "shipping_address": "ul. Przykładowa 1, 00-001 Warszawa"
}
```

#### Tworzenie zamówienia bezpośrednio – przykład
```json
POST /api/orders
{
  "items": [
    { "shop_product_id": "uuid-shop-produktu", "quantity": 2 }
  ],
  "shipping_address": "ul. Przykładowa 1, 00-001 Warszawa"
}
```

---

### Kategorie `/api/categories`

| Metoda | Ścieżka   | Opis                          | Auth           |
|--------|-----------|-------------------------------|----------------|
| GET    | `/`       | Lista kategorii (publiczny)   | nie            |
| GET    | `/:id`    | Szczegóły kategorii           | nie            |
| POST   | `/`       | Utwórz kategorię              | admin/owner    |
| PUT    | `/:id`    | Aktualizuj kategorię          | admin/owner    |

Query params: `parent_id` (filtrowanie po kategorii nadrzędnej)

---

### Produkty sklepu `/api/shops` i `/api/my/store`

| Metoda | Ścieżka                       | Opis                                   | Auth               |
|--------|-------------------------------|----------------------------------------|--------------------|
| GET    | `/shops/:slug/products`       | Produkty sklepu (publiczny)            | nie                |
| GET    | `/my/store/products`          | Moje produkty w sklepie                | seller             |
| POST   | `/my/store/products`          | Dodaj produkt z katalogu do sklepu     | seller             |
| PATCH  | `/my/store/products/:id`      | Aktualizuj listing (marża, opis, itp.) | seller/admin       |
| DELETE | `/my/store/products/:id`      | Usuń produkt ze sklepu                 | seller/admin       |

Model marketplace: sprzedawca nie tworzy produktu od zera – dodaje produkt z globalnego
katalogu (`POST /api/products`) do swojego sklepu przez `shop_products`. Cena sprzedaży
wyliczana jest automatycznie z ceny bazowej i marży sklepu.

#### Dodanie produktu do sklepu – przykład
```json
POST /api/my/store/products
{
  "product_id": "uuid-produktu-globalnego",
  "custom_title": "Mój tytuł (opcjonalnie)",
  "margin_type": "percent",
  "margin_value": 25
}
```

---

### Koszyk `/api/cart`

| Metoda | Ścieżka              | Opis                           | Auth |
|--------|----------------------|--------------------------------|------|
| GET    | `/`                  | Pobierz aktywny koszyk         | tak  |
| POST   | `/`                  | Dodaj produkt do koszyka       | tak  |
| DELETE | `/items/:itemId`     | Usuń pozycję z koszyka         | tak  |

#### Dodanie do koszyka – przykład
```json
POST /api/cart
{
  "shop_product_id": "uuid-produktu-sklepu",
  "quantity": 2
}
```

---

### Panel admina `/api/admin`

| Metoda | Ścieżka              | Opis                           | Auth        |
|--------|----------------------|--------------------------------|-------------|
| GET    | `/orders`            | Wszystkie zamówienia           | admin/owner |
| PATCH  | `/orders/:id/status` | Zmień status zamówienia        | admin/owner |
| GET    | `/audit-logs`        | Logi audytowe                  | admin/owner |
| GET    | `/users`             | Lista użytkowników             | admin/owner |

Query params dla `/audit-logs`: `entity_type`, `actor_user_id`, `action`, `page`, `limit`

---

### Subskrypcje `/api/subscriptions`

| Metoda | Ścieżka   | Opis                        | Auth           |
|--------|-----------|-----------------------------|----------------|
| GET    | `/`       | Lista subskrypcji           | tak            |
| GET    | `/active` | Aktywna subskrypcja         | tak            |
| POST   | `/`       | Kup/zmień plan              | tak            |
| DELETE | `/:id`    | Anuluj subskrypcję          | tak            |
| PUT    | `/:id`    | Aktualizuj subskrypcję      | admin/owner    |

Plany: `trial` (7 dni), `basic` (49 PLN), `pro` (149 PLN), `elite` (399 PLN)

---

### Hurtownie (dostawcy) `/api/suppliers`

| Metoda | Ścieżka          | Opis                          | Auth           |
|--------|------------------|-------------------------------|----------------|
| GET    | `/`              | Lista hurtowni                | tak            |
| GET    | `/:id`           | Szczegóły hurtowni            | tak            |
| POST   | `/`              | Dodaj hurtownię               | admin/owner    |
| PUT    | `/:id`           | Aktualizuj hurtownię          | admin/owner    |
| POST   | `/:id/import`    | Importuj produkty (CSV/XML)   | seller+        |
| POST   | `/:id/sync`      | Synchronizuj przez API        | seller+        |

#### Import CSV – przykład
```
POST /api/suppliers/:id/import  (multipart/form-data)
file: plik.csv
store_id: uuid-sklepu
```

Format CSV (nagłówki): `sku,name,price_net,tax_rate,stock,category,description,image_url`

Format XML (Baselinker/IAI kompatybilny):
```xml
<products>
  <product>
    <sku>ABC123</sku>
    <name>Fotel biurowy</name>
    <price_net>299.00</price_net>
    <vat>23</vat>
    <stock>15</stock>
    <kategoria>Fotele</kategoria>
  </product>
</products>
```

---

## Role użytkowników

| Rola    | Uprawnienia                                  |
|---------|----------------------------------------------|
| buyer   | przeglądanie produktów, składanie zamówień   |
| seller  | zarządzanie własnym sklepem i produktami     |
| admin   | zarządzanie wszystkimi zasobami              |
| owner   | pełen dostęp (właściciel platformy)          |

---

## Zmienne środowiskowe

Patrz [.env.example](.env.example).

Kluczowe:
- `JWT_SECRET` – zmień na bezpieczny, losowy ciąg w produkcji
- `DB_*` – dane połączenia PostgreSQL
- `PLATFORM_MARGIN_DEFAULT` – domyślna marża platformy (%)
- `ALLOWED_ORIGINS` – dozwolone domeny CORS

---

## Hosting (Render / Railway)

### Render

1. Utwórz nowy **Web Service** z repozytorium
2. Ustaw **Root Directory**: `backend`
3. **Build Command**: `npm install && npm run migrate`
4. **Start Command**: `npm start`
5. Dodaj **PostgreSQL** w Render (darmowy tier dostępny)
6. Uzupełnij zmienne środowiskowe w panelu Render

### Railway

1. Utwórz projekt, dodaj **PostgreSQL plugin**
2. Wdróż z repozytorium, ustaw root na `backend/`
3. Ustaw `START_COMMAND=npm start`
4. Uzupełnij zmienne środowiskowe

### VPS (Ubuntu/Debian)

```bash
# Zainstaluj Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# Skonfiguruj PostgreSQL
sudo -u postgres createdb hurtdetal_qualitet
sudo -u postgres createuser --pwprompt appuser
sudo -u postgres psql -c "GRANT ALL ON DATABASE hurtdetal_qualitet TO appuser;"

# Zainstaluj PM2 do zarządzania procesem
sudo npm install -g pm2

# Uruchom serwer
pm2 start backend/src/app.js --name hurtdetal-api
pm2 startup && pm2 save
```

---

## Testy

```bash
npm test
```

Testy używają mock'ów bazy danych – nie wymagają połączenia z PostgreSQL.
