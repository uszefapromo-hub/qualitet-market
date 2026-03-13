const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (data: object) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  },
  products: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/products${qs}`);
    },
    get: (id: string) => request(`/products/${id}`),
    trending: () => request('/products?sort=trending&limit=20'),
  },
  stores: {
    list: (params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request(`/stores${qs}`);
    },
    get: (id: string) => request(`/stores/${id}`),
  },
  orders: {
    list: () => request('/orders'),
    create: (data: object) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
  },
  cart: {
    get: () => request('/cart'),
    add: (productId: string, quantity: number) => request('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
    update: (itemId: string, quantity: number) => request(`/cart/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) }),
    remove: (itemId: string) => request(`/cart/items/${itemId}`, { method: 'DELETE' }),
  },
  seller: {
    dashboard: () => request('/my/dashboard'),
    products: () => request('/my/products'),
    orders: () => request('/my/orders'),
  },
  affiliate: {
    stats: () => request('/affiliate/stats'),
    links: () => request('/affiliate/links'),
    createLink: (productId: string) => request('/affiliate/links', { method: 'POST', body: JSON.stringify({ productId }) }),
  },
  ai: {
    chat: (message: string, conversationId?: string) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ message, conversationId }) }),
    conversations: () => request('/ai/conversations'),
  },
  admin: {
    analytics: () => request('/admin/analytics'),
    users: () => request('/admin/users'),
    stores: () => request('/admin/stores'),
  },
};
