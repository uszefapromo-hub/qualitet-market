# HurtDetalUszefaQUALITET

Link do podglądu platformy: https://uszefaqualitet.pl

## Backend API

Pełna dokumentacja backendu: [`backend/README.md`](backend/README.md)

### Szybki start (Docker Compose)

```bash
cp backend/.env.example .env   # ustaw DB_PASSWORD i JWT_SECRET
docker compose up --build
# API dostępne pod http://localhost:3000
```

### Szybki start (lokalnie)

```bash
cd backend
npm install
cp .env.example .env   # uzupełnij dane DB i JWT_SECRET
createdb hurtdetal_qualitet
npm run migrate
npm run dev
```

### Migracje

| Plik | Tabele |
|------|--------|
| `001_initial_schema.sql` | `users`, `subscriptions`, `suppliers`, `stores`, `products`, `orders`, `order_items` |
| `002_extended_schema.sql` | `categories`, `product_images`, `shop_products`, `carts`, `cart_items`, `payments`, `audit_logs` |

### Frontend API client

Plik `js/api.js` udostępnia klienta REST API jako `window.QMApi` (albo moduł ES/CommonJS).
Umożliwia stopniowe zastąpienie odczytów z `localStorage` wywołaniami API:

```html
<script>window.QM_API_BASE = 'https://api.uszefaqualitet.pl/api';</script>
<script src="js/api.js"></script>
<script>
  // Logowanie
  const { token, user } = await QMApi.Auth.login(email, password);

  // Koszyk
  const cart = await QMApi.Cart.get(storeId);
  await QMApi.Cart.addItem(storeId, productId, 1);

  // Zamówienie
  const order = await QMApi.Orders.create({
    store_id: storeId,
    items: [{ product_id, quantity: 1 }],
    shipping_address: '...',
  });
</script>
```

Pełna checklist migracji localStorage→API: [`backend/README.md#checklist`](backend/README.md)
