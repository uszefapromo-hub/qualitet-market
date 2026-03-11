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
      const [id, owner_id, name, slug, description, margin, plan] = params;
      const store = { id, owner_id, name, slug, description, margin, plan, status: 'active' };
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
let superadminToken;
const SELLER_ID = 'a0000000-0000-4000-8000-000000000001';
const ADMIN_ID  = 'a0000000-0000-4000-8000-000000000002';
const SUPERADMIN_ID = 'a0000000-0000-4000-8000-000000000009';
const STORE_ID  = 'a0000000-0000-4000-8000-000000000003';
const PRODUCT_ID = 'a0000000-0000-4000-8000-000000000004';
const ORDER_ID  = 'a0000000-0000-4000-8000-000000000005';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test_secret';
  process.env.NODE_ENV = 'test';

  setupDbMock();

  app = require('../src/app');

  const { signToken } = require('../src/middleware/auth');
  sellerToken     = signToken({ id: SELLER_ID,     email: 'seller@test.pl',     role: 'seller'     });
  adminToken      = signToken({ id: ADMIN_ID,      email: 'admin@test.pl',      role: 'owner'      });
  superadminToken = signToken({ id: SUPERADMIN_ID, email: 'superadmin@test.pl', role: 'superadmin' });

  // Pre-seed users
  const hash = await bcrypt.hash('Password123!', 12);
  mockDb.users.push({ id: SELLER_ID,     email: 'seller@test.pl',     password_hash: hash, name: 'Seller',     role: 'seller',     plan: 'basic'  });
  mockDb.users.push({ id: ADMIN_ID,      email: 'admin@test.pl',      password_hash: hash, name: 'Admin',      role: 'owner',      plan: 'elite'  });
  mockDb.users.push({ id: SUPERADMIN_ID, email: 'superadmin@test.pl', password_hash: hash, name: 'SuperAdmin', role: 'superadmin', plan: 'elite'  });

  // Pre-seed a store
  mockDb.stores.push({ id: STORE_ID, owner_id: SELLER_ID, name: 'Mój Sklep', slug: 'moj-sklep', margin: 15, plan: 'basic', status: 'active' });

  // Pre-seed a product
  mockDb.products.push({ id: PRODUCT_ID, store_id: STORE_ID, name: 'Fotel', price_net: 100, selling_price: 141.45, stock: 10, margin: 15 });

  // Pre-seed an order
  mockDb.orders.push({ id: ORDER_ID, store_id: STORE_ID, store_owner_id: SELLER_ID, buyer_id: SELLER_ID, status: 'pending', total: 141.45 });
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
      .send({ plan: 'diamond' });
    expect(res.status).toBe(422);
  });

  it('creates a subscription', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })  // deactivate old
      .mockResolvedValueOnce({ rows: [{ id: 'sub-1', user_id: SELLER_ID, plan: 'pro', status: 'active' }] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // update user plan

    const res = await request(app)
      .post('/api/subscriptions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ plan: 'pro' });
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
    db.query.mockResolvedValueOnce({ rows: [] }); // product not found

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

// ─── Admin dashboard ───────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard', () => {
  it('requires superadmin role (seller gets 403)', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });

  it('requires superadmin role (owner gets 403)', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('returns platform stats as superadmin', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })              // users
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })              // stores
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })              // products
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })              // orders
      .mockResolvedValueOnce({ rows: [{ sales: '141.45' }] })         // daily_sales
      .mockResolvedValueOnce({ rows: [{ sales: '141.45' }] })         // monthly_sales
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })              // new_shops
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })              // new_users
      .mockResolvedValueOnce({ rows: [] })                            // recent_orders
      .mockResolvedValueOnce({ rows: [] });                           // recent_shops

    const res = await request(app).get('/api/admin/dashboard').set('Authorization', `Bearer ${superadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty('users', 2);
    expect(res.body.stats).toHaveProperty('orders', 1);
    expect(res.body.stats.monthly_sales).toBeCloseTo(141.45);
    expect(res.body).toHaveProperty('recent_orders');
    expect(res.body).toHaveProperty('recent_shops');
  });
});

// ─── Payments ──────────────────────────────────────────────────────────────────

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

