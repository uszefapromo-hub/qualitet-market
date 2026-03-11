'use strict';

/**
 * Marketplace tests: categories, shop_products, cart, orders.
 */

const request = require('supertest');

const mockDb = {
  users: [], stores: [], products: [], categories: [],
  shop_products: [], carts: [], cart_items: [],
  orders: [], order_items: [], audit_logs: [],
};

jest.mock('../src/config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));

const db = require('../src/config/database');

function setupDbMock() {
  db.query.mockImplementation(async (sql, params = []) => {
    const s = sql.trim().replace(/\s+/g, ' ').toLowerCase();

    if (s.startsWith('insert into audit_logs')) return { rows: [] };
    if (s.startsWith('select count(*)') && s.includes('from audit_logs'))
      return { rows: [{ count: String(mockDb.audit_logs.length) }] };
    if (s.includes('from audit_logs al'))
      return { rows: mockDb.audit_logs.map(l => ({ ...l, actor_email: null, actor_name: null })) };

    if (s.includes('from categories where id')) {
      const row = mockDb.categories.find(c => c.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from categories where slug')) {
      const row = mockDb.categories.find(c => c.slug === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes("from categories where status = 'active'"))
      return { rows: mockDb.categories.filter(c => c.status === 'active') };
    if (s.startsWith('insert into categories')) {
      const cat = { id: params[0], parent_id: params[1], name: params[2], slug: params[3], status: params[4] };
      mockDb.categories.push(cat);
      return { rows: [cat] };
    }

    if (s.includes('from stores where id =')) {
      const row = mockDb.stores.find(st => st.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from stores where slug')) {
      const row = mockDb.stores.find(st => st.slug === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from stores where owner_id'))
      return { rows: mockDb.stores.filter(st => st.owner_id === params[0]) };
    if (s.startsWith('select count(*)') && s.includes('from stores'))
      return { rows: [{ count: String(mockDb.stores.length) }] };

    if (s.includes('from products') && s.includes('where id = $1')) {
      const row = mockDb.products.find(p => p.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('update products set stock')) {
      const p = mockDb.products.find(pr => pr.id === params[1]);
      if (p) p.stock = p.stock - params[0];
      return { rows: [] };
    }

    // shop_products – PATCH ownership (has p.price_gross in SELECT)
    if (s.includes('from shop_products sp') && s.includes('p.price_gross')) {
      const sp = mockDb.shop_products.find(x => x.id === params[0]);
      if (!sp) return { rows: [] };
      const store = mockDb.stores.find(st => st.id === sp.shop_id) || {};
      const product = mockDb.products.find(p => p.id === sp.product_id) || {};
      return { rows: [{ ...sp, owner_id: store.owner_id, price_gross: product.price_gross }] };
    }
    // shop_products – DELETE ownership (joins stores only, not products)
    if (s.includes('from shop_products sp') && s.includes('join stores s') && !s.includes('join products p')) {
      const sp = mockDb.shop_products.find(x => x.id === params[0]);
      if (!sp) return { rows: [] };
      const store = mockDb.stores.find(st => st.id === sp.shop_id) || {};
      return { rows: [{ id: sp.id, owner_id: store.owner_id }] };
    }
    // shop_products – cart validation (has global_product_id)
    if (s.includes('from shop_products sp') && s.includes('global_product_id')) {
      const sp = mockDb.shop_products.find(x => x.id === params[0]);
      if (!sp) return { rows: [] };
      const p = mockDb.products.find(x => x.id === sp.product_id) || {};
      return { rows: [{ ...sp, stock: p.stock, global_product_id: p.id }] };
    }
    // shop_products – orders direct items (ANY array)
    if (s.includes('from shop_products sp') && s.includes('any(')) {
      const ids = params[0];
      return { rows: mockDb.shop_products.filter(x => ids.includes(x.id)).map(sp => {
        const p = mockDb.products.find(x => x.id === sp.product_id) || {};
        return { ...sp, shop_product_id: sp.id, name: p.name, product_id: p.id, stock: p.stock };
      })};
    }
    // shop_products – my store listing (WHERE sp.shop_id)
    if (s.includes('from shop_products sp') && s.includes('join products p') && s.includes('where sp.shop_id')) {
      return { rows: mockDb.shop_products.filter(sp => sp.shop_id === params[0]).map(sp => {
        const p = mockDb.products.find(pr => pr.id === sp.product_id) || {};
        return { ...sp, base_name: p.name, sku: p.sku, price_net: p.price_net, price_gross: p.price_gross, stock: p.stock };
      })};
    }
    // shop_products – shops/:slug/products count
    if (s.includes('count(*)') && s.includes('from shop_products sp') && s.includes('join products p'))
      return { rows: [{ count: String(mockDb.shop_products.length) }] };
    // shop_products – shops/:slug/products listing
    if (s.includes('from shop_products sp') && s.includes('join products p')) {
      return { rows: mockDb.shop_products.filter(sp => sp.shop_id === params[0] && sp.active && sp.status === 'active').map(sp => {
        const p = mockDb.products.find(pr => pr.id === sp.product_id) || {};
        return { ...sp, title: sp.custom_title || p.name, description: p.description };
      })};
    }
    if (s.startsWith('select count(*)') && s.includes('from shop_products'))
      return { rows: [{ count: String(mockDb.shop_products.filter(x => !params[0] || x.shop_id === params[0]).length) }] };
    if (s.includes('from shop_products where shop_id') && s.includes('and product_id')) {
      const row = mockDb.shop_products.find(x => x.shop_id === params[0] && x.product_id === params[1]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into shop_products')) {
      const sp = { id: params[0], shop_id: params[1], product_id: params[2], custom_title: params[3],
        custom_description: params[4], margin_type: params[5], margin_value: params[6], selling_price: params[7],
        active: true, status: 'active', source_snapshot: params[8] ? JSON.parse(params[8]) : null };
      mockDb.shop_products.push(sp);
      return { rows: [sp] };
    }
    if (s.startsWith('update shop_products set')) {
      const id = params[params.length - 1];
      const sp = mockDb.shop_products.find(x => x.id === id);
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
      const idx = mockDb.shop_products.findIndex(x => x.id === params[0]);
      if (idx !== -1) mockDb.shop_products.splice(idx, 1);
      return { rows: [] };
    }

    // carts
    if (s.includes('from carts c') && s.includes('where c.id')) {
      const cart = mockDb.carts.find(c => c.id === params[0]);
      if (!cart) return { rows: [] };
      const store = mockDb.stores.find(s2 => s2.id === cart.shop_id) || {};
      return { rows: [{ ...cart, shop_name: store.name, shop_slug: store.slug }] };
    }
    if (s.includes('from carts c') && s.includes('c.user_id = $2') && s.includes("c.status = 'open'")) {
      const cart = mockDb.carts.find(c => c.id === params[1] && c.user_id === params[0] && c.status === 'open');
      if (!cart) return { rows: [] };
      const store = mockDb.stores.find(st => st.id === cart.shop_id) || {};
      return { rows: [{ ...cart, owner_id: store.owner_id, store_margin: store.margin }] };
    }
    if (s.includes('from carts c') && s.includes("status = 'open'")) {
      const row = mockDb.carts.find(c => c.user_id === params[0] && c.status === 'open');
      if (!row) return { rows: [] };
      const store = mockDb.stores.find(st => st.id === row.shop_id) || {};
      return { rows: [{ ...row, shop_name: store.name, shop_slug: store.slug }] };
    }
    if (s.includes('from carts where user_id') && s.includes("status = 'open'")) {
      const row = mockDb.carts.find(c => c.user_id === params[0] && c.shop_id === params[1] && c.status === 'open');
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into carts')) {
      const cart = { id: params[0], user_id: params[1], shop_id: params[2], status: 'open' };
      mockDb.carts.push(cart);
      return { rows: [cart] };
    }
    if (s.startsWith('update carts set')) {
      const id = params[params.length - 1];
      const cart = mockDb.carts.find(c => c.id === id);
      if (cart && s.includes("'checked_out'")) cart.status = 'checked_out';
      return { rows: [] };
    }

    // cart_items
    if (s.includes('from cart_items ci') && s.includes('where ci.cart_id')) {
      return { rows: mockDb.cart_items.filter(ci => ci.cart_id === params[0]).map(ci => {
        const sp = mockDb.shop_products.find(x => x.id === ci.shop_product_id) || {};
        const p = mockDb.products.find(x => x.id === ci.product_id) || {};
        return { ...ci, selling_price: ci.unit_price, margin_value: sp.margin_value || 0,
          name: p.name || 'Product', stock: p.stock,
          product_title: sp.custom_title || p.name || 'Product', image_url: p.image_url };
      })};
    }
    if (s.includes('from cart_items') && s.includes('where cart_id') && s.includes('shop_product_id')) {
      const row = mockDb.cart_items.find(ci => ci.cart_id === params[0] && ci.shop_product_id === params[1]);
      return { rows: row ? [row] : [] };
    }
    if (s.startsWith('insert into cart_items')) {
      const ci = { id: params[0], cart_id: params[1], product_id: params[2], shop_product_id: params[3], quantity: params[4], unit_price: params[5] };
      mockDb.cart_items.push(ci);
      return { rows: [ci] };
    }
    if (s.startsWith('update cart_items set quantity')) {
      const ci = mockDb.cart_items.find(x => x.id === params[1]);
      if (ci) ci.quantity = params[0];
      return { rows: [] };
    }
    if (s.startsWith('delete from cart_items where id')) {
      const idx = mockDb.cart_items.findIndex(x => x.id === params[0]);
      if (idx !== -1) mockDb.cart_items.splice(idx, 1);
      return { rows: [{ id: params[0] }] };
    }

    // orders
    if (s.startsWith('select count(*)') && s.includes('from orders')) {
      if (s.includes('where buyer_id'))
        return { rows: [{ count: String(mockDb.orders.filter(o => o.buyer_id === params[0]).length) }] };
      return { rows: [{ count: String(mockDb.orders.length) }] };
    }
    if (s.includes('from orders o') && s.includes('join stores s') && s.includes('where o.buyer_id'))
      return { rows: mockDb.orders.filter(o => o.buyer_id === params[0]).map(o => ({ ...o, shop_name: 'Test Shop', shop_slug: 'test-shop' })) };
    if (s.includes('from orders o') && s.includes('join stores s') && s.includes('where o.id')) {
      const row = mockDb.orders.find(o => o.id === params[0]);
      return { rows: row ? [{ ...row, shop_name: 'Test Shop' }] : [] };
    }
    if (s.includes('from orders o') && (s.includes('join stores s') || s.includes('join users u')))
      return { rows: mockDb.orders.map(o => ({ ...o, shop_name: 'Test Shop', buyer_email: 'buyer@test.pl', buyer_name: 'Buyer' })) };
    if (s.includes('from orders where id')) {
      const row = mockDb.orders.find(o => o.id === params[0]);
      return { rows: row ? [row] : [] };
    }
    if (s.includes('from orders') && s.includes('where buyer_id'))
      return { rows: mockDb.orders.filter(o => o.buyer_id === params[0]) };
    if (s.startsWith('insert into orders')) {
      const order = { id: params[0], store_id: params[1], store_owner_id: params[2], buyer_id: params[3],
        status: 'pending', payment_status: 'unpaid', subtotal: params[4],
        platform_fee: params[5], total: params[6], shipping_address: params[7] };
      mockDb.orders.push(order);
      return { rows: [order] };
    }
    if (s.startsWith('update orders set status')) {
      const order = mockDb.orders.find(o => o.id === params[1]);
      if (order) order.status = params[0];
      return { rows: order ? [order] : [] };
    }
    if (s.startsWith('insert into order_items')) {
      mockDb.order_items.push({ id: params[0], order_id: params[1] });
      return { rows: [] };
    }
    if (s.includes('from order_items'))
      return { rows: mockDb.order_items.filter(i => i.order_id === params[0]) };

    return { rows: [] };
  });

  db.transaction.mockImplementation(async (callback) => {
    const fakeClient = { query: db.query };
    return callback(fakeClient);
  });
}

const SELLER_ID  = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_ID   = 'b0000000-0000-4000-8000-000000000002';
const STORE_ID   = 'b0000000-0000-4000-8000-000000000003';
const PRODUCT_ID = 'b0000000-0000-4000-8000-000000000004';
const SP_ID      = 'b0000000-0000-4000-8000-000000000005';

let app, sellerToken, adminToken;

beforeAll(() => {
  process.env.JWT_SECRET = 'marketplace_test_secret';
  process.env.NODE_ENV = 'test';
  setupDbMock();
  app = require('../src/app');
  const { signToken } = require('../src/middleware/auth');
  sellerToken = signToken({ id: SELLER_ID, email: 'seller@marketplace.pl', role: 'seller' });
  adminToken  = signToken({ id: ADMIN_ID,  email: 'admin@marketplace.pl',  role: 'owner' });
  mockDb.users.push(
    { id: SELLER_ID, email: 'seller@marketplace.pl', name: 'Seller', role: 'seller', plan: 'basic' },
    { id: ADMIN_ID,  email: 'admin@marketplace.pl',  name: 'Admin',  role: 'owner',  plan: 'elite' }
  );
  mockDb.stores.push({ id: STORE_ID, owner_id: SELLER_ID, name: 'Test Shop', slug: 'test-shop', margin: 20, status: 'active' });
  mockDb.products.push({ id: PRODUCT_ID, name: 'Global Widget', sku: 'GW-001', price_net: 100, price_gross: 123,
    tax_rate: 23, stock: 50, status: 'active', image_url: null, description: 'A fine widget', category_id: null });
});

beforeEach(() => {
  mockDb.shop_products.length = 0; mockDb.carts.length = 0;
  mockDb.cart_items.length = 0; mockDb.orders.length = 0;
  mockDb.order_items.length = 0; mockDb.audit_logs.length = 0;
  mockDb.categories.length = 0;
});

describe('GET /api/categories', () => {
  it('is public and returns category list', async () => {
    mockDb.categories.push({ id: 'cat-1', name: 'Electronics', slug: 'electronics', status: 'active' });
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('categories');
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});

describe('POST /api/categories', () => {
  it('requires admin role', async () => {
    const res = await request(app).post('/api/categories')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'Narzędzia', slug: 'narzedzia' });
    expect(res.status).toBe(403);
  });
  it('creates a category as admin', async () => {
    const res = await request(app).post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Narzędzia', slug: 'narzedzia' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('slug', 'narzedzia');
  });
  it('rejects duplicate slug', async () => {
    mockDb.categories.push({ id: 'cat-dup', name: 'X', slug: 'narzedzia', status: 'active' });
    const res = await request(app).post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Y', slug: 'narzedzia' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/shops/:slug/products', () => {
  it('returns 404 for unknown shop', async () => {
    const res = await request(app).get('/api/shops/unknown-shop/products');
    expect(res.status).toBe(404);
  });
  it('returns product list for known shop', async () => {
    mockDb.shop_products.push({ id: SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID,
      custom_title: null, margin_type: 'percent', margin_value: 20, selling_price: 147.60, active: true, status: 'active' });
    const res = await request(app).get('/api/shops/test-shop/products');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('products');
  });
});

describe('POST /api/my/store/products', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/my/store/products').send({ product_id: PRODUCT_ID });
    expect(res.status).toBe(401);
  });
  it('adds a global product to the seller store', async () => {
    const res = await request(app).post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ product_id: PRODUCT_ID, margin_type: 'percent', margin_value: 25 });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('product_id', PRODUCT_ID);
    expect(res.body).toHaveProperty('selling_price');
  });
  it('rejects duplicate product in same store', async () => {
    mockDb.shop_products.push({ id: SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID, active: true, status: 'active' });
    const res = await request(app).post('/api/my/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ product_id: PRODUCT_ID });
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/my/store/products/:id', () => {
  beforeEach(() => {
    mockDb.shop_products.push({ id: SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID,
      custom_title: null, margin_type: 'percent', margin_value: 20, selling_price: 147.60, active: true, status: 'active' });
  });
  it('updates custom title', async () => {
    const res = await request(app).patch(`/api/my/store/products/${SP_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ custom_title: 'My Custom Widget' });
    expect(res.status).toBe(200);
  });
  it('returns 403 for non-owner', async () => {
    const { signToken } = require('../src/middleware/auth');
    const otherToken = signToken({ id: 'other-seller-id', email: 'other@pl', role: 'seller' });
    const res = await request(app).patch(`/api/my/store/products/${SP_ID}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ custom_title: 'Hijack' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/my/store/products/:id', () => {
  beforeEach(() => {
    mockDb.shop_products.push({ id: SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID, active: true, status: 'active' });
  });
  it('removes product from store', async () => {
    const res = await request(app).delete(`/api/my/store/products/${SP_ID}`)
      .set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});

describe('GET /api/cart', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });
  it('returns null cart when none open', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.cart).toBeNull();
  });
});

describe('POST /api/cart', () => {
  const CART_SP_ID = 'c0000000-0000-4000-8000-000000000010';
  beforeEach(() => {
    mockDb.shop_products.push({ id: CART_SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID,
      selling_price: 147.60, margin_value: 20, active: true, status: 'active' });
  });
  it('requires authentication', async () => {
    const res = await request(app).post('/api/cart').send({ shop_product_id: CART_SP_ID, quantity: 1 });
    expect(res.status).toBe(401);
  });
  it('adds item to cart and returns updated cart', async () => {
    const res = await request(app).post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_product_id: CART_SP_ID, quantity: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cart');
    expect(res.body.cart).toHaveProperty('items');
    expect(res.body.cart.items.length).toBe(1);
    expect(res.body.cart).toHaveProperty('subtotal');
  });
  it('rejects quantity exceeding stock', async () => {
    const res = await request(app).post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ shop_product_id: CART_SP_ID, quantity: 999 });
    expect(res.status).toBe(422);
  });
  it('rejects missing shop_product_id', async () => {
    const res = await request(app).post('/api/cart')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ quantity: 1 });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/orders', () => {
  const ORDER_SP_ID = 'd0000000-0000-4000-8000-000000000020';
  beforeEach(() => {
    mockDb.shop_products.push({ id: ORDER_SP_ID, shop_id: STORE_ID, product_id: PRODUCT_ID,
      selling_price: 147.60, margin_value: 20, active: true, status: 'active' });
  });
  it('requires authentication', async () => {
    const res = await request(app).post('/api/orders')
      .send({ items: [{ shop_product_id: ORDER_SP_ID, quantity: 1 }], shipping_address: 'Test 1' });
    expect(res.status).toBe(401);
  });
  it('rejects missing shipping address', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ items: [{ shop_product_id: ORDER_SP_ID, quantity: 1 }] });
    expect(res.status).toBe(422);
  });
  it('creates order using items array', async () => {
    const res = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ items: [{ shop_product_id: ORDER_SP_ID, quantity: 2 }], shipping_address: 'ul. Testowa 1, 00-001 Warszawa' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('store_id', STORE_ID);
    expect(res.body).toHaveProperty('status', 'pending');
    expect(res.body).toHaveProperty('items');
  });
});

describe('GET /api/orders/my', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/orders/my');
    expect(res.status).toBe(401);
  });
  it('returns buyer orders', async () => {
    mockDb.orders.push({ id: 'order-1', store_id: STORE_ID, buyer_id: SELLER_ID, status: 'pending' });
    const res = await request(app).get('/api/orders/my').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
    expect(Array.isArray(res.body.orders)).toBe(true);
  });
});

describe('GET /api/admin/orders', () => {
  it('requires admin role', async () => {
    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });
  it('returns orders list for admin', async () => {
    mockDb.orders.push({ id: 'adm-order-1', store_id: STORE_ID, buyer_id: SELLER_ID, status: 'pending' });
    const res = await request(app).get('/api/admin/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('orders');
  });
});

describe('GET /api/admin/audit-logs', () => {
  it('requires admin role', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${sellerToken}`);
    expect(res.status).toBe(403);
  });
  it('returns audit logs for admin', async () => {
    const res = await request(app).get('/api/admin/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
  });
});
