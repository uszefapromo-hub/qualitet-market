# GitHub Copilot – instrukcje dla projektu HurtDetalUszefaQUALITET

## Opis projektu

**Qualitet Platform** to polska platforma marketplace B2B/B2C łącząca hurtowników (dostawców) z detalistami (sprzedawcami) i kupującymi.

- Strona produkcyjna: https://uszefaqualitet.pl
- Architektura: REST API (Node.js/Express) + PWA frontend (HTML5/Vanilla JS)
- Baza danych: PostgreSQL

## Stos technologiczny

### Backend (`backend/`)
- **Runtime:** Node.js >= 18
- **Framework:** Express 4
- **Baza danych:** PostgreSQL (biblioteka `pg`)
- **Auth:** JWT (`jsonwebtoken`) – role: `buyer`, `seller`, `admin`, `owner`
- **Walidacja:** `express-validator`
- **Bezpieczeństwo:** `helmet`, `express-rate-limit`
- **Pliki:** `multer` (upload CSV/XML)
- **Parser danych:** `csv-parse`, `xml2js`
- **UUID:** biblioteka `uuid` (v4)
- **Testy:** Jest + supertest (`npm test` w katalogu `backend/`)

### Frontend (`js/`, `*.html`)
- **Vanilla JS** – brak frameworków (React, Vue, Angular)
- **`window.QMApi`** – globalny klient REST API (`js/api.js`)
- **`window.QualitetAPI`** – shim kompatybilności (`js/api-client.js`)
- **`js/pwa-connect.js`** – mostek frontend → backend (login, rejestracja, checkout)
- **`js/flow.js`** – koordynator przepływów stron
- **Service Worker** (`service-worker.js`) – tryb offline/PWA

## Struktura katalogów

```
/
├── backend/
│   ├── src/
│   │   ├── app.js              # główny plik Express
│   │   ├── db.js               # klient PostgreSQL
│   │   ├── middleware/         # auth, rate-limit
│   │   ├── routes/             # handlery tras API
│   │   │   ├── auth.js         # /api/auth
│   │   │   ├── admin.js        # /api/admin (tylko owner/admin)
│   │   │   ├── my.js           # /api/my (seller dashboard)
│   │   │   ├── products.js     # /api/products
│   │   │   ├── orders.js       # /api/orders
│   │   │   ├── subscriptions.js
│   │   │   ├── referral.js     # program polecający
│   │   │   └── ...
│   │   └── helpers/
│   │       └── audit.js        # auditLog() + computeSellingPrice()
│   ├── migrations/             # pliki SQL (001_*.sql … 015_*.sql)
│   ├── tests/
│   │   └── api.test.js         # ~320 testów Jest/supertest
│   └── package.json
├── js/
│   ├── api.js                  # QMApi – klient REST
│   ├── api-client.js           # QualitetAPI shim
│   ├── app.js                  # główna logika PWA
│   ├── pwa-connect.js          # mostek frontend-backend
│   ├── flow.js                 # przepływy stron
│   └── cart.js
├── *.html                      # strony PWA
├── .github/
│   └── copilot-instructions.md
├── ARCHITECTURE.md
├── STATUS.md
└── docker-compose.yml
```

## Konwencje kodowania

### Backend (JavaScript/Node.js)

- **Styl:** 2 spacje wcięcia, brak średników (dopasuj styl do istniejącego pliku)
- **Async/await** zamiast callbacków
- **Odpowiedzi API:** zawsze JSON z polem `error` przy błędach
  ```js
  res.status(400).json({ error: 'Opis błędu' });
  res.status(200).json({ data: result });
  ```
- **Walidacja wejścia:** `express-validator` + ręczna weryfikacja po `validationResult(req)`
- **Zapytania SQL:** parametryzowane (`$1`, `$2`, …) – nigdy string concatenation
- **UUID:** `const { v4: uuidv4 } = require('uuid');`
- **Audit log:** `auditLog({ actorUserId, action, resource, resourceId, metadata, ipAddress })` – fire-and-forget
- **Limity paginacji:** `Math.min(100, parseInt(req.query.limit) || 20)`
- **Role sprawdzane przez middleware:** `requireAuth`, `requireAdmin`, `requireActiveSubscription`

### Baza danych / Migracje

- Pliki w `backend/migrations/` – numerowane `NNN_nazwa.sql`
- Nowe migracje: kolejny numer, dodaj do `backend/migrations/migrate.js`
- Typy UUID w PostgreSQL: `UUID DEFAULT gen_random_uuid()`
- Timestampy: `TIMESTAMP WITH TIME ZONE DEFAULT NOW()`

### Frontend (Vanilla JS)

- Globalny obiekt `window.QMApi` – używaj go zamiast bezpośrednich `fetch`
- Wyświetlanie błędów: metody `showError()` / `showSuccess()` z parametrem elementu DOM
- Stany ładowania: klasy CSS `.loading`, `.hidden`
- Brak modułów ES (brak `import/export`) – skrypty ładowane przez `<script src="…">`

### Testy

- Plik: `backend/tests/api.test.js`
- `setupDbMock()` – zamockowana baza danych w pamięci
- Każdy handler trasy wymaga odpowiedniej liczby mocków `db.query`
- Uruchomienie: `cd backend && npm test`

## Model cenowy

```
supplier_price
  → [marża tieru platformy]
  → platform_price = min_selling_price
    → [marża sprzedawcy (fixed/percent)]
    → selling_price
```

Funkcja pomocnicza: `computeSellingPrice(priceGross, marginType, marginValue)` w `backend/src/helpers/audit.js`.

## Role użytkowników

| Rola | Dostęp |
|------|--------|
| `buyer` | Przeglądanie sklepów, zakupy, koszyk, zamówienia |
| `seller` | Dashboard sprzedawcy (`/api/my/*`), zarządzanie sklepem i produktami |
| `admin` | Panel admina (`/api/admin/*`) – użytkownicy, sklepy, produkty, zamówienia |
| `owner` | Pełny dostęp superadmina |

## Program polecający (referral)

- Tabele: `referral_codes`, `referral_uses`
- Kolumny użytkownika: `promo_tier` (0–3), `referred_by_code`
- `ensureReferralCode(userId)` – tworzy kod jeśli brak (wywoływane po rejestracji)
- Trasy: `/api/referral/my-code`, `/api/referral/stats`

## Subskrypcje

- Plany: `trial`, `basic`, `pro`, `elite`
- `PLAN_CONFIG` w `subscriptions.js` – limity produktów, marże, czas trwania
- Middleware: `requireActiveSubscription` – sprawdza aktywną subskrypcję

## Typowe zadania dla Copilota

- Dodawanie nowych endpointów Express (wzoruj się na istniejących trasach)
- Pisanie zapytań SQL z parametryzacją
- Tworzenie mocków db.query w testach
- Pisanie walidatorów `express-validator`
- Refaktoryzacja funkcji JS w frontend (bez frameworków)
- Debugowanie łańcucha cenowego (supplier_price → selling_price)
- Pomoc przy migracjach SQL

## Ważne uwagi

- Nigdy nie wstawiaj wartości bezpośrednio do SQL – używaj parametrów `$1`, `$2`
- Nie usuwaj istniejących testów – rozszerzaj plik `api.test.js`
- Zachowaj kompatybilność z `window.QMApi` i `window.QualitetAPI` we frontendzie
- `auditLog()` działa fire-and-forget – nie `await`
