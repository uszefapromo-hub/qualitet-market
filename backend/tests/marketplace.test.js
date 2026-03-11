'use strict';

/**
 * Marketplace tests: categories, shop_products (marketplace model), cart, orders.
 * Uses an in-memory mock DB – no real PostgreSQL required.
 */

const request = require('supertest');

const mockDb = {
  users: [],
  stores: [],
  products: [],
  categories: [],
  shop_products: [],
  carts: [],
  cart_items: [],
  orders: [],
  order_items: [],
  audit_logs: [],
};

jest.mock('../src/config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));

const db = require('../src/config/database');

function setupDbMock() {
  db.query.mockImplementation(async (sql, params = []) => {
    const s = sql.trim().replace(/\s+/g, ' ').toLowerCase();

    // ── audit_logs (fire-and-forget) ──
    if (s.startsWith('insert into audit_logs')) return { rows: [] };
    if (s.startsWith('select count(*)') && s.includes('from audit_logs'))
      return { rows: [{ count: String(mockDb.audit_logs.length) }] };
    if (s.includes('from audit_logs al'))
      return { rows: mockDb.audit_logs.map((l) => ({ ...l, actor_email: null, actor_name: null })) };

    // ── users ──
    if (s.includes('from users where email')) {
      const row = mockDb.users.find((u) => u.email === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from users where id')) {
      const row = mockDb.users.find((u) => u.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select count(*)') && s.includes('from users')) {
      const where = s.includes('where') && params[0];
      const filtered = where ? mockDb.users.filter((u) => u.role === params[0]) : mockDb.users;
      return { rows: [{ count: String(filtered.length) }] };
    }
    if (s.includes('from users') && s.includes('order by') && s.includes('limit')) {
      return { rows: mockDb.users.map((u) => ({ ...u, password_hash: undefined })) };
    }
    if (s.startsWith('insert into users')) {
      const [id, email, password_hash, name, role] = params;
      const user = { id, email, password_hash, name, role, plan: 'trial' };
      mockDb.users.push(user);
      return { rows: [user] };
    }

    // ── categories ──
    if (s.includes('from categories where id')) {
      const row = mockDb.categories.find((c) => c.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from categories where slug')) {
      const row = mockDb.categories.find((c) => c.slug === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes("from categories where status = 'active'") || s.includes("where active = true"))
      return { rows: mockDb.categories.filter((c) => c.status === 'active' || c.active) };
    if (s.startsWith('insert into categories')) {
      const cat = { id: params[0], name: params[1], slug: params[2], parent_id: params[3],
        description: params[4], icon: params[5], sort_order: params[6], status: 'active', active: true };
      mockDb.categories.push(cat);
      return { rows: [cat] };
    }

    // ── stores ──
    if (s.includes("from stores where slug")) {
      const row = mockDb.stores.find((st) => st.slug === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from stores where id')) {
      const row = mockDb.stores.find((st) => st.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from stores where owner_id')) {
      return { rows: mockDb.stores.filter((st) => st.owner_id === params[0] && st.status !== 'suspended') };
    }
    if (s.startsWith('select count(*)') && s.includes('from stores'))
      return { rows: [{ count: String(mockDb.stores.length) }] };
    if (s.startsWith('insert into stores')) {
      const [id, owner_id, name, slug] = params;
      const store = { id, owner_id, name, slug, status: 'active', margin: 15 };
      mockDb.stores.push(store);
      return { rows: [store] };
    }

    // ── products ──
    if (s.includes('from products') && s.includes('where id = $1')) {
      const row = mockDb.products.find((p) => p.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into products')) {
      const p = { id: params[0], store_id: params[1] || null, name: params[2],
        price_gross: params[3] || 100, price_net: params[4] || 81.3, tax_rate: 23,
        sku: params[5] || null, stock: params[6] || 10, image_url: null,
        category_id: null, status: 'active', selling_price: params[3] || 100, margin: 15 };
      mockDb.products.push(p);
      return { rows: [p] };
    }
    if (s.startsWith('update products set stock')) {
      const p = mockDb.products.find((pr) => pr.id === params[1]);
      if (p) p.stock -= params[0];
      return { rows: [] };
    }

    // ── shop_products – PATCH ownership (has p.price_gross in SELECT + joins stores) ──
    if (s.includes('from shop_products sp') && s.includes('p.price_gross') && s.includes('join stores s')) {
      const sp = mockDb.shop_products.find((x) => x.id === params[0]);
      if (!sp) return { rows: [] };
      const store = mockDb.stores.find((st) => st.id === sp.store_id) || {};
      const product = mockDb.products.find((p) => p.id === sp.product_id) || {};
      return { rows: [{ ...sp, owner_id: store.owner_id, price_gross: product.price_gross }] };
    }
    // ── shop_products – DELETE ownership (joins stores only) ──
    if (s.includes('from shop_products sp') && s.includes('join stores s') && !s.includes('join products p')) {
      const sp = mockDb.shop_products.find((x) => x.id === params[0]);
      if (!sp) return { rows: [] };
      const store = mockDb.stores.find((st) => st.id === sp.store_id) || {};
      return { rows: [{ id: sp.id, owner_id: store.owner_id }] };
    }
    // ── shop_products – cart validation (has global_product_id) ──
    if (s.includes('from shop_products sp') && s.includes('global_product_id')) {
      const sp = mockDb.shop_products.find((x) => x.id === params[0]);
      if (!sp) return { rows: [] };
      const p = mockDb.products.find((x) => x.id === sp.product_id) || {};
      return { rows: [{ ...sp, stock: p.stock, global_product_id: p.id }] };
    }
    // ── shop_products – my store listing (WHERE sp.store_id, NO active filter) ──
    if (s.includes('from shop_products sp') && s.includes('join products p') && s.includes('where sp.store_id') && !s.includes('and sp.active')) {
      return {
        rows: mockDb.shop_products.filter((sp) => sp.store_id === params[0]).map((sp) => {
          const p = mockDb.products.find((pr) => pr.id === sp.product_id) || {};
          return { ...sp, base_name: p.name, sku: p.sku, price_net: p.price_net, price_gross: p.price_gross, stock: p.stock };
        }),
      };
    }
    // ── shop_products – shops/:slug/products COUNT ──
    if (s.includes('count(*)') && s.includes('from shop_products sp') && s.includes('join products p'))
      return { rows: [{ count: String(mockDb.shop_products.filter((sp) => sp.store_id === params[0] && sp.active && sp.status === 'active').length) }] };
    // ── shop_products – shops/:slug/products listing (WITH active filter) ──
    if (s.includes('from shop_products sp') && s.includes('join products p') && s.includes('and sp.active')) {
      return {
        rows: mockDb.shop_products
          .filter((sp) => sp.store_id === params[0] && sp.active && sp.status === 'active')
          .map((sp) => {
            const p = mockDb.products.find((pr) => pr.id === sp.product_id) || {};
            return { ...sp, title: sp.custom_title || p.name, description: p.description,
              price_gross: p.price_gross, stock: p.stock };
          }),
      };
    }
    if (s.startsWith('select count(*)') && s.includes('from shop_products'))
      return { rows: [{ count: String(mockDb.shop_products.filter((x) => !params[0] || x.store_id === params[0]).length) }] };
    if (s.includes('from shop_products where store_id') && s.includes('and product_id')) {
      const row = mockDb.shop_products.find((x) => x.store_id === params[0] && x.product_id === params[1]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into shop_products')) {
      const sp = {
        id: params[0], store_id: params[1], product_id: params[2],
        custom_title: params[3], custom_description: params[4],
        margin_type: params[5], margin_value: params[6], selling_price: params[7],
        active: true, status: 'active',
        source_snapshot: params[8] ? JSON.parse(params[8]) : null,
      };
      mockDb.shop_products.push(sp);
      return { rows: [sp] };
    }
    if (s.startsWith('update shop_products set') && s.includes('where id')) {
      const id = params[params.length - 1];
      const sp = mockDb.shop_products.find((x) => x.id === id);
      if (sp) {
        if (params[0] !== null) sp.custom_title = params[0];
        if (params[1] !== null) sp.custom_description = params[1];
        if (params[2] !== null) sp.margin_type = params[2];
        if (params[3] !== null) sp.margin_value = params[3];
        if (params[4] !== null) sp.selling_price = params[4];
        if (params[5] !== null) sp.active = params[5];
        if (params[6] !== null) sp.status = params[6];
      }
      return { rows: sp ? [sp] : [] };
    }
    if (s.startsWith('delete from shop_products')) {
      const idx = mockDb.shop_products.findIndex((x) => x.id === params[0]);
      if (idx !== -1) mockDb.shop_products.splice(idx, 1);
      return { rows: [] };
    }

    // ── carts ──
    if (s.includes('from carts c') && s.includes('where c.id')) {
      const cart = mockDb.carts.find((c) => c.id === params[0]);
      if (!cart) return { rows: [] };
      const store = mockDb.stores.find((st) => st.id === cart.store_id) || {};
      return { rows: [{ ...cart, shop_name: store.name, shop_slug: store.slug }] };
    }
    if (s.includes('from carts c') && s.includes("status = 'active'") && s.includes('order by')) {
      const row = mockDb.carts.find((c) => c.user_id === params[0] && c.status === 'active');
      if (!row) return { rows: [] };
      const store = mockDb.stores.find((st) => st.id === row.store_id) || {};
      return { rows: [{ ...row, shop_name: store.name, shop_slug: store.slug }] };
    }
    if (s.includes('from carts where user_id') && s.includes("status = 'active'")) {
      const row = mockDb.carts.find((c) => c.user_id === params[0] && c.store_id === params[1] && c.status === 'active');
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into carts')) {
      const cart = { id: params[0], user_id: params[1], store_id: params[2], status: 'active' };
      mockDb.carts.push(cart);
      return { rows: [cart] };
    }
    if (s.startsWith('update carts set')) {
      return { rows: [] };
    }

    // ── cart_items ──
    if (s.includes('from cart_items ci') && s.includes('where ci.cart_id')) {
      return {
        rows: mockDb.cart_items.filter((ci) => ci.cart_id === params[0]).map((ci) => {
          const sp = mockDb.shop_products.find((x) => x.id === ci.shop_product_id) || {};
          const p = mockDb.products.find((x) => x.id === ci.product_id) || {};
          return { ...ci, product_title: sp.custom_title || p.name || 'Product', image_url: p.image_url };
        }),
      };
    }
    if (s.includes('from cart_items ci') && s.includes('join carts c') && s.includes('where ci.id')) {
      const ci = mockDb.cart_items.find((x) => x.id === params[0]);
      if (!ci) return { rows: [] };
      const cart = mockDb.carts.find((c) => c.id === ci.cart_id) || {};
      return { rows: [{ id: ci.id, user_id: cart.user_id }] };
    }
    if (s.includes('from cart_items') && s.includes('where cart_id') && s.includes('shop_product_id')) {
      const row = mockDb.cart_items.find((ci) => ci.cart_id === params[0] && ci.shop_product_id === params[1]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into cart_items')) {
      const ci = { id: params[0], cart_id: params[1], product_id: params[2],
        shop_product_id: params[3], quantity: params[4], unit_price: params[5] };
      mockDb.cart_items.push(ci);
      return { rows: [ci] };
    }
    if (s.startsWith('update cart_items set quantity')) {
      const id = params[params.length - 1];
      const ci = mockDb.cart_items.find((x) => x.id === id);
      if (ci) ci.quantity = params[0];
      return { rows: [] };
    }
    if (s.startsWith('delete from cart_items where id')) {
      const idx = mockDb.cart_items.findIndex((x) => x.id === params[0]);
      if (idx !== -1) mockDb.cart_items.splice(idx, 1);
      return { rows: [] };
    }
    if (s.startsWith('delete from cart_items where cart_id')) {
      mockDb.cart_items = mockDb.cart_items.filter((x) => x.cart_id !== params[0]);
      return { rows: [] };
    }

    // ── orders ──
    if (s.startsWith('select count(*)') && s.includes('from orders'))
      return { rows: [{ count: String(mockDb.orders.length) }] };
    if (s.includes('from orders') && s.includes('where id')) {
      const row = mockDb.orders.find((o) => o.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from orders') && s.includes('order by') && s.includes('limit'))
      return { rows: mockDb.orders };
    if (s.startsWith('insert into orders')) {
      const order = { id: params[0], store_id: params[1], store_owner_id: params[2],
        buyer_id: params[3], status: 'pending', subtotal: params[4], total: params[6],
        shipping_address: params[7] };
      mockDb.orders.push(order);
      return { rows: [order] };
    }
    if (s.startsWith('insert into order_items')) {
      const oi = { id: params[0], order_id: params[1], product_id: params[2],
        name: params[3], quantity: params[4], unit_price: params[5], line_total: params[6] };
      mockDb.order_items.push(oi);
      return { rows: [oi] };
    }
    if (s.includes('from order_items where order_id'))
      return { rows: mockDb.order_items.filter((oi) => oi.order_id === params[0]) };

    return { rows: [] };
  });

  db.transaction.mockImplementation(async (fn) => {
    const client = { query: db.query };
    await fn(client);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return require('crypto').randomUUID();
}

// Creates a user in mockDb and returns a signed JWT directly (no HTTP login).
// This avoids hitting the rate-limited /api/users/login endpoint.
function createUserAndToken(role = 'seller') {
  const { signToken } = require('../src/middleware/auth');
  const userId = uuid();
  const email = `test-${userId}@example.com`;
  mockDb.users.push({ id: userId, email, password_hash: 'x', name: 'Test User', role, plan: 'basic' });
  const token = signToken({ id: userId, email, role });
  return { token, userId };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let app;

beforeAll(() => {
  process.env.JWT_SECRET = 'test_secret';
  process.env.NODE_ENV = 'test';
  setupDbMock();
  app = require('../src/app');
});

beforeEach(() => {
  mockDb.users = [];
  mockDb.stores = [];
  mockDb.products = [];
  mockDb.categories = [];
  mockDb.shop_products = [];
  mockDb.carts = [];
  mockDb.cart_items = [];
  mockDb.orders = [];
  mockDb.order_items = [];
  mockDb.audit_logs = [];
  setupDbMock();
});

// ── Categories ────────────────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('returns empty list when no categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns active categories', async () => {
    mockDb.categories.push({ id: uuid(), name: 'Elektronika', slug: 'elektronika', status: 'active', active: true });
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('POST /api/categories', () => {
  it('requires admin role', async () => {
    const { token } = createUserAndToken('buyer');
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', slug: 'test' });
    expect(res.status).toBe(403);
  });

  it('creates category as owner', async () => {
    const { token } = createUserAndToken('owner');
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Elektronika', slug: 'elektronika' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('elektronika');
  });

  it('rejects duplicate slug', async () => {
    const { token } = createUserAndToken('owner');
    mockDb.categories.push({ id: uuid(), slug: 'duplikat', status: 'active', active: true });
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplikat', slug: 'duplikat' });
    expect(res.status).toBe(409);
  });
});

// ── Shop products – public browsing ───────────────────────────────────────────

describe('GET /api/shops/:slug/products', () => {
  it('returns 404 for unknown shop slug', async () => {
    const res = await request(app).get('/api/shops/nieznany-sklep/products');
    expect(res.status).toBe(404);
  });

  it('returns products for active shop', async () => {
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: uuid(), name: 'Sklep ABC', slug: 'sklep-abc', status: 'active', margin: 15 });
    mockDb.products.push({ id: productId, name: 'Telefon', price_gross: 1000, price_net: 813, tax_rate: 23, stock: 5, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      custom_title: null, selling_price: 1150, margin_type: 'percent', margin_value: 15,
      active: true, status: 'active' });

    const res = await request(app).get('/api/shops/sklep-abc/products');
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
    expect(res.body.store.slug).toBe('sklep-abc');
  });
});

// ── My store products ─────────────────────────────────────────────────────────

describe('GET /api/my/store/products', () => {
  it('returns 404 if seller has no store', async () => {
    const { token } = createUserAndToken('seller');
    const res = await request(app)
      .get('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns seller products', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active', margin: 15 });
    mockDb.products.push({ id: productId, name: 'Produkt A', price_gross: 100, stock: 10, status: 'active' });
    mockDb.shop_products.push({ id: uuid(), store_id: storeId, product_id: productId,
      selling_price: 115, margin_type: 'percent', margin_value: 15, active: true, status: 'active' });

    const res = await request(app)
      .get('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBe(1);
  });
});

describe('POST /api/my/store/products', () => {
  it('requires seller/owner/admin role', async () => {
    const { token } = createUserAndToken('buyer');
    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: uuid() });
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/my/store/products').send({ product_id: uuid() });
    expect(res.status).toBe(401);
  });

  it('returns 404 if seller has no store', async () => {
    const { token } = createUserAndToken('seller');
    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: uuid() });
    expect(res.status).toBe(404);
  });

  it('creates shop_product with computed selling_price', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Sklep', slug: 'sklep', status: 'active', margin: 15 });
    mockDb.products.push({ id: productId, name: 'Laptop', price_gross: 1000, price_net: 813,
      tax_rate: 23, sku: 'LAP-1', stock: 5, image_url: null, category_id: null, status: 'active' });

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: productId, margin_type: 'percent', margin_value: 25 });

    expect(res.status).toBe(201);
    expect(res.body.selling_price).toBe(1250); // 1000 * 1.25
    expect(mockDb.shop_products.length).toBe(1);
  });

  it('creates shop_product with fixed margin', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Sklep2', slug: 'sklep2', status: 'active', margin: 10 });
    mockDb.products.push({ id: productId, name: 'Kabel', price_gross: 50, price_net: 40,
      tax_rate: 23, sku: null, stock: 100, image_url: null, category_id: null, status: 'active' });

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: productId, margin_type: 'fixed', margin_value: 10 });

    expect(res.status).toBe(201);
    expect(res.body.selling_price).toBe(60); // 50 + 10
  });

  it('rejects duplicate shop_product', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Sklep3', slug: 'sklep3', status: 'active', margin: 15 });
    mockDb.products.push({ id: productId, name: 'Koszulka', price_gross: 80, price_net: 65,
      tax_rate: 23, sku: null, stock: 20, image_url: null, category_id: null, status: 'active' });
    mockDb.shop_products.push({ id: uuid(), store_id: storeId, product_id: productId,
      selling_price: 92, active: true, status: 'active' });

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: productId });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/my/store/products/:id', () => {
  it('returns 403 for non-owner', async () => {
    const { token } = createUserAndToken('seller');
    const otherStoreId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: otherStoreId, owner_id: uuid(), name: 'Inny Sklep', slug: 'inny', status: 'active', margin: 10 });
    mockDb.products.push({ id: productId, price_gross: 100, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: otherStoreId, product_id: productId,
      margin_type: 'percent', margin_value: 10, selling_price: 110, active: true, status: 'active' });

    const res = await request(app)
      .patch(`/api/my/store/products/${spId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ custom_title: 'Nowy tytuł' });
    expect(res.status).toBe(403);
  });

  it('updates custom_title', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Mój Sklep', slug: 'moj', status: 'active', margin: 10 });
    mockDb.products.push({ id: productId, price_gross: 200, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      custom_title: null, margin_type: 'percent', margin_value: 10, selling_price: 220, active: true, status: 'active' });

    const res = await request(app)
      .patch(`/api/my/store/products/${spId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ custom_title: 'Mój tytuł' });
    expect(res.status).toBe(200);
    expect(mockDb.shop_products[0].custom_title).toBe('Mój tytuł');
  });
});

describe('DELETE /api/my/store/products/:id', () => {
  it('deletes own shop_product', async () => {
    const { token, userId } = createUserAndToken('seller');
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: userId, name: 'Sklep Del', slug: 'del', status: 'active', margin: 10 });
    mockDb.products.push({ id: productId, price_gross: 100, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      selling_price: 110, active: true, status: 'active' });

    const res = await request(app)
      .delete(`/api/my/store/products/${spId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockDb.shop_products.length).toBe(0);
  });
});

// ── Cart ──────────────────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  it('returns null cart when none exists', async () => {
    const { token } = createUserAndToken('buyer');
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cart).toBeNull();
  });

  it('returns active cart with items', async () => {
    const { token, userId } = createUserAndToken('buyer');
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    const cartId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: uuid(), name: 'Sklep', slug: 'sklep', status: 'active' });
    mockDb.products.push({ id: productId, name: 'Towar', price_gross: 100, stock: 5 });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      custom_title: 'Mój Towar', selling_price: 115, active: true, status: 'active' });
    mockDb.carts.push({ id: cartId, user_id: userId, store_id: storeId, status: 'active' });
    mockDb.cart_items.push({ id: uuid(), cart_id: cartId, product_id: productId,
      shop_product_id: spId, quantity: 2, unit_price: 115 });

    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cart.items.length).toBe(1);
    expect(res.body.cart.subtotal).toBe(230);
  });
});

describe('POST /api/cart', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/cart').send({ shop_product_id: uuid(), quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unavailable shop_product', async () => {
    const { token } = createUserAndToken('buyer');
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ shop_product_id: uuid(), quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('creates cart and adds item', async () => {
    const { token, userId } = createUserAndToken('buyer');
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: uuid(), name: 'Sklep', slug: 'sklep', status: 'active' });
    mockDb.products.push({ id: productId, name: 'Słuchawki', price_gross: 200, stock: 10, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      selling_price: 230, active: true, status: 'active' });

    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ shop_product_id: spId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(mockDb.carts.length).toBe(1);
    expect(mockDb.cart_items.length).toBe(1);
    expect(mockDb.cart_items[0].quantity).toBe(2);
  });

  it('rejects quantity exceeding stock', async () => {
    const { token } = createUserAndToken('buyer');
    const storeId = uuid();
    const productId = uuid();
    const spId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: uuid(), name: 'Sklep2', slug: 'sklep2', status: 'active' });
    mockDb.products.push({ id: productId, name: 'Drogi Sprzęt', price_gross: 5000, stock: 1, status: 'active' });
    mockDb.shop_products.push({ id: spId, store_id: storeId, product_id: productId,
      selling_price: 5500, active: true, status: 'active' });

    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ shop_product_id: spId, quantity: 5 });
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/cart/items/:itemId', () => {
  it('removes own cart item', async () => {
    const { token, userId } = createUserAndToken('buyer');
    const storeId = uuid();
    const cartId = uuid();
    const itemId = uuid();
    mockDb.stores.push({ id: storeId, owner_id: uuid(), name: 'S', slug: 's', status: 'active' });
    mockDb.carts.push({ id: cartId, user_id: userId, store_id: storeId, status: 'active' });
    mockDb.cart_items.push({ id: itemId, cart_id: cartId, product_id: uuid(),
      shop_product_id: uuid(), quantity: 1, unit_price: 100 });

    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(mockDb.cart_items.length).toBe(0);
  });

  it('returns 403 for another user cart item', async () => {
    const { token } = createUserAndToken('buyer');
    const cartId = uuid();
    const itemId = uuid();
    const otherUserId = uuid();
    mockDb.carts.push({ id: cartId, user_id: otherUserId, store_id: uuid(), status: 'active' });
    mockDb.cart_items.push({ id: itemId, cart_id: cartId, product_id: uuid(),
      shop_product_id: null, quantity: 1, unit_price: 50 });

    const res = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ── Admin audit-logs with filtering ──────────────────────────────────────────

describe('GET /api/admin/audit-logs', () => {
  it('requires admin role', async () => {
    const { token } = createUserAndToken('buyer');
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns audit logs as admin', async () => {
    const { token } = createUserAndToken('admin');
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(res.body).toHaveProperty('total');
  });
});

describe('GET /api/admin/orders', () => {
  it('returns orders with store/buyer info', async () => {
    const { token } = createUserAndToken('admin');
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
  });
});

describe('PATCH /api/admin/orders/:id/status', () => {
  it('returns 404 for non-existent order', async () => {
    const { token } = createUserAndToken('admin');
    const res = await request(app)
      .patch(`/api/admin/orders/${uuid()}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(404);
  });
});
