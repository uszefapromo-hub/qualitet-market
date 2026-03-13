const API_BASE = 'http://localhost:5000/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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
    trending: () => request('/products?sort=trending&limit=20'),
  },
  stores: {
    list: () => request('/stores'),
    get: (id: string) => request(`/stores/${id}`),
  },
  affiliate: {
    stats: () => request('/affiliate/stats'),
    links: () => request('/affiliate/links'),
  },
  ai: {
    chat: (message: string) => request('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  },
  seller: {
    dashboard: () => request('/my/dashboard'),
    orders: () => request('/my/orders'),
  },
};

export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} PLN`;
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
