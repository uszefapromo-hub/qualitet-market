// Environment-based API configuration.
// In development set EXPO_PUBLIC_API_URL in mobile/.env.local (or .env).
// In production / staging set it in your CI/CD environment or app config.
// The default points to the Android emulator loopback. Physical devices and
// iOS simulators require the machine's LAN IP – use .env.local to override.
const DEFAULT_DEV_URL = 'http://10.0.2.2:5000/api'; // Android emulator loopback
const API_BASE: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? DEFAULT_DEV_URL;

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

const TOKEN_STORAGE_KEY = 'qm_auth_token';

// In-memory cache of the current auth token so we don't need an async read on
// every request.  Populated by loadPersistedToken() on app startup.
let authToken: string | null = null;

// Lazy import of expo-secure-store to avoid crashing on web / test environments.
async function getSecureStore() {
  try {
    return (await import('expo-secure-store')) as typeof import('expo-secure-store');
  } catch {
    return null;
  }
}

/**
 * Persist the token to secure device storage so it survives app restarts.
 */
async function persistToken(token: string | null): Promise<void> {
  const store = await getSecureStore();
  if (!store) return;
  try {
    if (token) {
      await store.setItemAsync(TOKEN_STORAGE_KEY, token);
    } else {
      await store.deleteItemAsync(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Non-fatal: continue even if secure storage is unavailable.
  }
}

/**
 * Load the persisted token from secure storage on app startup.
 * Call this once from the root layout's useEffect so the in-memory token is
 * populated before any authenticated request is made.
 */
export async function loadPersistedToken(): Promise<string | null> {
  const store = await getSecureStore();
  if (!store) return null;
  try {
    const stored = await store.getItemAsync(TOKEN_STORAGE_KEY);
    if (stored) authToken = stored;
    return stored;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
  persistToken(token);
}

/** Returns the currently configured API base URL (useful for debugging). */
export function getApiBase(): string {
  return API_BASE;
}

async function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function request<T>(
  path: string,
  options?: RequestInit,
  attempt = 1,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  } catch (error) {
    const isNetworkError =
      error instanceof TypeError && error.message.toLowerCase().includes('network');
    if (isNetworkError && attempt < RETRY_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempt);
      return request<T>(path, options, attempt + 1);
    }
    if (isNetworkError) {
      throw new Error(
        'Brak połączenia z siecią. Sprawdź swoje połączenie internetowe i spróbuj ponownie.',
      );
    }
    throw error;
  }
}

export const api = {
  auth: {
    login: (email: string, password: string) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (data: object) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    refresh: () => request('/auth/refresh', { method: 'POST' }),
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
