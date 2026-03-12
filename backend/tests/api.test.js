'use strict';

/**
 * Integration tests for the REST API.
 *
 * These tests use an in-memory mock of the database layer (src/config/database.js)
 * so no real PostgreSQL connection is required to run them.
 */

const request = require('supertest');
const bcrypt = require('bcryptjs');

// ─── Mock database ─────────────────────────────────────────────────────────────
const mockDb = {
  users: [],
  stores: [],
  products: [],
  orders: [],
  order_items: [],
  subscriptions: [],
  suppliers: [],
  categories: [],
  carts: [],
  cart_items: [],
  payments: [],
  shop_products: [],
  audit_logs: [],
};

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

const db = require('../src/config/database');

// Helper: make db.query return rows from our in-memory store
function setupDbMock() {
  db.query.mockImplementation(async (sql, params = []) => {
    const s = sql.trim().replace(/\s+/g, ' ').toLowerCase();

    // ── users ──
    if (s.startsWith('select') && s.includes('from users where email')) {
      const email = params[0];
      const row = mockDb.users.find((u) => u.email === email);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from users where id')) {
      const id = params[0];
      const row = mockDb.users.find((u) => u.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select count(*)') && s.includes('from users')) {
      return { rows: [{ count: String(mockDb.users.length) }] };
    }
    if (s.startsWith('select') && s.includes('from users order by')) {
      return { rows: mockDb.users.slice(params[1], params[1] + params[0]) };
    }
    if (s.startsWith('insert into users')) {
      const [id, email, password_hash, name, role] = params;
      const user = { id, email, password_hash, name, role, plan: 'trial' };
      mockDb.users.push(user);
      return { rows: [user] };
    }
    if (s.startsWith('update users set') && s.includes('where id')) {
      const id = params[params.length - 1];
      const user = mockDb.users.find((u) => u.id === id);
      if (user) {
        if (params[0] !== null) user.name = params[0];
        if (params[1] !== null) user.phone = params[1];
      }
      return { rows: user ? [user] : [] };
    }

    // ── stores ──
    if (s.startsWith('select count(*)') && s.includes('from stores')) {
      return { rows: [{ count: String(mockDb.stores.length) }] };
    }
    if (s.startsWith('select') && s.includes('from stores where id')) {
      const id = params[0];
      const row = mockDb.stores.find((st) => st.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from stores where slug')) {
      const slug = params[0];
      const row = mockDb.stores.find((st) => st.slug === slug);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from stores')) {
      return { rows: mockDb.stores };
    }
    if (s.startsWith('insert into stores')) {
      const [id, owner_id, name, slug, subdomain, description, margin, plan] = params;
      const store = { id, owner_id, name, slug, subdomain, description, margin, plan, status: 'active' };
      mockDb.stores.push(store);
      return { rows: [store] };
    }
    if (s.startsWith('delete from stores where id')) {
      const id = params[0];
      const idx = mockDb.stores.findIndex((st) => st.id === id);
      if (idx !== -1) mockDb.stores.splice(idx, 1);
      return { rows: idx !== -1 ? [{ id }] : [] };
    }

    // ── products ──
    if (s.startsWith('select count(*)') && s.includes('from products')) {
      return { rows: [{ count: String(mockDb.products.length) }] };
    }
    if (s.startsWith('select') && s.includes('from products where id')) {
      const id = params[0];
      const row = mockDb.products.find((p) => p.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from products')) {
      return { rows: mockDb.products };
    }
    if (s.startsWith('insert into products')) {
      const product = { id: params[0], store_id: params[1], name: params[3], price_net: params[5] };
      mockDb.products.push(product);
      return { rows: [product] };
    }
    if (s.startsWith('delete from products where id')) {
      const id = params[0];
      const idx = mockDb.products.findIndex((p) => p.id === id);
      if (idx !== -1) mockDb.products.splice(idx, 1);
      return { rows: [] };
    }

    // ── orders ──
    if (s.startsWith('select count(*)') && s.includes('from orders')) {
      return { rows: [{ count: String(mockDb.orders.length) }] };
    }
    if (s.startsWith('select') && s.includes('from orders where id')) {
      const id = params[0];
      const row = mockDb.orders.find((o) => o.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from orders')) {
      return { rows: mockDb.orders };
    }
    if (s.startsWith('select') && s.includes('from order_items')) {
      const orderId = params[0];
      return { rows: mockDb.order_items.filter((i) => i.order_id === orderId) };
    }

    // ── subscriptions ──
    if (s.startsWith('select') && s.includes('from subscriptions where user_id')) {
      const userId = params[0];
      return { rows: mockDb.subscriptions.filter((sub) => sub.user_id === userId) };
    }
    if (s.startsWith('select') && s.includes('from subscriptions')) {
      return { rows: mockDb.subscriptions };
    }
    if (s.startsWith('update subscriptions set status') && s.includes("'superseded'")) {
      return { rows: [] };
    }
    if (s.startsWith('insert into subscriptions')) {
      const sub = { id: params[0], user_id: params[1], plan: params[2], status: 'active' };
      mockDb.subscriptions.push(sub);
      return { rows: [sub] };
    }

    // ── suppliers ──
    if (s.startsWith('select') && s.includes('from suppliers')) {
      return { rows: mockDb.suppliers };
    }
    if (s.startsWith('insert into suppliers')) {
      const sup = { id: params[0], name: params[1], integration_type: params[2], active: true };
      mockDb.suppliers.push(sup);
      return { rows: [sup] };
    }

    // ── categories ──
    if (s.startsWith('select count(*)') && s.includes('from categories')) {
      return { rows: [{ count: String(mockDb.categories.length) }] };
    }
    if (s.startsWith('select') && s.includes('from categories where id')) {
      const id = params[0];
      const row = mockDb.categories.find((c) => c.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from categories where slug')) {
      const slug = params[0];
      const row = mockDb.categories.find((c) => c.slug === slug);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from categories')) {
      return { rows: mockDb.categories.filter((c) => c.active !== false) };
    }
    if (s.startsWith('insert into categories')) {
      const cat = { id: params[0], name: params[1], slug: params[2], active: true };
      mockDb.categories.push(cat);
      return { rows: [cat] };
    }
    if (s.startsWith('delete from categories where id')) {
      const id = params[0];
      const idx = mockDb.categories.findIndex((c) => c.id === id);
      if (idx !== -1) mockDb.categories.splice(idx, 1);
      return { rows: idx !== -1 ? [{ id }] : [] };
    }

    // ── carts ──
    if (s.startsWith('select') && s.includes('from carts where id')) {
      const id = params[0];
      const row = mockDb.carts.find((c) => c.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from carts where user_id')) {
      const userId = params[0];
      const storeId = params[1];
      const row = mockDb.carts.find(
        (c) => c.user_id === userId && c.store_id === storeId && c.status === 'active'
      );
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into carts')) {
      const cart = { id: params[0], user_id: params[1], store_id: params[2], status: 'active', items: [] };
      mockDb.carts.push(cart);
      return { rows: [cart] };
    }
    if (s.startsWith('update carts set updated_at')) {
      return { rows: [] };
    }
    if (s.startsWith('delete from cart_items where cart_id') && !s.includes('and product_id')) {
      const cartId = params[0];
      mockDb.cart_items = mockDb.cart_items.filter((i) => i.cart_id !== cartId);
      return { rows: [] };
    }
    if (s.startsWith('delete from cart_items where cart_id') && s.includes('and product_id')) {
      const [cartId, productId] = params;
      mockDb.cart_items = mockDb.cart_items.filter(
        (i) => !(i.cart_id === cartId && i.product_id === productId)
      );
      return { rows: [] };
    }

    // ── cart_items ──
    if (s.startsWith('select') && s.includes('from cart_items') && s.includes('join products')) {
      const cartId = params[0];
      return {
        rows: mockDb.cart_items
          .filter((i) => i.cart_id === cartId)
          .map((i) => {
            const p = mockDb.products.find((p) => p.id === i.product_id) || {};
            return { ...i, name: p.name || 'Produkt', image_url: null };
          }),
      };
    }
    if (s.startsWith('select') && s.includes('from cart_items where cart_id') && s.includes('and product_id')) {
      const [cartId, productId] = params;
      const row = mockDb.cart_items.find((i) => i.cart_id === cartId && i.product_id === productId);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into cart_items')) {
      const item = { id: params[0], cart_id: params[1], product_id: params[2], quantity: params[3], unit_price: params[4] };
      mockDb.cart_items.push(item);
      return { rows: [item] };
    }
    if (s.startsWith('update cart_items set quantity')) {
      const [qty, itemId] = params;
      const item = mockDb.cart_items.find((i) => i.id === itemId);
      if (item) item.quantity = qty;
      return { rows: item ? [item] : [] };
    }

    // ── payments ──
    if (s.startsWith('select count(*)') && s.includes('from payments')) {
      return { rows: [{ count: String(mockDb.payments.length) }] };
    }
    if (s.startsWith('select') && s.includes('from payments where id')) {
      const id = params[0];
      const row = mockDb.payments.find((p) => p.id === id);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('select') && s.includes('from payments')) {
      return { rows: mockDb.payments };
    }
    if (s.startsWith('insert into payments')) {
      const payment = {
        id: params[0], order_id: params[1], user_id: params[2],
        amount: params[3], method: params[4], status: 'pending',
      };
      mockDb.payments.push(payment);
      return { rows: [payment] };
    }
    if (s.startsWith('update payments set')) {
      const id = params[params.length - 1];
      const payment = mockDb.payments.find((p) => p.id === id);
      if (payment) payment.status = params[0];
      return { rows: payment ? [{ ...payment, order_id: 'order-1' }] : [] };
    }
    if (s.startsWith('update orders set status')) {
      return { rows: [] };
    }

    // ── admin stats ──
    if (s.startsWith('select coalesce(sum(total)') && s.includes('from orders')) {
      return { rows: [{ revenue: '0' }] };
    }
    if (s.startsWith('select count(*)') && s.includes('from orders where status')) {
      return { rows: [{ count: '0' }] };
    }
    if (s.startsWith('select count(*)') && s.includes('from stores where status')) {
      return { rows: [{ count: String(mockDb.stores.length) }] };
    }

    // ── shop_products ──
    if (s.startsWith('select count(*)') && s.includes('from shop_products')) {
      return { rows: [{ count: String(mockDb.shop_products.length) }] };
    }
    if (s.startsWith('select') && s.includes('from shop_products sp') && s.includes('join products')) {
      return { rows: mockDb.shop_products };
    }
    if (s.startsWith('select') && s.includes('from shop_products') && s.includes('where sp.id')) {
      const id = params[0];
      const row = mockDb.shop_products.find((sp) => sp.id === id);
      return { rows: row ? [{ ...row, owner_id: SELLER_ID }] : [] };
    }
    if (s.startsWith('insert into shop_products')) {
      const sp = { id: params[0], store_id: params[1], product_id: params[2], active: true };
      const existing = mockDb.shop_products.findIndex(
        (x) => x.store_id === sp.store_id && x.product_id === sp.product_id
      );
      if (existing !== -1) {
        mockDb.shop_products[existing] = { ...mockDb.shop_products[existing], ...sp };
        return { rows: [mockDb.shop_products[existing]] };
      }
      mockDb.shop_products.push(sp);
      return { rows: [sp] };
    }
    if (s.startsWith('update shop_products set')) {
      const id = params[params.length - 1];
      const sp = mockDb.shop_products.find((x) => x.id === id);
      if (sp) {
        if (params[0] !== null) sp.custom_title       = params[0];
        if (params[1] !== null) sp.custom_description = params[1];
        if (params[2] !== null) sp.margin_type        = params[2];
        if (params[3] !== null) sp.margin_override    = params[3];
        if (params[4] !== null) sp.price_override     = params[4];
        if (params[5] !== null) sp.active             = params[5];
        if (params[6] !== null) sp.sort_order         = params[6];
      }
      return { rows: sp ? [sp] : [] };
    }
    if (s.startsWith('delete from shop_products where id')) {
      const id = params[0];
      const idx = mockDb.shop_products.findIndex((sp) => sp.id === id);
      if (idx !== -1) mockDb.shop_products.splice(idx, 1);
      return { rows: [] };
    }

    // ── audit_logs ──
    if (s.startsWith('select count(*)') && s.includes('from audit_logs')) {
      return { rows: [{ count: String(mockDb.audit_logs.length) }] };
    }
    if (s.startsWith('select') && s.includes('from audit_logs')) {
      return { rows: mockDb.audit_logs };
    }

    // Catch-all
    return { rows: [] };
  });

  db.transaction.mockImplementation(async (callback) => {
    const fakeClient = { query: db.query };
    return callback(fakeClient);
  });
}

// ─── Test setup ────────────────────────────────────────────────────────────────

let app;
let sellerToken;
let adminToken;
const SELLER_ID    = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_ID     = 'a0000000-0000-4000-8000-000000000002';
const STORE_ID     = 'a0000000-0000-4000-8000-000000000003';
const PRODUCT_ID   = 'a0000000-0000-4000-8000-000000000004';
const ORDER_ID     = 'a0000000-0000-4000-8000-000000000005';
const SHOP_PROD_ID = 'a0000000-0000-4000-8000-000000000006';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret';
  process.env.NODE_ENV = 'test';

  setupDbMock();

  app = require('../src/app');

  const { signToken } = require('../src/middleware/auth');
  sellerToken = signToken({ id: SELLER_ID, email: 'seller@test.pl', role: 'seller' });
  adminToken  = signToken({ id: ADMIN_ID,  email: 'admin@test.pl',  role: 'owner'  });

  // Pre-seed users
  const hash = await bcrypt.hash('Password123!', 12);
  mockDb.users.push({ id: SELLER_ID, email: 'seller@test.pl', password_hash: hash, name: 'Seller', role: 'seller', plan: 'basic' });
  mockDb.users.push({ id: ADMIN_ID,  email: 'admin@test.pl',  password_hash: hash, name: 'Admin',  role: 'owner',  plan: 'elite' });

  // Pre-seed a store
  mockDb.stores.push({ id: STORE_ID, owner_id: SELLER_ID, name: 'Mój Sklep', slug: 'moj-sklep', margin: 15, plan: 'basic', status: 'active' });

  // Pre-seed a product
  mockDb.products.push({ id: PRODUCT_ID, store_id: STORE_ID, name: 'Fotel', price_net: 100, selling_price: 141.45, stock: 10, margin: 15 });

  // Pre-seed an order
  mockDb.orders.push({ id: ORDER_ID, store_id: STORE_ID, store_owner_id: SELLER_ID, buyer_id: SELLER_ID, status: 'created', total: 141.45 });

  // Pre-seed a shop product
  mockDb.shop_products.push({ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true, sort_order: 0 });
});

afterEach(() => {
  jest.resetAllMocks();
  setupDbMock();
});

// ─── Health check ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── Users ─────────────────────────────────────────────────────────────────────

describe('POST /api/users/register', () => {
  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/users/register').send({
      email: 'not-an-email',
      password: 'Password123!',
      name: 'Test',
    });
    expect(res.status).toBe(422);
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/api/users/register').send({
      email: 'new@test.pl',
      password: 'abc',
      name: 'Test',
    });
    expect(res.status).toBe(422);
  });

  it('registers a new user and returns token', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // SELECT – no duplicate
      .mockResolvedValueOnce({ rows: [{ id: 'new-id', email: 'new@test.pl', name: 'New', role: 'buyer', plan: 'trial' }] }); // INSERT

    const res = await request(app).post('/api/users/register').send({
      email: 'new@test.pl',
      password: 'Password123!',
      name: 'New User',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('rejects duplicate email with 409', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    const res = await request(app).post('/api/users/register').send({
      email: 'seller@test.pl',
      password: 'Password123!',
      name: 'Dup',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/users/login', () => {
  it('returns 401 for wrong email', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/users/login').send({ email: 'nobody@test.pl', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns token for correct credentials', async () => {
    const hash = await bcrypt.hash('Password123!', 12);
    db.query.mockResolvedValueOnce({
      rows: [{ id: SELLER_ID, email: 'seller@test.pl', password_hash: hash, name: 'Seller', role: 'seller', plan: 'basic' }],
    });

    const res = await request(app).post('/api/users/login').send({ email: 'seller@test.pl', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/users/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile when authenticated', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: SELLER_ID, email: 'seller@test.pl', name: 'Seller', role: 'seller', plan: 'basic' }],
    });
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('seller@test.pl');
  });
});

// ─── Stores ────────────────────────────────────────────────────────────────────

describe('GET /api/stores', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/stores');
    expect(res.status).toBe(401);
  });

  it('returns stores for seller', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', owner_id: SELLER_ID }] });

    const res = await request(app).get('/api/stores').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stores).toHaveLength(1);
  });
});

describe('POST /api/stores', () => {
  it('requires seller role', async () => {
    const { signToken } = require('../src/middleware/auth');
    const buyerToken = signToken({ id: 'buyer-id', email: 'buyer@test.pl', role: 'buyer' });
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ name: 'Shop', slug: 'shop' });
    expect(res.status).toBe(403);
  });

  it('creates a store for seller', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // slug check
      .mockResolvedValueOnce({ rows: [{ id: 'new-store', name: 'New Store', slug: 'new-store', owner_id: SELLER_ID }] });

    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'New Store', slug: 'new-store' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Store');
  });
});

// ─── Products ──────────────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('is public and returns product list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
  });
});

describe('POST /api/products', () => {
  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Produkt' }); // missing store_id and price_net
    expect(res.status).toBe(422);
  });

  it('creates a product when store is owned by user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID, margin: 15 }] }) // store lookup
      .mockResolvedValueOnce({ rows: [{ id: 'prod-1', name: 'Fotel', store_id: STORE_ID }] }); // insert

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, name: 'Fotel', price_net: 100 });
    expect(res.status).toBe(201);
  });
});

// ─── Subscriptions ─────────────────────────────────────────────────────────────

describe('POST /api/subscriptions', () => {
  it('rejects invalid plan', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_id: STORE_ID, plan: 'diamond' });
    expect(res.status).toBe(422);
  });

  it('creates a subscription', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership check
      .mockResolvedValueOnce({ rows: [] })  // deactivate old
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, plan: 'pro', status: 'active' }] }); // insert

    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_id: STORE_ID, plan: 'pro' });
    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('pro');
  });
});

// ─── Suppliers ─────────────────────────────────────────────────────────────────

describe('POST /api/suppliers', () => {
  it('requires owner/admin role', async () => {
    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'HurtX', integration_type: 'csv' });
    expect(res.status).toBe(403);
  });

  it('creates a supplier as admin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'sup-1', name: 'HurtX', integration_type: 'csv' }] });

    const res = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'HurtX', integration_type: 'csv' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('HurtX');
  });
});

// ─── Categories ────────────────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  it('is public and returns category list', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-1', name: 'Meble', slug: 'meble', active: true }] });

    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/categories', () => {
  it('requires owner/admin role', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Meble', slug: 'meble' });
    expect(res.status).toBe(403);
  });

  it('rejects duplicate slug with 409', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cat-existing' }] }); // slug exists

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Meble', slug: 'meble' });
    expect(res.status).toBe(409);
  });

  it('creates a category as admin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // slug check
      .mockResolvedValueOnce({ rows: [{ id: 'cat-1', name: 'Meble', slug: 'meble', active: true }] });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Meble', slug: 'meble' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Meble');
  });
});

// ─── Cart ──────────────────────────────────────────────────────────────────────

describe('GET /api/cart', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(`/api/cart?store_id=${STORE_ID}`);
    expect(res.status).toBe(401);
  });

  it('requires store_id param', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(422);
  });

  it('returns empty cart when none exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // no cart found

    const res = await request(app)
      .get(`/api/cart?store_id=${STORE_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});

describe('POST /api/cart/items', () => {
  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID }); // missing product_id and quantity
    expect(res.status).toBe(422);
  });

  it('returns 404 when product not in store', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // direct product not found
    db.query.mockResolvedValueOnce({ rows: [] }); // shop_products fallback also empty

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('adds item to cart successfully', async () => {
    const CART_ID = 'cart-1';
    db.query
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, selling_price: 141.45, stock: 10, name: 'Fotel' }] }) // product found
      .mockResolvedValueOnce({ rows: [{ id: CART_ID, user_id: SELLER_ID, store_id: STORE_ID, status: 'active' }] }) // get/create cart
      .mockResolvedValueOnce({ rows: [] })  // check existing cart item
      .mockResolvedValueOnce({ rows: [] })  // insert cart item
      .mockResolvedValueOnce({ rows: [] })  // update cart updated_at
      .mockResolvedValueOnce({ rows: [{ id: CART_ID, user_id: SELLER_ID, store_id: STORE_ID, status: 'active' }] }) // cartWithItems – cart
      .mockResolvedValueOnce({ rows: [{ id: 'ci-1', cart_id: CART_ID, product_id: PRODUCT_ID, quantity: 1, unit_price: 141.45, name: 'Fotel', image_url: null }] }); // cartWithItems – items

    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBeCloseTo(141.45);
  });
});

// ─── Admin stats ───────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  it('requires admin role', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns platform stats as admin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })   // users
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })   // active stores
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })   // products (all)
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })   // central catalogue
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })   // orders
      .mockResolvedValueOnce({ rows: [{ revenue: '141.45' }] }) // revenue
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });  // pending orders

    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users', 2);
    expect(res.body).toHaveProperty('orders', 1);
    expect(res.body).toHaveProperty('central_catalogue', 0);
    expect(res.body.revenue).toBeCloseTo(141.45);
  });
});

// ─── Admin suppliers ───────────────────────────────────────────────────────────

const SUPPLIER_ID = 'a0000000-0000-4000-8000-000000000020';

describe('POST /api/admin/suppliers', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Hurtownia Test', type: 'api', api_endpoint: 'https://example.com/api' });
    expect(res.status).toBe(403);
  });

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'api' });
    expect(res.status).toBe(422);
  });

  it('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test', type: 'ftp' });
    expect(res.status).toBe(422);
  });

  it('creates a supplier with new schema fields', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: SUPPLIER_ID, name: 'Hurtownia ABC', integration_type: 'api',
        api_url: 'https://api.hurtownia.pl', country: 'PL',
        xml_endpoint: null, csv_endpoint: null, status: 'active', active: true,
      }],
    });

    const res = await request(app)
      .post('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Hurtownia ABC',
        type: 'api',
        country: 'PL',
        api_endpoint: 'https://api.hurtownia.pl',
        status: 'active',
      });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Hurtownia ABC');
    expect(res.body.status).toBe('active');
  });

  it('creates a supplier accepting integration_type fallback', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: SUPPLIER_ID, name: 'Hurtownia XML', integration_type: 'xml',
        xml_endpoint: 'https://hurtownia.pl/feed.xml', status: 'active', active: true,
      }],
    });

    const res = await request(app)
      .post('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Hurtownia XML',
        integration_type: 'xml',
        xml_endpoint: 'https://hurtownia.pl/feed.xml',
      });
    expect(res.status).toBe(201);
    expect(res.body.integration_type).toBe('xml');
  });
});

describe('GET /api/admin/suppliers', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/suppliers')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns paginated supplier list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: SUPPLIER_ID, name: 'Hurtownia ABC', status: 'active' }] });

    const res = await request(app)
      .get('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suppliers');
    expect(res.body).toHaveProperty('total', 1);
    expect(Array.isArray(res.body.suppliers)).toBe(true);
  });

  it('includes product_count per supplier', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: SUPPLIER_ID, name: 'BigBuy', status: 'active', product_count: '5', last_sync_at: null }] });

    const res = await request(app)
      .get('/api/admin/suppliers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.suppliers[0]).toHaveProperty('product_count', '5');
    expect(res.body.suppliers[0]).toHaveProperty('status', 'active');
    expect(res.body.suppliers[0]).toHaveProperty('last_sync_at', null);
  });
});

describe('POST /api/admin/suppliers/import', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${sellerToken}`)
      .field('supplier_id', SUPPLIER_ID);
    expect(res.status).toBe(403);
  });

  it('returns 422 when supplier_id is missing', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });

  it('returns 404 when supplier does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // supplier not found

    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supplier_id', SUPPLIER_ID);
    expect(res.status).toBe(404);
  });

  it('returns 422 when no file and no API url configured', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: SUPPLIER_ID, name: 'Test', integration_type: 'manual', api_url: null, xml_endpoint: null, csv_endpoint: null }],
    });

    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supplier_id', SUPPLIER_ID);
    expect(res.status).toBe(422);
  });

  it('imports products from CSV file upload', async () => {
    const csv = 'sku,name,price_net,stock,category\nABC-1,Produkt A,100,10,Elektronika\nABC-2,Produkt B,50,5,\n';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: SUPPLIER_ID, name: 'Test', integration_type: 'csv' }] }) // supplier
      .mockResolvedValueOnce({ rows: [] })   // check existing sku ABC-1 (not found)
      .mockResolvedValueOnce({ rows: [] })   // insert ABC-1
      .mockResolvedValueOnce({ rows: [] })   // check existing sku ABC-2 (not found)
      .mockResolvedValueOnce({ rows: [] });  // insert ABC-2

    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supplier_id', SUPPLIER_ID)
      .attach('file', Buffer.from(csv), { filename: 'products.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count', 2);
  });

  it('updates existing products by SKU during import', async () => {
    const csv = 'sku,name,price_net,stock\nEXIST-1,Updated Product,120,20\n';
    const EXISTING_PRODUCT_ID = 'a0000000-0000-4000-8000-000000000021';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: SUPPLIER_ID, name: 'Test', integration_type: 'csv' }] }) // supplier
      .mockResolvedValueOnce({ rows: [{ id: EXISTING_PRODUCT_ID }] }) // existing product found by sku
      .mockResolvedValueOnce({ rows: [] }); // update

    const res = await request(app)
      .post('/api/admin/suppliers/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('supplier_id', SUPPLIER_ID)
      .attach('file', Buffer.from(csv), { filename: 'products.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count', 1);
  });
});

describe('POST /api/admin/suppliers/sync', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers/sync')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ supplier_id: SUPPLIER_ID });
    expect(res.status).toBe(403);
  });

  it('returns 422 when supplier_id is missing', async () => {
    const res = await request(app)
      .post('/api/admin/suppliers/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('returns 404 when supplier does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/admin/suppliers/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: SUPPLIER_ID });
    expect(res.status).toBe(404);
  });

  it('returns 422 when supplier has no API url configured', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: SUPPLIER_ID, name: 'Test', integration_type: 'manual', api_url: null, xml_endpoint: null, csv_endpoint: null }],
    });

    const res = await request(app)
      .post('/api/admin/suppliers/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supplier_id: SUPPLIER_ID });
    expect(res.status).toBe(422);
  });
});



describe('POST /api/payments', () => {
  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ amount: 100 }); // missing order_id and method
    expect(res.status).toBe(422);
  });

  it('returns 404 when order not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // order not found

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ order_id: ORDER_ID, amount: 141.45, method: 'blik' });
    expect(res.status).toBe(404);
  });

  it('creates a payment record', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, buyer_id: SELLER_ID, total: 141.45 }] }) // order found
      .mockResolvedValueOnce({ rows: [{ id: 'pay-1', order_id: ORDER_ID, user_id: SELLER_ID, amount: 141.45, method: 'blik', status: 'pending' }] }); // insert

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ order_id: ORDER_ID, amount: 141.45, method: 'blik' });
    expect(res.status).toBe(201);
    expect(res.body.method).toBe('blik');
    expect(res.body.status).toBe('pending');
  });
});

describe('PUT /api/payments/:id/status', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .put('/api/payments/pay-1/status')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(403);
  });

  it('updates payment status as admin', async () => {
    const PAY_ID = 'a0000000-0000-4000-8000-000000000099';
    db.query
      .mockResolvedValueOnce({ rows: [{ id: PAY_ID, status: 'completed', order_id: ORDER_ID }] }) // update payment
      .mockResolvedValueOnce({ rows: [] }); // update order status

    const res = await request(app)
      .put(`/api/payments/${PAY_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });
});

// ─── Shop products ─────────────────────────────────────────────────────────────

describe('GET /api/shop-products', () => {
  it('requires store_id param', async () => {
    const res = await request(app).get('/api/shop-products');
    expect(res.status).toBe(422);
  });

  it('returns shop product list', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get(`/api/shop-products?store_id=${STORE_ID}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
  });
});

describe('POST /api/shop-products', () => {
  it('requires seller role', async () => {
    const { signToken } = require('../src/middleware/auth');
    const buyerToken = signToken({ id: 'buyer-id', email: 'buyer@test.pl', role: 'buyer' });
    const res = await request(app)
      .post('/api/shop-products')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(403);
  });

  it('adds product to shop', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] }) // store
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] })      // product
      .mockResolvedValueOnce({ rows: [{ id: 'sp-1', store_id: STORE_ID, product_id: PRODUCT_ID, active: true }] }); // insert

    const res = await request(app)
      .post('/api/shop-products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(201);
    expect(res.body.store_id).toBe(STORE_ID);
  });
});

// ─── 404 ───────────────────────────────────────────────────────────────────────

describe('Unknown route', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ─── Orders ────────────────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns order list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  it('returns all orders for admin', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
  });
});

describe('POST /api/orders', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ store_id: STORE_ID, items: [], shipping_address: 'Test' });
    expect(res.status).toBe(401);
  });

  it('rejects missing items', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, shipping_address: 'ul. Testowa 1' });
    expect(res.status).toBe(422);
  });

  it('rejects empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, items: [], shipping_address: 'ul. Testowa 1' });
    expect(res.status).toBe(422);
  });

  it('returns 404 when store not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // store not found

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        store_id: STORE_ID,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        shipping_address: 'ul. Testowa 1, Warszawa',
      });
    expect(res.status).toBe(404);
  });

  it('creates an order with status created', async () => {
    const NEW_ORDER_ID = 'b0000000-0000-4000-8000-000000000099';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, owner_id: SELLER_ID, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [{ value: '0.08' }] }) // platform_settings commission_rate
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, name: 'Fotel', selling_price: 141.45, stock: 10, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT INTO orders
      .mockResolvedValueOnce({ rows: [] }) // INSERT INTO order_items
      .mockResolvedValueOnce({ rows: [] }) // UPDATE products stock
      .mockResolvedValueOnce({ rows: [{ id: NEW_ORDER_ID, store_id: STORE_ID, order_total: 141.45, total: 141.45, platform_commission: 11.32, seller_revenue: 130.13, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [] }); // order_items

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        store_id: STORE_ID,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        shipping_address: 'ul. Testowa 1, Warszawa',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('total', 141.45);
    expect(res.body).toHaveProperty('order_total', 141.45);
    expect(res.body).toHaveProperty('platform_commission', 11.32);
    expect(res.body).toHaveProperty('seller_revenue', 130.13);
    expect(res.body).toHaveProperty('status', 'created');
  });
});

describe('PATCH /api/orders/:id/status', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/status`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(422);
  });

  it('accepts new spec status values', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ store_owner_id: SELLER_ID, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, status: 'paid' }] });

    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  it('updates order to shipped status', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ store_owner_id: SELLER_ID, status: 'processing' }] })
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, status: 'shipped' }] });

    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('shipped');
  });

  it('returns 404 for non-existent order', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ status: 'shipped' });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/orders/:id', () => {
  it('returns order with items', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, store_id: STORE_ID, buyer_id: SELLER_ID, store_owner_id: SELLER_ID, status: 'created', total: 141.45 }] })
      .mockResolvedValueOnce({ rows: [] }); // order_items

    const res = await request(app)
      .get(`/api/orders/${ORDER_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ORDER_ID);
    expect(res.body).toHaveProperty('items');
  });

  it('returns 404 for unknown order', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/orders/00000000-0000-4000-8000-000000000000`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(404);
  });
});

// ─── Shop products (extended) ─────────────────────────────────────────────────

describe('PUT /api/shop-products/:id', () => {
  it('requires seller role', async () => {
    const { signToken } = require('../src/middleware/auth');
    const buyerToken = signToken({ id: 'buyer-id', email: 'buyer@test.pl', role: 'buyer' });
    const res = await request(app)
      .put(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it('returns 404 for unknown shop product', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: false });
    expect(res.status).toBe(404);
  });

  it('updates a shop product', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true, owner_id: SELLER_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: false }] });

    const res = await request(app)
      .put(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });
});

describe('DELETE /api/shop-products/:id', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete(`/api/shop-products/${SHOP_PROD_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown shop product', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(404);
  });

  it('deletes a shop product', async () => {
    // Add a temporary product to delete
    const TMP_ID = 'a0000000-0000-4000-8000-000000000007';
    mockDb.shop_products.push({ id: TMP_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true });

    db.query
      .mockResolvedValueOnce({ rows: [{ id: TMP_ID, owner_id: SELLER_ID }] }) // ownership check
      .mockResolvedValueOnce({ rows: [] }); // delete

    const res = await request(app)
      .delete(`/api/shop-products/${TMP_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

// ─── Public shops ─────────────────────────────────────────────────────────────

describe('GET /api/shops/:slug', () => {
  it('returns 404 for unknown slug', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/shops/unknown-shop');
    expect(res.status).toBe(404);
  });

  it('returns store by slug', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active' }] });

    const res = await request(app).get('/api/shops/moj-sklep');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('moj-sklep');
  });

  it('does not require authentication', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active' }] });

    const res = await request(app).get('/api/shops/moj-sklep');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/shops/:slug/products', () => {
  it('returns 404 for unknown slug', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/shops/unknown-shop/products');
    expect(res.status).toBe(404);
  });

  it('returns product listing for store', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID }] })          // store by slug
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })            // count
      .mockResolvedValueOnce({ rows: [] });                          // products

    const res = await request(app).get('/api/shops/moj-sklep/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body).toHaveProperty('total', 0);
  });

  it('does not require authentication', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, name: 'Fotel', price: 141.45 }] });

    const res = await request(app).get('/api/shops/moj-sklep/products');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

// ─── My routes ────────────────────────────────────────────────────────────────

describe('GET /api/my/orders', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/my/orders');
    expect(res.status).toBe(401);
  });

  it('returns buyer orders', async () => {
    const res = await request(app)
      .get('/api/my/orders')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });
});

describe('GET /api/my/store/products', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/my/store/products');
    expect(res.status).toBe(401);
  });

  it('requires store_id param', async () => {
    const res = await request(app)
      .get('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(422);
  });

  it('returns 404 when store not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/my/store/products?store_id=${STORE_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(404);
  });

  it('returns shop products for seller', async () => {
    const res = await request(app)
      .get(`/api/my/store/products?store_id=${STORE_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
  });
});

describe('POST /api/my/store/products', () => {
  it('requires seller role', async () => {
    const { signToken } = require('../src/middleware/auth');
    const buyerToken = signToken({ id: 'buyer-id', email: 'buyer@test.pl', role: 'buyer' });

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(403);
  });

  it('adds product to my store', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 100, commission_rate: 0.10, status: 'active' }] }) // requireActiveSubscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })           // product count (limit check)
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] })       // product exists
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true }] }); // insert

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(201);
    expect(res.body.store_id).toBe(STORE_ID);
  });

  it('supports custom_title and custom_description', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 100, commission_rate: 0.10, status: 'active' }] }) // requireActiveSubscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })           // product count (limit check)
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] })       // product exists
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true, custom_title: 'Mój Fotel', custom_description: 'Super jakość' }] }); // insert

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, custom_title: 'Mój Fotel', custom_description: 'Super jakość' });
    expect(res.status).toBe(201);
    expect(res.body.custom_title).toBe('Mój Fotel');
  });
});

describe('PATCH /api/my/store/products/:id', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .patch(`/api/my/store/products/${SHOP_PROD_ID}`)
      .send({ active: false });
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown shop product', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/api/my/store/products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: false });
    expect(res.status).toBe(404);
  });

  it('updates shop product custom fields', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, owner_id: SELLER_ID, active: true }] })
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, active: false, custom_title: 'Fotel Nowy' }] });

    const res = await request(app)
      .patch(`/api/my/store/products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ active: false, custom_title: 'Fotel Nowy' });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  it('denies access to another seller\'s product', async () => {
    const { signToken } = require('../src/middleware/auth');
    const otherSeller = signToken({ id: 'other-seller-id', email: 'other@test.pl', role: 'seller' });

    db.query.mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, owner_id: SELLER_ID }] });

    const res = await request(app)
      .patch(`/api/my/store/products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${otherSeller}`)
      .send({ active: false });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/my/store/products/:id', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete(`/api/my/store/products/${SHOP_PROD_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown shop product', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/my/store/products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(404);
  });

  it('removes product from my store', async () => {
    const TMP_ID = 'a0000000-0000-4000-8000-000000000008';
    mockDb.shop_products.push({ id: TMP_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true });

    db.query
      .mockResolvedValueOnce({ rows: [{ id: TMP_ID, owner_id: SELLER_ID }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/my/store/products/${TMP_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('denies deletion for another seller', async () => {
    const { signToken } = require('../src/middleware/auth');
    const otherSeller = signToken({ id: 'other-seller-id', email: 'other@test.pl', role: 'seller' });

    db.query.mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, owner_id: SELLER_ID }] });

    const res = await request(app)
      .delete(`/api/my/store/products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${otherSeller}`);
    expect(res.status).toBe(403);
  });
});

// ─── Auth routes (POST /api/auth/register, /login, GET /api/auth/me) ──────────

describe('POST /api/auth/register', () => {
  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'Password123!',
      name: 'Test',
    });
    expect(res.status).toBe(422);
  });

  it('registers with default seller role and auto-creates shop', async () => {
    const shopRow = { id: 'shop-new', owner_id: 'user-new', name: 'New Seller', slug: 'new-seller', subdomain: 'new-seller.qualitetmarket.pl', status: 'active', plan: 'trial' };
    db.query
      .mockResolvedValueOnce({ rows: [] })        // SELECT – no duplicate email
      .mockResolvedValueOnce({ rows: [] })         // INSERT user
      .mockResolvedValueOnce({ rows: [] })         // uniqueSlug: slug check (free)
      .mockResolvedValueOnce({ rows: [shopRow] }) // INSERT store
      .mockResolvedValueOnce({ rows: [] });        // INSERT subscription

    const res = await request(app).post('/api/auth/register').send({
      email: 'newseller@test.pl',
      password: 'Password123!',
      name: 'New Seller',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.shop).toBeDefined();
    expect(res.body.shop.slug).toBe('new-seller');
    expect(res.body.shop.subdomain).toBe('new-seller.qualitetmarket.pl');
  });

  it('rejects duplicate email with 409', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    const res = await request(app).post('/api/auth/register').send({
      email: 'seller@test.pl',
      password: 'Password123!',
      name: 'Dup',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for wrong credentials', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.pl', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('returns token for correct credentials', async () => {
    const hash = await bcrypt.hash('Password123!', 12);
    db.query.mockResolvedValueOnce({
      rows: [{ id: SELLER_ID, email: 'seller@test.pl', password_hash: hash, name: 'Seller', role: 'seller', plan: 'basic' }],
    });

    const res = await request(app).post('/api/auth/login').send({ email: 'seller@test.pl', password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile when authenticated', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: SELLER_ID, email: 'seller@test.pl', name: 'Seller', role: 'seller', plan: 'basic' }],
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('seller@test.pl');
  });
});

// ─── POST /api/shops – create a new shop ──────────────────────────────────────

describe('POST /api/shops', () => {
  it('requires seller role', async () => {
    const res = await request(app).post('/api/shops').send({ name: 'Sklep' });
    expect(res.status).toBe(401);
  });

  it('auto-generates unique slug when provided slug is taken', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // slug 'moj-sklep' taken
      .mockResolvedValueOnce({ rows: [] })                   // slug 'moj-sklep-1' free
      .mockResolvedValueOnce({ rows: [{ id: 'new-shop-id', name: 'Sklep', slug: 'moj-sklep-1', subdomain: 'moj-sklep-1.qualitetmarket.pl', margin: 30, status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] }); // subscription

    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Sklep', slug: 'moj-sklep' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('moj-sklep-1');
    expect(res.body.subdomain).toBe('moj-sklep-1.qualitetmarket.pl');
  });

  it('creates shop with default 30% margin and next_step', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // slug free
      .mockResolvedValueOnce({ rows: [{ id: 'new-shop-id', name: 'Nowy Sklep', slug: 'nowy-sklep', subdomain: 'nowy-sklep.qualitetmarket.pl', margin: 30, status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] }); // auto-create trial subscription

    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Nowy Sklep', slug: 'nowy-sklep' });
    expect(res.status).toBe(201);
    expect(res.body.next_step).toBe('add_products');
    expect(res.body.margin).toBe(30);
    expect(res.body.subdomain).toBe('nowy-sklep.qualitetmarket.pl');
  });

  it('auto-generates slug from name when no slug is provided', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // slug free
      .mockResolvedValueOnce({ rows: [{ id: 'auto-shop-id', name: 'Mój Sklep', slug: 'moj-sklep', subdomain: 'moj-sklep.qualitetmarket.pl', margin: 30, status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] }); // subscription

    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Mój Sklep' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('moj-sklep');
    expect(res.body.subdomain).toBe('moj-sklep.qualitetmarket.pl');
  });
});

// ─── PATCH /api/my/store – update seller's store ──────────────────────────────

describe('PATCH /api/my/store', () => {
  it('requires authentication', async () => {
    const res = await request(app).patch('/api/my/store').send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when seller has no store', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // no store found
    const res = await request(app)
      .patch('/api/my/store')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('updates store fields successfully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID }] })  // find store
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Updated Store', margin: 25 }] }); // UPDATE

    const res = await request(app)
      .patch('/api/my/store')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Updated Store', margin: 25 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Store');
  });
});

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────

describe('GET /api/admin/dashboard', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns dashboard metrics as admin', async () => {
    // Mock all 12 parallel queries
    for (let i = 0; i < 12; i++) {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5', avg: '99.50', revenue: '497.50' }] });
    }

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sellers');
    expect(res.body).toHaveProperty('customers');
    expect(res.body).toHaveProperty('products');
    expect(res.body).toHaveProperty('revenue');
  });
});

// ─── GET /api/admin/shops ─────────────────────────────────────────────────────

describe('GET /api/admin/shops', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/shops')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns shops list as admin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', status: 'active' }] });

    const res = await request(app)
      .get('/api/admin/shops')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('shops');
  });
});

// ─── POST /api/cart (shop_product_id-based) ───────────────────────────────────

describe('POST /api/cart (shop_product_id)', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/cart')
      .send({ shop_product_id: SHOP_PROD_ID, quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('rejects missing shop_product_id', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(422);
  });

  it('returns 404 for inactive or missing shop product', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // shop product not found
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_product_id: SHOP_PROD_ID, quantity: 1 });
    expect(res.status).toBe(404);
  });

  it('adds item to cart via shop_product_id', async () => {
    const CART_ID = 'c0000000-0000-4000-8000-000000000001';
    const ITEM_ID = 'c0000000-0000-4000-8000-000000000002';

    db.query
      // resolve shop product
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true, effective_price: 141.45, stock: 10, name: 'Fotel' }] })
      // getOrCreateCart – existing
      .mockResolvedValueOnce({ rows: [{ id: CART_ID, user_id: SELLER_ID, store_id: STORE_ID, status: 'active' }] })
      // check existing item – none
      .mockResolvedValueOnce({ rows: [] })
      // insert item
      .mockResolvedValueOnce({ rows: [{ id: ITEM_ID }] })
      // touch cart
      .mockResolvedValueOnce({ rows: [] })
      // cartWithItems – cart
      .mockResolvedValueOnce({ rows: [{ id: CART_ID, user_id: SELLER_ID, store_id: STORE_ID, status: 'active' }] })
      // cartWithItems – items
      .mockResolvedValueOnce({ rows: [{ id: ITEM_ID, cart_id: CART_ID, product_id: PRODUCT_ID, quantity: 1, unit_price: 141.45, name: 'Fotel', image_url: null }] });

    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_product_id: SHOP_PROD_ID, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
  });
});

// ─── DELETE /api/cart/items/:itemId ───────────────────────────────────────────

describe('DELETE /api/cart/items/:itemId', () => {
  it('requires authentication', async () => {
    const res = await request(app).delete(`/api/cart/items/a0000000-0000-4000-8000-000000000099`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown item', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // item not found
    const res = await request(app)
      .delete(`/api/cart/items/a0000000-0000-4000-8000-000000000099`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(404);
  });

  it('removes item and returns updated cart', async () => {
    const CART_ID = 'c0000000-0000-4000-8000-000000000001';
    const ITEM_ID = 'c0000000-0000-4000-8000-000000000002';

    db.query
      // find item
      .mockResolvedValueOnce({ rows: [{ id: ITEM_ID, cart_id: CART_ID }] })
      // delete item
      .mockResolvedValueOnce({ rows: [] })
      // touch cart
      .mockResolvedValueOnce({ rows: [] })
      // cartWithItems – cart
      .mockResolvedValueOnce({ rows: [{ id: CART_ID, user_id: SELLER_ID, store_id: STORE_ID, status: 'active' }] })
      // cartWithItems – items (now empty)
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/cart/items/${ITEM_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });
});



// ─── Subscription marketplace features ───────────────────────────────────────

describe('POST /api/shops – auto trial subscription', () => {
  it('auto-creates trial subscription on shop creation', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // slug free
      .mockResolvedValueOnce({ rows: [{ id: 'shop-uuid', name: 'Test Shop', slug: 'test-shop', margin: 30, status: 'active' }] })
      .mockResolvedValueOnce({ rows: [] }); // INSERT trial subscription

    const res = await request(app)
      .post('/api/shops')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Test Shop', slug: 'test-shop' });
    expect(res.status).toBe(201);
    // Third db.query call (subscription insert) was made
    expect(db.query).toHaveBeenCalledTimes(3);
  });
});

describe('POST /api/my/store/products – subscription checks', () => {
  it('blocks adding product when subscription is expired', async () => {
    // requireActiveSubscription middleware returns no active subscription
    db.query.mockResolvedValueOnce({ rows: [] }); // no active subscription

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('subscription_expired');
  });

  it('blocks adding product when product_limit is reached', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 10, commission_rate: 0.15, status: 'active' }] }) // subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '10' }] });          // product count = limit

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('product_limit_reached');
  });

  it('allows adding product when limit is not reached', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 100, commission_rate: 0.10, status: 'active' }] }) // subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })            // product count < limit
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] })        // product exists
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true }] }); // insert

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(201);
  });

  it('allows adding product when subscription has no product_limit (elite/null)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: null, commission_rate: 0.05, status: 'active' }] }) // elite subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      // no count query – skipped when product_limit is null
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID }] })        // product exists
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID, active: true }] }); // insert

    const res = await request(app)
      .post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID });
    expect(res.status).toBe(201);
  });
});

// ─── POST /api/my/store/products/bulk ─────────────────────────────────────────

describe('POST /api/my/store/products/bulk', () => {
  const PRODUCT_ID_2 = 'a0000000-0000-4000-8000-000000000010';

  it('requires seller role', async () => {
    const { signToken } = require('../src/middleware/auth');
    const buyerToken = signToken({ id: 'buyer-id', email: 'buyer@test.pl', role: 'buyer' });

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ store_id: STORE_ID, product_ids: [PRODUCT_ID] });
    expect(res.status).toBe(403);
  });

  it('rejects missing product_ids', async () => {
    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID });
    expect(res.status).toBe(422);
  });

  it('rejects empty product_ids array', async () => {
    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [] });
    expect(res.status).toBe(422);
  });

  it('blocks when subscription is expired', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // no active subscription

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [PRODUCT_ID] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('subscription_expired');
  });

  it('blocks when product_limit would be exceeded by bulk add', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 10, commission_rate: 0.10, status: 'active' }] }) // subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })  // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '9' }] });           // current count = 9, adding 2 would exceed limit 10

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [PRODUCT_ID, PRODUCT_ID_2] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('product_limit_reached');
  });

  it('adds multiple products and returns results', async () => {
    mockDb.products.push({ id: PRODUCT_ID_2, store_id: null, name: 'Produkt 2', selling_price: 200, stock: 5 });

    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: 100, commission_rate: 0.10, status: 'active' }] }) // subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })   // store ownership
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })             // product count
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, selling_price: 141.45 }, { id: PRODUCT_ID_2, selling_price: 200 }] }) // batch products fetch
      .mockResolvedValueOnce({ rows: [{ id: 'sp-bulk-1', store_id: STORE_ID, product_id: PRODUCT_ID, margin_override: 20, active: true }] }) // insert 1
      .mockResolvedValueOnce({ rows: [{ id: 'sp-bulk-2', store_id: STORE_ID, product_id: PRODUCT_ID_2, margin_override: 20, active: true }] }); // insert 2

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [PRODUCT_ID, PRODUCT_ID_2] });
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(2);
    expect(res.body.skipped).toBe(0);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('skips products that do not exist', async () => {
    const MISSING_ID = 'a0000000-0000-4000-8000-000000000099';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: null, commission_rate: 0.05, status: 'active' }] }) // elite subscription
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })   // store ownership
      // no count query for null limit
      .mockResolvedValueOnce({ rows: [] }); // batch products fetch – none found → skipped

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [MISSING_ID] });
    expect(res.status).toBe(201);
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toBe(1);
  });

  it('uses 20% default margin for added products', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, product_limit: null, commission_rate: 0.05, status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] })
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, selling_price: 100 }] }) // batch products fetch
      .mockResolvedValueOnce({ rows: [{ id: 'sp-new', store_id: STORE_ID, product_id: PRODUCT_ID, margin_type: 'percent', margin_override: 20, active: true }] });

    const res = await request(app)
      .post('/api/my/store/products/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_ids: [PRODUCT_ID] });
    expect(res.status).toBe(201);
    expect(res.body.results[0].margin_override).toBe(20);
  });
});

describe('POST /api/orders – commission calculation', () => {
  it('uses global commission_rate from platform_settings for platform_commission', async () => {
    const NEW_ORDER_ID = 'b0000000-0000-4000-8000-000000000098';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, owner_id: SELLER_ID, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [{ value: '0.07' }] }) // platform_settings commission_rate
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, name: 'Fotel', selling_price: 100.00, stock: 10, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT orders
      .mockResolvedValueOnce({ rows: [] }) // INSERT order_items
      .mockResolvedValueOnce({ rows: [] }) // UPDATE products stock
      .mockResolvedValueOnce({ rows: [{ id: NEW_ORDER_ID, store_id: STORE_ID, total: 100.00, order_total: 100.00, platform_commission: 7.00, seller_revenue: 93.00, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [] }); // order_items

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        store_id: STORE_ID,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        shipping_address: 'ul. Testowa 1, Warszawa',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('platform_commission', 7.00);
    expect(res.body).toHaveProperty('seller_revenue', 93.00);
  });

  it('falls back to default commission when no platform setting found', async () => {
    const NEW_ORDER_ID = 'b0000000-0000-4000-8000-000000000097';

    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, owner_id: SELLER_ID, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [] }) // no platform_settings row
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, name: 'Fotel', selling_price: 100.00, stock: 10, margin: 15 }] })
      .mockResolvedValueOnce({ rows: [] }) // INSERT orders
      .mockResolvedValueOnce({ rows: [] }) // INSERT order_items
      .mockResolvedValueOnce({ rows: [] }) // UPDATE products stock
      .mockResolvedValueOnce({ rows: [{ id: NEW_ORDER_ID, store_id: STORE_ID, total: 100.00, order_total: 100.00, platform_commission: 8.00, seller_revenue: 92.00, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [] }); // order_items

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        store_id: STORE_ID,
        items: [{ product_id: PRODUCT_ID, quantity: 1 }],
        shipping_address: 'ul. Testowa 1, Warszawa',
      });
    expect(res.status).toBe(201);
  });
});

describe('GET /api/admin/subscriptions – shop-based view', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/subscriptions')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns subscriptions with shop info as admin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', shop_id: STORE_ID, plan: 'trial', status: 'active', shop_name: 'Mój Sklep', product_count: '2', commission_rate: 0.15 }] });

    const res = await request(app)
      .get('/api/admin/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('subscriptions');
    expect(res.body.subscriptions[0]).toHaveProperty('shop_name');
    expect(res.body.subscriptions[0]).toHaveProperty('product_count');
  });
});

describe('PATCH /api/admin/subscriptions/:id', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .patch('/api/admin/subscriptions/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ plan: 'pro' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid plan', async () => {
    const res = await request(app)
      .patch('/api/admin/subscriptions/00000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'diamond' });
    expect(res.status).toBe(422);
  });

  it('updates subscription plan and applies plan defaults', async () => {
    const SUB_ID = '00000000-0000-4000-8000-000000000001';
    db.query.mockResolvedValueOnce({
      rows: [{ id: SUB_ID, plan: 'pro', status: 'active', commission_rate: 0.07, product_limit: 500 }],
    });

    const res = await request(app)
      .patch(`/api/admin/subscriptions/${SUB_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plan: 'pro' });
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
  });

  it('returns 404 for non-existent subscription', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/admin/subscriptions/00000000-0000-4000-8000-000000000099')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(404);
  });

  it('admin can override commission_rate directly', async () => {
    const SUB_ID = '00000000-0000-4000-8000-000000000001';
    db.query.mockResolvedValueOnce({
      rows: [{ id: SUB_ID, plan: 'basic', status: 'active', commission_rate: 0.08, product_limit: 100 }],
    });

    const res = await request(app)
      .patch(`/api/admin/subscriptions/${SUB_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commission_rate: 0.08 });
    expect(res.status).toBe(200);
    expect(res.body.commission_rate).toBe(0.08);
  });
});

// ─── Subdomain store routes (GET /api/store) ──────────────────────────────────

describe('GET /api/store (subdomain)', () => {
  it('returns 404 when no subdomain is present', async () => {
    const res = await request(app).get('/api/store');
    expect(res.status).toBe(404);
  });

  it('returns 404 for unknown subdomain slug', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // store not found

    const res = await request(app)
      .get('/api/store')
      .set('Host', 'unknown.qualitetmarket.pl');
    expect(res.status).toBe(404);
  });

  it('returns store data for valid subdomain', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: STORE_ID, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active', subdomain_blocked: false }],
    });

    const res = await request(app)
      .get('/api/store')
      .set('Host', 'moj-sklep.qualitetmarket.pl');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('moj-sklep');
    expect(res.body.name).toBe('Mój Sklep');
  });

  it('returns 404 for blocked subdomain', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // blocked stores are filtered by query

    const res = await request(app)
      .get('/api/store')
      .set('Host', 'moj-sklep.qualitetmarket.pl');
    expect(res.status).toBe(404);
  });

  it('ignores non-platform hostnames', async () => {
    // No db.query call should be made for unrelated hosts
    const res = await request(app).get('/api/store').set('Host', 'localhost:3000');
    expect(res.status).toBe(404);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('GET /api/store/products (subdomain)', () => {
  it('returns 404 when no subdomain', async () => {
    const res = await request(app).get('/api/store/products');
    expect(res.status).toBe(404);
  });

  it('returns product listing for valid subdomain', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active', subdomain_blocked: false }] }) // store
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: SHOP_PROD_ID, name: 'Fotel', price: 141.45 }] });

    const res = await request(app)
      .get('/api/store/products')
      .set('Host', 'moj-sklep.qualitetmarket.pl');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
    expect(res.body.total).toBe(1);
  });
});

describe('GET /api/store/categories (subdomain)', () => {
  it('returns 404 when no subdomain', async () => {
    const res = await request(app).get('/api/store/categories');
    expect(res.status).toBe(404);
  });

  it('returns categories for valid subdomain', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, name: 'Mój Sklep', slug: 'moj-sklep', status: 'active', subdomain_blocked: false }] }) // store
      .mockResolvedValueOnce({ rows: [{ name: 'Meble' }, { name: 'Sport' }] });

    const res = await request(app)
      .get('/api/store/categories')
      .set('Host', 'moj-sklep.qualitetmarket.pl');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(res.body.categories).toContain('Meble');
  });
});

// ─── Admin: store slug management ─────────────────────────────────────────────

describe('PATCH /api/admin/stores/:id/slug', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/slug`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ slug: 'nowy-slug' });
    expect(res.status).toBe(403);
  });

  it('rejects invalid slug format', async () => {
    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/slug`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'invalid slug!' });
    expect(res.status).toBe(422);
  });

  it('rejects duplicate slug with 409', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'other-store' }] }); // slug taken

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/slug`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'other-slug' });
    expect(res.status).toBe(409);
  });

  it('updates slug successfully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // no conflict
      .mockResolvedValueOnce({ rows: [{ id: STORE_ID, slug: 'nowy-slug', subdomain_blocked: false }] }); // update

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/slug`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'nowy-slug' });
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('nowy-slug');
  });

  it('returns 404 for non-existent store', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // no conflict
      .mockResolvedValueOnce({ rows: [] }); // store not found

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/slug`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ slug: 'some-slug' });
    expect(res.status).toBe(404);
  });
});

// ─── Admin: subdomain block/unblock ───────────────────────────────────────────

describe('PATCH /api/admin/stores/:id/subdomain', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/subdomain`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ subdomain_blocked: true });
    expect(res.status).toBe(403);
  });

  it('rejects missing subdomain_blocked field', async () => {
    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/subdomain`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('blocks subdomain successfully', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: STORE_ID, slug: 'moj-sklep', subdomain_blocked: true }],
    });

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/subdomain`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subdomain_blocked: true });
    expect(res.status).toBe(200);
    expect(res.body.subdomain_blocked).toBe(true);
  });

  it('unblocks subdomain successfully', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: STORE_ID, slug: 'moj-sklep', subdomain_blocked: false }],
    });

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/subdomain`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subdomain_blocked: false });
    expect(res.status).toBe(200);
    expect(res.body.subdomain_blocked).toBe(false);
  });

  it('returns 404 for non-existent store', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/api/admin/stores/${STORE_ID}/subdomain`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subdomain_blocked: true });
    expect(res.status).toBe(404);
  });
});

// ─── Pricing helper: computePlatformPrice ─────────────────────────────────────

describe('computePlatformPrice helper', () => {
  const { computePlatformPrice, DEFAULT_PLATFORM_TIERS } = require('../src/helpers/pricing');

  it('applies 60% margin for prices up to 20 zł', () => {
    expect(computePlatformPrice(10)).toBe(16.00);
    expect(computePlatformPrice(20)).toBe(32.00);
  });

  it('applies 40% margin for prices in 20–100 zł range', () => {
    expect(computePlatformPrice(50)).toBe(70.00);
    expect(computePlatformPrice(100)).toBe(140.00);
  });

  it('applies 25% margin for prices in 100–300 zł range', () => {
    expect(computePlatformPrice(200)).toBe(250.00);
    expect(computePlatformPrice(300)).toBe(375.00);
  });

  it('applies 15% margin for prices above 300 zł', () => {
    expect(computePlatformPrice(400)).toBe(460.00);
    expect(computePlatformPrice(1000)).toBe(1150.00);
  });

  it('accepts custom tiers override', () => {
    const tiers = [{ maxPrice: 50, marginPercent: 10 }, { maxPrice: null, marginPercent: 5 }];
    expect(computePlatformPrice(30, tiers)).toBe(33.00);
    expect(computePlatformPrice(100, tiers)).toBe(105.00);
  });

  it('returns 0 for zero supplier price', () => {
    expect(computePlatformPrice(0)).toBe(0);
  });
});

// ─── Admin: platform margin config ────────────────────────────────────────────

describe('GET /api/admin/platform-margins', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns all margin tiers as admin', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'tier-1', category: null, threshold_max: '20', margin_percent: '60' },
        { id: 'tier-2', category: null, threshold_max: '100', margin_percent: '40' },
        { id: 'tier-3', category: null, threshold_max: '300', margin_percent: '25' },
        { id: 'tier-4', category: null, threshold_max: null,  margin_percent: '15' },
      ],
    });

    const res = await request(app)
      .get('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(4);
    expect(res.body.tiers[0].margin_percent).toBe('60');
  });

  it('filters by category when query param provided', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'tier-cat', category: 'Meble', threshold_max: '100', margin_percent: '35' }],
    });

    const res = await request(app)
      .get('/api/admin/platform-margins?category=Meble')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.tiers[0].category).toBe('Meble');
  });
});

describe('PUT /api/admin/platform-margins', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .put('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ tiers: [{ threshold_max: 20, margin_percent: 60 }] });
    expect(res.status).toBe(403);
  });

  it('rejects empty tiers array', async () => {
    const res = await request(app)
      .put('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tiers: [] });
    expect(res.status).toBe(422);
  });

  it('replaces global tiers successfully', async () => {
    const newTier = { id: 'new-tier', category: null, threshold_max: null, margin_percent: '20' };
    db.query
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [newTier] }); // INSERT

    const res = await request(app)
      .put('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tiers: [{ threshold_max: null, margin_percent: 20 }] });
    expect(res.status).toBe(200);
    expect(res.body.tiers).toHaveLength(1);
    expect(res.body.tiers[0].margin_percent).toBe('20');
  });

  it('replaces per-category tiers', async () => {
    const catTier = { id: 'cat-tier', category: 'Sport', threshold_max: '50', margin_percent: '30' };
    db.query
      .mockResolvedValueOnce({ rows: [] }) // DELETE by category
      .mockResolvedValueOnce({ rows: [catTier] }); // INSERT

    const res = await request(app)
      .put('/api/admin/platform-margins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'Sport', tiers: [{ threshold_max: 50, margin_percent: 30 }] });
    expect(res.status).toBe(200);
    expect(res.body.tiers[0].category).toBe('Sport');
  });
});

// ─── Shop products: seller_margin and min price enforcement ───────────────────

describe('POST /api/shop-products – seller_margin and selling_price', () => {
  it('computes selling_price from seller_margin', async () => {
    const spRow = {
      id: 'sp-new', store_id: STORE_ID, product_id: PRODUCT_ID,
      seller_margin: 10, selling_price: 110.00, active: true,
    };
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] }) // store
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, platform_price: 100, min_selling_price: 100, selling_price: 100 }] }) // product
      .mockResolvedValueOnce({ rows: [spRow] }); // insert

    const res = await request(app)
      .post('/api/shop-products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, seller_margin: 10 });
    expect(res.status).toBe(201);
    expect(res.body.seller_margin).toBe(10);
  });

  it('rejects price_override below platform_price (min_selling_price)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] }) // store
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, platform_price: 100, min_selling_price: 100, selling_price: 100 }] }); // product

    const res = await request(app)
      .post('/api/shop-products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, price_override: 80 });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('min_selling_price');
  });

  it('accepts price_override equal to platform_price', async () => {
    const spRow = { id: 'sp-eq', store_id: STORE_ID, product_id: PRODUCT_ID, active: true };
    db.query
      .mockResolvedValueOnce({ rows: [{ owner_id: SELLER_ID }] }) // store
      .mockResolvedValueOnce({ rows: [{ id: PRODUCT_ID, platform_price: 100, min_selling_price: 100, selling_price: 100 }] }) // product
      .mockResolvedValueOnce({ rows: [spRow] }); // insert

    const res = await request(app)
      .post('/api/shop-products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ store_id: STORE_ID, product_id: PRODUCT_ID, price_override: 100 });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/shop-products/:id – seller_margin enforcement', () => {
  it('rejects price_override below platform_price', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID,
        owner_id: SELLER_ID, platform_price: 100, min_selling_price: 100, product_selling_price: 100,
      }],
    });

    const res = await request(app)
      .put(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ price_override: 50 });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('min_selling_price');
  });

  it('accepts valid seller_margin', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: SHOP_PROD_ID, store_id: STORE_ID, product_id: PRODUCT_ID,
          owner_id: SELLER_ID, platform_price: 100, min_selling_price: 100, product_selling_price: 100,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: SHOP_PROD_ID, seller_margin: 20, selling_price: 120, active: true }],
      });

    const res = await request(app)
      .put(`/api/shop-products/${SHOP_PROD_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ seller_margin: 20 });
    expect(res.status).toBe(200);
    expect(res.body.selling_price).toBe(120);
  });
});

// ─── Payments – Przelewy24 & Stripe providers ─────────────────────────────────

describe('POST /api/payments – provider support', () => {
  it('creates payment with stripe provider and stores payment_provider', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, buyer_id: SELLER_ID, total: 141.45 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pay-stripe', order_id: ORDER_ID, user_id: SELLER_ID, amount: 141.45, method: 'stripe', payment_provider: 'stripe', status: 'pending' }] });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ order_id: ORDER_ID, amount: 141.45, method: 'stripe' });
    expect(res.status).toBe(201);
    expect(res.body.method).toBe('stripe');
    expect(res.body.payment_provider).toBe('stripe');
    expect(res.body.status).toBe('pending');
  });

  it('creates payment with p24 (Przelewy24) provider', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, buyer_id: SELLER_ID, total: 141.45 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pay-p24', order_id: ORDER_ID, user_id: SELLER_ID, amount: 141.45, method: 'p24', payment_provider: 'p24', status: 'pending' }] });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ order_id: ORDER_ID, amount: 141.45, method: 'p24' });
    expect(res.status).toBe(201);
    expect(res.body.payment_provider).toBe('p24');
    expect(res.body.status).toBe('pending');
  });

  it('rejects unsupported provider name', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ order_id: ORDER_ID, amount: 141.45, method: 'paypal' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/payments/:orderId/initiate – stripe & p24', () => {
  it('initiates stripe payment and returns provider payload', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, buyer_id: SELLER_ID, total: 141.45, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pay-stripe', order_id: ORDER_ID, user_id: SELLER_ID, amount: 141.45, method: 'stripe', payment_provider: 'stripe', status: 'pending' }] });

    const res = await request(app)
      .post(`/api/payments/${ORDER_ID}/initiate`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ method: 'stripe' });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('stripe');
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment_id).toBeDefined();
  });

  it('initiates p24 (Przelewy24) payment and returns provider payload', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: ORDER_ID, buyer_id: SELLER_ID, total: 141.45, status: 'created' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'pay-p24', order_id: ORDER_ID, user_id: SELLER_ID, amount: 141.45, method: 'p24', payment_provider: 'p24', status: 'pending' }] });

    const res = await request(app)
      .post(`/api/payments/${ORDER_ID}/initiate`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ method: 'p24' });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('p24');
  });
});

describe('PUT /api/payments/:id/status – paid status', () => {
  it('accepts paid status and updates order to paid', async () => {
    const PAY_ID = 'a0000000-0000-4000-8000-000000000098';
    db.query
      .mockResolvedValueOnce({ rows: [{ id: PAY_ID, status: 'paid', order_id: ORDER_ID }] })
      .mockResolvedValueOnce({ rows: [] }); // update order

    const res = await request(app)
      .put(`/api/payments/${PAY_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  it('rejects invalid status', async () => {
    const PAY_ID = 'a0000000-0000-4000-8000-000000000097';
    const res = await request(app)
      .put(`/api/payments/${PAY_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/payments/webhook – paid status', () => {
  it('rejects webhook with invalid status', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ payment_id: ORDER_ID, status: 'approved', signature: 'abc' });
    expect(res.status).toBe(422);
  });

  it('rejects webhook with missing signature', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .send({ payment_id: ORDER_ID, status: 'paid' });
    expect(res.status).toBe(422);
  });
});

// ─── Admin settings (commission) ──────────────────────────────────────────────

describe('GET /api/admin/settings', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns platform settings with commission_rate', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ key: 'commission_rate', value: '0.08' }],
    });

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('commission_rate', 0.08);
  });
});

describe('PATCH /api/admin/settings', () => {
  it('requires admin role', async () => {
    const res = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ commission_rate: 0.10 });
    expect(res.status).toBe(403);
  });

  it('rejects invalid commission_rate', async () => {
    const res = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commission_rate: 1.5 });
    expect(res.status).toBe(422);
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(422);
  });

  it('updates commission_rate', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // UPSERT

    const res = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ commission_rate: 0.10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('commission_rate', 0.10);
  });
});
