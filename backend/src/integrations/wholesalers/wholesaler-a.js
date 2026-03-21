'use strict';

/**
 * Wholesaler A – Mock connector (Electronics & Gadgets)
 *
 * Standard output format:
 * {
 *   source, external_id, name, cost_price, image,
 *   category, stock, created_at, rating, sales,
 *   shipping_time, currency
 * }
 */

const SOURCE = 'wholesaler-a';

const PRODUCTS = [
  {
    external_id: 'wa-001',
    name: 'Smartfon Samsung Galaxy A54',
    cost_price: 1299,
    image: 'https://cdn.qualitet.pl/products/samsung-a54.jpg',
    category: 'smartfony',
    stock: 45,
    created_at: '2024-09-01T10:00:00Z',
    rating: 4.5,
    sales: 120,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-002',
    name: 'Laptop Lenovo IdeaPad 3',
    cost_price: 2499,
    image: 'https://cdn.qualitet.pl/products/lenovo-ideapad3.jpg',
    category: 'komputery-i-laptopy',
    stock: 18,
    created_at: '2024-09-05T08:00:00Z',
    rating: 4.2,
    sales: 55,
    shipping_time: 3,
    currency: 'PLN',
  },
  {
    external_id: 'wa-003',
    name: 'Słuchawki Sony WH-1000XM5',
    cost_price: 899,
    image: 'https://cdn.qualitet.pl/products/sony-wh1000xm5.jpg',
    category: 'elektronika',
    stock: 30,
    created_at: '2024-09-10T09:30:00Z',
    rating: 4.8,
    sales: 88,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-004',
    name: 'Kamera GoPro Hero 12',
    cost_price: 1599,
    image: 'https://cdn.qualitet.pl/products/gopro-hero12.jpg',
    category: 'elektronika',
    stock: 12,
    created_at: '2024-09-15T14:00:00Z',
    rating: 4.6,
    sales: 42,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-005',
    name: 'Tablet Apple iPad Air',
    cost_price: 3499,
    image: 'https://cdn.qualitet.pl/products/ipad-air.jpg',
    category: 'elektronika',
    stock: 25,
    created_at: '2024-09-20T11:00:00Z',
    rating: 4.9,
    sales: 200,
    shipping_time: 1,
    currency: 'PLN',
  },
  {
    external_id: 'wa-006',
    name: 'Monitor LG 27" 4K',
    cost_price: 1399,
    image: 'https://cdn.qualitet.pl/products/lg-monitor-4k.jpg',
    category: 'komputery-i-laptopy',
    stock: 22,
    created_at: '2024-10-01T15:00:00Z',
    rating: 4.6,
    sales: 40,
    shipping_time: 3,
    currency: 'PLN',
  },
  {
    external_id: 'wa-007',
    name: 'Aparat fotograficzny Sony A7 IV',
    cost_price: 10999,
    image: 'https://cdn.qualitet.pl/products/sony-a7iv.jpg',
    category: 'elektronika',
    stock: 8,
    created_at: '2024-10-05T11:30:00Z',
    rating: 4.9,
    sales: 30,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-008',
    name: 'Konsola PlayStation 5',
    cost_price: 2499,
    image: 'https://cdn.qualitet.pl/products/ps5.jpg',
    category: 'gaming',
    stock: 15,
    created_at: '2024-10-10T10:00:00Z',
    rating: 4.9,
    sales: 300,
    shipping_time: 1,
    currency: 'PLN',
  },
  {
    external_id: 'wa-009',
    name: 'Telewizor Samsung QLED 65"',
    cost_price: 4999,
    image: 'https://cdn.qualitet.pl/products/samsung-qled65.jpg',
    category: 'tv-i-audio',
    stock: 10,
    created_at: '2024-10-15T09:00:00Z',
    rating: 4.7,
    sales: 80,
    shipping_time: 4,
    currency: 'PLN',
  },
  {
    external_id: 'wa-010',
    name: 'Hulajnoga elektryczna Xiaomi Pro 2',
    cost_price: 1999,
    image: 'https://cdn.qualitet.pl/products/xiaomi-scooter.jpg',
    category: 'motoryzacja',
    stock: 20,
    created_at: '2024-10-20T08:00:00Z',
    rating: 4.4,
    sales: 65,
    shipping_time: 3,
    currency: 'PLN',
  },
  {
    external_id: 'wa-011',
    name: 'Klawiatura mechaniczna Keychron K6',
    cost_price: 349,
    image: 'https://cdn.qualitet.pl/products/keychron-k6.jpg',
    category: 'komputery-i-laptopy',
    stock: 35,
    created_at: '2024-11-01T10:00:00Z',
    rating: 4.7,
    sales: 25,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-012',
    name: 'Drukarka 3D Bambu Lab X1C',
    cost_price: 4299,
    image: 'https://cdn.qualitet.pl/products/bambu-x1c.jpg',
    category: 'elektronika',
    stock: 7,
    created_at: '2024-11-10T12:00:00Z',
    rating: 4.8,
    sales: 22,
    shipping_time: 5,
    currency: 'PLN',
  },
  // intentionally invalid products (will be filtered out)
  {
    external_id: 'wa-bad-001',
    name: '',
    cost_price: 200,
    image: 'https://cdn.qualitet.pl/products/noname.jpg',
    category: 'elektronika',
    stock: 5,
    created_at: '2024-11-15T08:00:00Z',
    rating: 4.2,
    sales: 30,
    shipping_time: 2,
    currency: 'PLN',
  },
  {
    external_id: 'wa-bad-002',
    name: 'Kabel USB',
    cost_price: 10,
    image: 'https://cdn.qualitet.pl/products/cable.jpg',
    category: 'elektronika',
    stock: 100,
    created_at: '2024-11-15T08:00:00Z',
    rating: 4.0,
    sales: 50,
    shipping_time: 1,
    currency: 'PLN',
  },
];

/**
 * Fetch products from Wholesaler A.
 * MVP: returns static data.  Replace with real HTTP call when available.
 *
 * @returns {Promise<Array>}
 */
async function fetchProducts() {
  return PRODUCTS.map((p) => ({ source: SOURCE, ...p }));
}

module.exports = { SOURCE, fetchProducts, PRODUCTS };
