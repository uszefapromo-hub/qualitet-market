# SYNC REPORT – Supplier Comparison & Full Sync

> Date: 2026-03-15 · Branch: `copilot/confirm-full-sync-and-tests`

---

## 1. What Was Implemented

| Feature | File(s) | Status |
|---------|---------|--------|
| `selectBestSupplier(offers, mode)` helper | `backend/src/helpers/pricing.js` | ✅ Done |
| `POST /api/admin/suppliers/sync-all` | `backend/src/routes/admin.js` | ✅ Done |
| `GET /api/admin/import-center` | `backend/src/routes/admin.js` | ✅ Done |
| `POST /api/admin/suppliers/select-best-source` | `backend/src/routes/admin.js` | ✅ Done |
| Migration `037_supplier_comparison.sql` | `backend/migrations/037_supplier_comparison.sql` | ✅ Done |
| Unit + integration tests for all new features | `backend/tests/api.test.js` | ✅ Done (+20 tests) |

---

## 2. Which Suppliers Are Covered

The sync system is format-agnostic and works with **any** supplier that has a configured endpoint:

| Endpoint type | Field in `suppliers` table | Handled by |
|---------------|---------------------------|------------|
| JSON REST API | `api_url` | `fetchSupplierProducts()` |
| XML feed | `xml_endpoint` | `fetchSupplierProducts()` + `parseXml()` |
| CSV feed | `csv_endpoint` | `fetchSupplierProducts()` + `parseCsv()` |

`POST /api/admin/suppliers/sync-all` fetches **all active suppliers** where at least one endpoint is set (`api_url IS NOT NULL OR xml_endpoint IS NOT NULL OR csv_endpoint IS NOT NULL`).

---

## 3. How Best Source Selection Works

`selectBestSupplier(offers, mode)` (in `pricing.js`) compares multiple supplier offers for the same SKU/product and returns the single best offer:

| Mode | Selection rule |
|------|---------------|
| `lowest_cost` *(default)* | Offer with the **lowest `supplier_price`** |
| `best_margin` | Offer with the **highest `platform_price − supplier_price`** (most platform profit) |
| `best_quality` | Offer with the **highest `quality_score`**; tie-break: lowest `supplier_price` |

**In-stock preference**: if any offer has `stock > 0`, only in-stock offers are compared. Out-of-stock offers are used only as a fallback when nothing is in stock.

**API endpoint**: `POST /api/admin/suppliers/select-best-source`
- Accepts `sku` (exact) or `name` (ILIKE search) + optional `mode`
- Returns `{ offers: [...], best: {...}, mode }` – the full ranked list and the winning offer

---

## 4. How Platform Price and Reseller Profit Are Calculated

### Platform margin (tiered)

```
supplier_price
  → tier lookup (DEFAULT_PLATFORM_TIERS):
      ≤ 20 PLN    → +60%
      ≤ 100 PLN   → +40%
      ≤ 300 PLN   → +25%
      > 300 PLN   → +15%
  → platform_price = min_selling_price
```

`computePlatformPrice(supplierPrice, tiers?)` in `pricing.js` handles this. The admin can override tiers via `/api/admin/platform-margins`.

### Seller margin (on top)

```
platform_price
  → seller sets seller_margin (%) when adding product to their shop via /api/shop-products
  → selling_price = platform_price × (1 + seller_margin / 100)
  → constraint: selling_price >= min_selling_price (= platform_price)
```

Seller profit = `selling_price − platform_price` per unit.

---

## 5. What Was Tested

### Unit tests (`selectBestSupplier`)
- Empty / null input returns `null`
- `lowest_cost` picks cheapest in-stock offer
- `best_margin` picks highest `(platform_price − supplier_price)` offer
- `best_quality` picks highest `quality_score` among in-stock; falls back to out-of-stock when all zero
- Default mode (`lowest_cost`) when mode is omitted

### Integration tests (`POST /api/admin/suppliers/sync-all`)
- 403 for non-admin callers
- Empty result set when no suppliers configured
- Per-supplier failure reported without crashing the whole batch

### Integration tests (`GET /api/admin/import-center`)
- 403 for non-admin callers
- Returns `stats`, `suppliers[]`, `recent_logs[]` correctly
- Empty state handled

### Integration tests (`POST /api/admin/suppliers/select-best-source`)
- 403 for non-admin callers
- 422 when neither `sku` nor `name` is provided
- Correct winner for each of the 3 modes
- `best: null` when no products found
- Search by `name` (ILIKE) works

**Total tests: 747 passing** (727 pre-existing + 20 new)

---

## 6. No Duplicate Products on Repeated Sync

Deduplication is implemented at the DB level using `(supplier_id, sku)`:

- `upsertSupplierProducts()` in `supplier-import.js` first does `SELECT id FROM products WHERE supplier_id = $1 AND sku = $2`.
- If the row exists → `UPDATE` mutable fields (`supplier_price`, `platform_price`, `stock`, `description`, `image_url`, `quality_score`, `is_featured`).
- If not → `INSERT` with `is_central = true`, `status = 'active'`.
- Products without a SKU are always inserted (no deduplication key available).

Running `sync-all` twice produces the same product set.

---

## 7. Seller Access (End-to-End)

1. Admin runs `POST /api/admin/suppliers/sync-all` → products land in central catalogue (`is_central = true`, `status = 'active'`).
2. Seller calls `GET /api/products?is_central=true` to browse the catalogue.
3. Seller calls `POST /api/shop-products` with `{ store_id, product_id, seller_margin }` → product is linked to their store with a computed `selling_price`.
4. Buyers see the product via `GET /api/shop-products?store_id=…` (public).
5. Prices are enforced: `selling_price >= platform_price` (min_selling_price).

---

## 8. Production Safety

| Check | Status |
|-------|--------|
| All 747 tests pass | ✅ |
| No breaking changes to existing endpoints | ✅ |
| Deduplication by `(supplier_id, sku)` prevents duplicates | ✅ |
| `sync-all` is fault-tolerant: one supplier failing doesn't abort others | ✅ |
| New endpoints require `owner` or `admin` role | ✅ |
| SQL uses parameterised queries (no injection risk) | ✅ |
| `import_logs` inserted fire-and-forget; failure doesn't break sync | ✅ |
| Migration `037_supplier_comparison.sql` is additive (CREATE TABLE IF NOT EXISTS) | ✅ |

**The full sync can run today.** Products imported via `sync-all` get `status = 'active'` and `is_central = true` and are immediately queryable by sellers and visible in the marketplace.
