# RAPORT AUDYTU SYSTEMU – QUALITETMARKET

> **Data:** 2026-03-20  
> **Autor:** GitHub Copilot Agent (pełny audyt + implementacja napraw)  
> **Repozytorium:** `uszefapromo-hub/qualitet-market`  
> **Gałąź:** `copilot/audyt-systemu-qualitetmarket`

---

## 1. CO DZIAŁA ✔

### Backend API (Node.js / Express)
| Moduł | Status | Uwagi |
|---|---|---|
| `POST /api/auth/register` | ✔ | Tworzy konto, sklep, subskrypcję trial, kod polecający |
| `POST /api/auth/login` | ✔ | JWT, obsługa e-mail i telefonu |
| `POST /api/auth/refresh` | ✔ | Odświeżanie tokena |
| `GET/PUT /api/auth/me` | ✔ | Profil użytkownika |
| `POST /api/auth/forgot-password` | ✔ | **NOWE** – resetowanie hasła przez e-mail |
| `POST /api/auth/reset-password` | ✔ | **NOWE** – ustawienie nowego hasła przez token |
| `/api/products` CRUD | ✔ | Katalog centralny, tiery cen, filtry, paginacja |
| `/api/shops/:slug` | ✔ | Profil publiczny sklepu, auto-przypisanie produktów |
| `/api/cart` | ✔ | Koszyk z walidacją stanu magazynowego (dwa poziomy) |
| `/api/orders` | ✔ | Tworzenie zamówień, dekrementacja stock w transakcji |
| `/api/payments` | ✔ | Stripe Checkout Session (pełna integracja) |
| `/api/payments` (bank transfer) | ✔ | Przelew bankowy – dane konta z env |
| `/api/subscriptions` | ✔ | Plany trial/basic/pro/elite; trial = 0 PLN |
| `/api/admin/*` | ✔ | 40+ endpointów, RBAC: owner/admin |
| `/api/my/*` | ✔ | Dashboard sprzedawcy – sklep, produkty, zamówienia, statystyki |
| `/api/live/*` | ✔ | Streamy live, czat, produkty w streamie |
| `/api/auctions` | ✔ | Aukcje artystów – licytacje, statusy |
| `/api/reputation` | ✔ | Oceny sprzedawców, recenzje produktów, odznaki |
| `/api/referral` | ✔ | Kody polecające, statystyki |
| `/api/gamification` | ✔ | Punkty, poziomy, odznaki |
| `/api/ai` | ✔ | OpenAI + fallback mock gdy brak klucza |
| `/api/feed` | ✔ | Kafelkowy feed produktów (MAX_LIMIT=50) |
| `/api/suppliers` | ✔ | Import CSV/XML, auto-sync co 12h |
| WebSocket (ws) | ✔ | Broadcast dla live streamów |
| Walidacja SQL | ✔ | 100% zapytań parametryzowanych – brak SQL Injection |
| CORS | ✔ | Allowlist z env, 403 dla nieznanych originsów |
| Rate limiting | ✔ | 100 req/15min ogólnie, 30 req/15min dla auth |
| JWT Security | ✔ | Wymagany bezpieczny sekret w production |

### Frontend PWA
| Strona | Status | Uwagi |
|---|---|---|
| `login.html` | ✔ | Logowanie, rejestracja, **Nie pamiętam hasła** (NOWE) |
| `dashboard.html` | ✔ | Dashboard użytkownika, auth-gate |
| `panel-sklepu.html` | ✔ | Seller panel – produkty, zamówienia, statystyki |
| `owner-panel.html` | ✔ | Panel właściciela – admini, sklepy, skrypty |
| `koszyk.html` | ✔ | Koszyk + checkout przez pwa-connect.js |
| `cennik.html` | ✔ | Plany cenowe, integracja z Stripe |
| `auctions.html` | ✔ | Aukcje artystów – live API calls |
| `reputation.html` | ✔ | Oceny sprzedawców, recenzje |
| `hurtownie.html` | ✔ | Lista hurtowni, sync produktów |
| `listing.html` | ✔ | Katalog produktów z filtrami |
| `feed.html` | ✔ | Feed produktów |
| `live.html` | ✔ | Live commerce |
| `panel-artysty.html` | ✔ | Panel artysty |
| `panel-dostawcy.html` | ✔ | Panel dostawcy |
| Service Worker | ✔ | Tryb offline, cache-first dla statycznych zasobów |
| PWA Manifest | ✔ | `manifest.json`, ikony SVG |

### Testy automatyczne
- **874 testów Jest/supertest** – wszystkie przechodzą ✔
- **+7 nowych testów** dla `forgot-password` i `reset-password`

---

## 2. CO NIE DZIAŁA ❌

| Problem | Plik | Opis |
|---|---|---|
| ~~Reset hasła~~ | ~~`auth.js`, `login.html`~~ | ~~Brak~~ **→ NAPRAWIONE w tym PR** |
| BLIK | `backend/src/routes/payments.js:457` | Zwraca tylko instrukcje (brak integracji z bankiem/acquirerem) |
| P24 (Przelewy24) | `backend/src/routes/payments.js:430` | Stubowane – wykrywa env ale zwraca sandbox bez SDK P24 |
| Mobile checkout | `mobile/app/checkout.tsx:43` | `setTimeout(1200ms)` zamiast real `POST /api/orders` – zamówienie nie jest tworzone |
| Email transakcyjny | `backend/src/helpers/mailer.js` | Działa tylko gdy SMTP_HOST skonfigurowany; domyślnie kolejkuje ale nie wysyła |
| Subdomeny sklepów | `backend/src/routes/shops.js` | Format `{slug}.qualitetmarket.pl` generowany ale nie ma reverse proxy |

---

## 3. CO JEST FAKE UI ⚠️

| Element | Plik | Opis |
|---|---|---|
| Mobile Checkout | `mobile/app/checkout.tsx:43,61` | Cały flow: `await new Promise(resolve => setTimeout(resolve, 1200))` + hardcoded `ORDER_TOTAL = 757.98` |
| Next.js frontend | `frontend/src/app/` | Równoległy frontend (Next.js + Tailwind) – istnieje w repo, nie jest deployowany |
| `alert()` jako error UI | `js/app.js:4430,4433,6590,6604,6642` | 5x `alert()` zamiast poprawionych komponentów błędu |
| `alert()` jako error UI | `js/flow.js:168,188,635,641,880,901` | 6x `alert()` zamiast poprawionych komponentów błędu |
| cennik.html – status planu | `cennik.html` | Przyciski AKTYWNY są hidden bez sprawdzenia prawdziwej subskrypcji |
| `skrypty.html` | `skrypty.html:420` | `QMApi.Scripts.toggle()` – metoda nie istnieje w api.js |
| `qualitetverse.html` | `qualitetverse.html` | Strona "starego brandu" bez żadnych skryptów – martwa strona |
| `suppliers.html` | `suppliers.html` | Brak skryptów, brak połączenia z API |

---

## 4. BLOKERY URUCHOMIENIA 🔥

| Priorytet | Bloker | Plik | Status |
|---|---|---|---|
| 🔥 KRYTYCZNY | ~~12 stron HTML defaultowało do `http://localhost:3000/api`~~ | `dashboard.html`, `koszyk.html`, `login.html`, `cennik.html`, `operator-panel.html`, `feed.html`, `live.html`, `market-landing.html`, `skrypty.html`, `zarabiaj.html`, `qualitetmarket.html`, `linki-sprzedazowe.html` | **→ NAPRAWIONE** |
| 🔥 KRYTYCZNY | ~~Brak resetu hasła – użytkownicy nie mogą odzyskać kont~~ | `auth.js`, `login.html` | **→ NAPRAWIONE** |
| 🔥 WYSOKI | BLIK/P24 stubowane | `payments.js:430,457` | ❌ wymaga SDK |
| 🔥 WYSOKI | SMTP nie skonfigurowany → e-maile nie wychodzą | `.env` (SMTP_HOST pusty) | ⚠️ wymaga konfiguracji |
| 🔥 WYSOKI | Mobile app checkout nie tworzy zamówień | `mobile/app/checkout.tsx:43` | ❌ fake setTimeout |
| ⚠️ ŚREDNI | JWT_SECRET = domyślna wartość na produkcji blokuje start | `backend/src/config/runtime.js:22` | ⚠️ wymaga ustawienia env |
| ⚠️ ŚREDNI | DB_PASSWORD puste = postgresql bez hasła | `backend/src/config/database.js:10` | ⚠️ wymaga konfiguracji |

---

## 5. TOP 5 BŁĘDÓW

### 🔴 BUG #1 – 12 stron HTML domyślnie do localhost (NAPRAWIONE)
**Plik:** `dashboard.html`, `koszyk.html`, `login.html`, `cennik.html`, `operator-panel.html`, `feed.html`, `live.html`, `market-landing.html`, `skrypty.html`, `zarabiaj.html`, `qualitetmarket.html`, `linki-sprzedazowe.html`  
**Problem:** `js/api.js` linia 33 – fallback `http://localhost:3000/api` gdy `window.QM_API_BASE` nie ustawione. Na produkcji (Netlify) wszystkie wywołania API lądowały na localhost i kończyły się błędem `ERR_CONNECTION_REFUSED`.  
**Fix:** Dodano `<script>window.QM_API_BASE = 'https://api.uszefaqualitet.pl/api';</script>` do 13 stron.  
**Status:** ✅ NAPRAWIONO

---

### 🔴 BUG #2 – Brak resetu hasła (NAPRAWIONE)
**Plik:** `backend/src/routes/auth.js`, `login.html`  
**Problem:** Użytkownik, który zapomniał hasła, nie mógł odzyskać dostępu. Brak endpointów i UI.  
**Fix:**  
- `POST /api/auth/forgot-password` – tworzy token, wysyła e-mail  
- `POST /api/auth/reset-password` – waliduje token, aktualizuje hasło  
- `backend/migrations/042_password_reset_tokens.sql` – nowa tabela  
- `login.html` – przycisk "Nie pamiętam hasła", formularze, auto-show przy `?reset_token=`  
- `js/api.js` – `QMApi.Auth.forgotPassword()` i `QMApi.Auth.resetPassword()`  
**Status:** ✅ NAPRAWIONO

---

### 🟠 BUG #3 – Mobile Checkout to simulacja (nie naprawione w tym PR)
**Plik:** `mobile/app/checkout.tsx:43,61`  
**Problem:** `handlePlaceOrder()` wykonuje `await new Promise(resolve => setTimeout(resolve, 1200))` zamiast `POST /api/orders`. Wartość `ORDER_TOTAL = 757.98` hardcoded. Zamówienie NIE jest tworzone w bazie.  
**Fix wymaga:** Refaktoring całego `checkout.tsx` – podłączenie do `POST /api/orders` + `POST /api/payments/:id/initiate`.  
**Status:** ❌ NIEZNAPRAWIONE

---

### 🟠 BUG #4 – BLIK i P24 stubowane
**Plik:** `backend/src/routes/payments.js:430-465`  
**Problem:** BLIK zwraca tylko instrukcje (brak integracji bankowej). P24 wykrywa `P24_MERCHANT_ID` ale bez SDK Przelewy24 – klienci wybierają metodę płatności i nie są przekierowani do bramki.  
**Fix wymaga:** Integracja z SDK `przelewy24` npm lub oficjalnym REST API P24. BLIK wymaga umowy z acquirerem (Autopay/Tpay).  
**Status:** ❌ NIEZNAPRAWIONE

---

### 🟡 BUG #5 – `skrypty.html` wywołuje `QMApi.Scripts.toggle()` – metoda nie istnieje
**Plik:** `skrypty.html:420`, `js/api.js`  
**Problem:** `window.QMApi.Scripts.toggle(script.id, {active: !script.active})` – metoda `Scripts.toggle` nie jest zdefiniowana w `js/api.js`. Skrypty.html to panel skryptów systemowych dla sprzedawców, który rzuci `TypeError: QMApi.Scripts.toggle is not a function`.  
**Fix wymaga:** Dodanie `Scripts.toggle(id, data)` do `js/api.js` lub usunięcie wywołania.  
**Status:** ❌ NIEZNAPRAWIONE (wymagałoby dodatkowej analizy: czy ta strona jest w użyciu?)

---

## 6. CO NAPRAWIĆ NAJPIERW

| Kolejność | Zadanie | Impact | Czas |
|---|---|---|---|
| 1 | ✅ **QM_API_BASE w 13 stronach** | Wszystkie API calls na produkcji | 30 min – ZROBIONE |
| 2 | ✅ **Reset hasła** (backend + frontend + migration) | Odzyskiwanie kont | 2h – ZROBIONE |
| 3 | **Konfiguracja SMTP** (nie kod – konfiguracja) | E-maile transakcyjne | 30 min (ops) |
| 4 | **Mobile checkout** – podłączenie do `POST /api/orders` | Mobilne zakupy | 4h |
| 5 | **P24 SDK** – prawdziwa integracja Przelewy24 | Płatności PLN | 8h |
| 6 | **BLIK** – umowa z acquirerem + API | Płatności BLIK | 2+ dni (biznes) |
| 7 | **alert() → komponent błędu** – refactor UX | UX | 4h |
| 8 | **skrypty.html** – `QMApi.Scripts.toggle` | Panel skryptów | 1h |

---

## Podsumowanie techniczne

| Aspekt | Stan | Szczegóły |
|---|---|---|
| Backend API | ✅ Produkcyjny | 874 testów, wszystkie przechodzą |
| Baza danych | ✅ | PostgreSQL, 42 migracje, transakcje, indeksy |
| Autentykacja | ✅ | JWT refresh, rate-limiting, CORS |
| Reset hasła | ✅ NAPRAWIONE | endpoint + UI + tabela DB + testy |
| Koszyk / checkout (web) | ✅ | pwa-connect.js → /api/orders → /api/payments |
| Koszyk / checkout (mobile) | ❌ | setTimeout – nie działa |
| Stripe | ✅ | Pełna integracja, webhooki |
| P24 / BLIK | ❌ | Stubowane |
| AI | ✅ | OpenAI + mock bez klucza |
| WebSocket / Live | ✅ | ws.js broadcast manager |
| PWA / Service Worker | ✅ | Cache-first, offline |
| Next.js frontend | ⚠️ | Istnieje w repo – nie deployowany |
| Aplikacja React Native | ⚠️ | Wczesny etap, checkout fake |
| SQL Injection | ✅ | 100% zapytań parametryzowanych |
| QM_API_BASE | ✅ NAPRAWIONE | Wszystkie krytyczne strony ustawione |

---

## Zmiany wprowadzone w tym PR

| Plik | Zmiana |
|---|---|
| `backend/src/routes/auth.js` | +2 endpointy: `POST /forgot-password`, `POST /reset-password` |
| `backend/src/helpers/mailer.js` | `sendPasswordResetEmail()` – wysyłka linku resetu |
| `backend/migrations/042_password_reset_tokens.sql` | Nowa tabela `password_reset_tokens` |
| `backend/tests/api.test.js` | +7 testów dla forgot/reset-password (874 total, +7) |
| `js/api.js` | `QMApi.Auth.forgotPassword()`, `QMApi.Auth.resetPassword()` |
| `login.html` | UI: "Nie pamiętam hasła", formularz reset, auto-show przy `?reset_token=` |
| `dashboard.html` | +`window.QM_API_BASE` |
| `koszyk.html` | +`window.QM_API_BASE` |
| `cennik.html` | +`window.QM_API_BASE` |
| `operator-panel.html` | +`window.QM_API_BASE` |
| `owner-panel.html` | +`window.QM_API_BASE` |
| `feed.html` | +`window.QM_API_BASE` |
| `live.html` | +`window.QM_API_BASE` |
| `market-landing.html` | +`window.QM_API_BASE` |
| `skrypty.html` | +`window.QM_API_BASE` |
| `zarabiaj.html` | +`window.QM_API_BASE` |
| `qualitetmarket.html` | +`window.QM_API_BASE` |
| `linki-sprzedazowe.html` | +`window.QM_API_BASE` |

---

*Raport wygenerowany przez GitHub Copilot Agent – 2026-03-20*
