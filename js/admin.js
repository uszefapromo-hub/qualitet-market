/* jshint esversion: 11 */
'use strict';

/**
 * SuperAdmin Panel – client-side JS
 * Communicates with /api/admin/* endpoints.
 * Requires role === 'superadmin' (enforced server-side).
 */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : '';

// ─── State ────────────────────────────────────────────────────────────────────
let token   = localStorage.getItem('qa_admin_token') || '';
let currentUser = null;
let activePanel = 'dashboard';

const pages = {
  dashboard:     { title: 'Dashboard' },
  users:         { title: 'Użytkownicy', page: 1 },
  shops:         { title: 'Sklepy',       page: 1 },
  products:      { title: 'Produkty',     page: 1 },
  suppliers:     { title: 'Hurtownie',    page: 1 },
  orders:        { title: 'Zamówienia',   page: 1 },
  subscriptions: { title: 'Subskrypcje',  page: 1 },
  audit:         { title: 'Audyt',        page: 1 },
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(n) {
  return new Intl.NumberFormat('pl-PL').format(n || 0);
}

function fmtCurrency(n) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n || 0);
}

function fmtDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
}

function statusBadge(status) {
  const map = {
    active:    'green',
    paid:      'green',
    delivered: 'green',
    trial:     'yellow',
    pending:   'yellow',
    created:   'yellow',
    processing:'blue',
    shipped:   'blue',
    basic:     'blue',
    pro:       'blue',
    elite:     'blue',
    suspended: 'red',
    banned:    'red',
    cancelled: 'red',
    expired:   'red',
    inactive:  'gray',
    superseded:'gray',
    manual:    'gray',
    api:       'blue',
    xml:       'blue',
    csv:       'blue',
  };
  const cls = map[status] || 'gray';
  return `<span class="badge badge-${cls}">${escHtml(status)}</span>`;
}

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    logout();
    throw new Error('Sesja wygasła');
  }
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function login(email, password) {
  const data = await apiFetch('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data.user.role !== 'superadmin') {
    throw new Error('Dostęp tylko dla superadmin');
  }

  token = data.token;
  currentUser = data.user;
  localStorage.setItem('qa_admin_token', token);
  showApp();
}

function logout() {
  token = '';
  currentUser = null;
  localStorage.removeItem('qa_admin_token');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-area').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-area').style.display = 'flex';
  document.getElementById('admin-email').textContent = currentUser?.email || '';
  document.getElementById('user-badge').textContent  = currentUser?.role  || 'superadmin';
  loadPanel(activePanel);
}

async function tryAutoLogin() {
  if (!token) return;
  try {
    const me = await apiFetch('/api/users/me');
    if (me.role !== 'superadmin') { logout(); return; }
    currentUser = me;
    showApp();
  } catch {
    logout();
  }
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const panel = document.getElementById(`panel-${name}`);
  const nav   = document.querySelector(`.nav-item[data-panel="${name}"]`);
  if (!panel) return;

  panel.classList.add('active');
  if (nav) nav.classList.add('active');

  document.getElementById('page-title').textContent = pages[name]?.title || name;
  activePanel = name;
  loadPanel(name);
}

function loadPanel(name) {
  switch (name) {
    case 'dashboard':     loadDashboard();       break;
    case 'users':         loadUsers();           break;
    case 'shops':         loadShops();           break;
    case 'products':      loadProducts();        break;
    case 'suppliers':     loadSuppliers();       break;
    case 'orders':        loadOrders();          break;
    case 'subscriptions': loadSubscriptions();   break;
    case 'audit':         loadAudit();           break;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    const data = await apiFetch('/api/admin/dashboard');
    const s = data.stats;

    document.getElementById('s-users').textContent    = fmt(s.users);
    document.getElementById('s-stores').textContent   = fmt(s.stores);
    document.getElementById('s-products').textContent = fmt(s.products);
    document.getElementById('s-orders').textContent   = fmt(s.orders);
    document.getElementById('s-daily').textContent    = fmtCurrency(s.daily_sales);
    document.getElementById('s-monthly').textContent  = fmtCurrency(s.monthly_sales);
    document.getElementById('s-new-shops').textContent = fmt(s.new_shops);
    document.getElementById('s-new-users').textContent = fmt(s.new_users);

    const recentOrders = document.getElementById('recent-orders');
    recentOrders.innerHTML = (data.recent_orders || []).map(o => `
      <tr>
        <td style="font-family:monospace;font-size:.7rem">${escHtml(o.id.slice(0,8))}…</td>
        <td>${escHtml(o.store_name)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${fmtCurrency(o.total)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="color:var(--muted);text-align:center">Brak danych</td></tr>';

    const recentShops = document.getElementById('recent-shops');
    recentShops.innerHTML = (data.recent_shops || []).map(s => `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${statusBadge(s.plan)}</td>
        <td>${statusBadge(s.status)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="color:var(--muted);text-align:center">Brak danych</td></tr>';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Generic pagination renderer ──────────────────────────────────────────────

function renderPagination(containerId, total, page, limit, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  let pagesHtml = '';
  for (let i = 1; i <= Math.min(totalPages, 7); i++) {
    pagesHtml += `<button class="${i === page ? 'current' : ''}" data-p="${i}">${i}</button>`;
  }
  if (totalPages > 7) pagesHtml += `<span style="color:var(--muted)"> … ${totalPages}</span>`;

  el.innerHTML = `
    <span>${total} rekordów</span>
    <div class="pages">
      <button data-p="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>
      ${pagesHtml}
      <button data-p="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>
    </div>
  `;

  el.querySelectorAll('button[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.p, 10);
      if (!isNaN(p) && p >= 1 && p <= totalPages) onPageChange(p);
    });
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function loadUsers(page = pages.users.page) {
  pages.users.page = page;
  const search = document.getElementById('users-search')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
  try {
    const data = await apiFetch(`/api/admin/users?${params}`);
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = (data.users || []).map(u => `
      <tr>
        <td>${escHtml(u.email)}</td>
        <td>${escHtml(u.name)}</td>
        <td>${statusBadge(u.role)}</td>
        <td>${statusBadge(u.plan)}</td>
        <td>${u.blocked ? '<span style="color:var(--danger)">✗</span>' : '<span style="color:var(--success)">✓</span>'}</td>
        <td>${fmtDate(u.created_at)}</td>
        <td><div class="action-btns">
          <button onclick="openEditUser('${escHtml(u.id)}','${escHtml(u.name)}','${escHtml(u.role)}','${escHtml(u.plan)}',${!!u.blocked})">Edytuj</button>
          <button class="del" onclick="deleteUser('${escHtml(u.id)}')">Usuń</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="color:var(--muted);text-align:center">Brak użytkowników</td></tr>';

    renderPagination('users-pagination', data.total, page, 20, loadUsers);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditUser(id, name, role, plan, blocked) {
  document.getElementById('modal-user-id').value      = id;
  document.getElementById('modal-user-name').value    = name;
  document.getElementById('modal-user-role').value    = role;
  document.getElementById('modal-user-plan').value    = plan;
  document.getElementById('modal-user-blocked').checked = blocked;
  document.getElementById('modal-user-title').textContent = 'Edytuj użytkownika';
  document.getElementById('modal-user').classList.add('open');
}

async function saveUser() {
  const id = document.getElementById('modal-user-id').value;
  const body = {
    name:    document.getElementById('modal-user-name').value,
    role:    document.getElementById('modal-user-role').value,
    plan:    document.getElementById('modal-user-plan').value,
    blocked: document.getElementById('modal-user-blocked').checked,
  };
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    showToast('Użytkownik zaktualizowany');
    document.getElementById('modal-user').classList.remove('open');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Usunąć użytkownika? Tej operacji nie można cofnąć.')) return;
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    showToast('Użytkownik usunięty');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addUser() {
  const body = {
    email:    document.getElementById('add-user-email').value,
    name:     document.getElementById('add-user-name').value,
    password: document.getElementById('add-user-password').value,
    role:     document.getElementById('add-user-role').value,
  };
  try {
    await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) });
    showToast('Użytkownik dodany');
    document.getElementById('modal-add-user').classList.remove('open');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Shops ────────────────────────────────────────────────────────────────────

async function loadShops(page = pages.shops.page) {
  pages.shops.page = page;
  const status = document.getElementById('shops-status-filter')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(status ? { status } : {}) });
  try {
    const data = await apiFetch(`/api/admin/shops?${params}`);
    const tbody = document.getElementById('shops-tbody');
    tbody.innerHTML = (data.shops || []).map(s => `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${escHtml(s.owner_name || s.owner_email || '–')}</td>
        <td>${statusBadge(s.plan)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>–</td><td>–</td>
        <td><div class="action-btns">
          <button onclick="openEditShop('${escHtml(s.id)}','${escHtml(s.name)}','${escHtml(s.status)}','${escHtml(s.plan)}',${parseFloat(s.margin)||0})">Edytuj</button>
          <button class="del" onclick="deleteShop('${escHtml(s.id)}')">Usuń</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="color:var(--muted);text-align:center">Brak sklepów</td></tr>';

    renderPagination('shops-pagination', data.total, page, 20, loadShops);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditShop(id, name, status, plan, margin) {
  document.getElementById('modal-shop-id').value     = id;
  document.getElementById('modal-shop-name').value   = name;
  document.getElementById('modal-shop-status').value = status;
  document.getElementById('modal-shop-plan').value   = plan;
  document.getElementById('modal-shop-margin').value = margin;
  document.getElementById('modal-shop').classList.add('open');
}

async function saveShop() {
  const id = document.getElementById('modal-shop-id').value;
  const body = {
    name:   document.getElementById('modal-shop-name').value,
    status: document.getElementById('modal-shop-status').value,
    plan:   document.getElementById('modal-shop-plan').value,
    margin: parseFloat(document.getElementById('modal-shop-margin').value) || undefined,
  };
  try {
    await apiFetch(`/api/admin/shops/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    showToast('Sklep zaktualizowany');
    document.getElementById('modal-shop').classList.remove('open');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteShop(id) {
  if (!confirm('Usunąć sklep? Tej operacji nie można cofnąć.')) return;
  try {
    await apiFetch(`/api/admin/shops/${id}`, { method: 'DELETE' });
    showToast('Sklep usunięty');
    loadShops();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function loadProducts(page = pages.products.page) {
  pages.products.page = page;
  const search = document.getElementById('products-search')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
  try {
    const data = await apiFetch(`/api/admin/products?${params}`);
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = (data.products || []).map(p => `
      <tr>
        <td>${escHtml(p.name)}</td>
        <td><code style="font-size:.7rem">${escHtml(p.sku || '–')}</code></td>
        <td>${escHtml(p.store_name || '–')}</td>
        <td>${statusBadge(p.type || 'own')}</td>
        <td>${fmtCurrency(p.price_gross)}</td>
        <td>${fmt(p.stock)}</td>
        <td><div class="action-btns">
          <button class="del" onclick="deleteProduct('${escHtml(p.id)}')">Usuń</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="color:var(--muted);text-align:center">Brak produktów</td></tr>';

    renderPagination('products-pagination', data.total, page, 20, loadProducts);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Usunąć produkt?')) return;
  try {
    await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    showToast('Produkt usunięty');
    loadProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

async function loadSuppliers(page = pages.suppliers.page) {
  pages.suppliers.page = page;
  const params = new URLSearchParams({ page, limit: 20 });
  try {
    const data = await apiFetch(`/api/admin/suppliers?${params}`);
    const tbody = document.getElementById('suppliers-tbody');
    tbody.innerHTML = (data.suppliers || []).map(s => `
      <tr>
        <td>${escHtml(s.name)}</td>
        <td>${statusBadge(s.integration_type)}</td>
        <td>${escHtml(s.country || '–')}</td>
        <td>${statusBadge(s.status || (s.active ? 'active' : 'inactive'))}</td>
        <td>${fmtDate(s.last_sync_at)}</td>
        <td><div class="action-btns">
          <button onclick="openEditSupplier('${escHtml(s.id)}','${escHtml(s.name)}','${escHtml(s.integration_type)}','${escHtml(s.api_url||'')}','${escHtml(s.country||'')}',${parseFloat(s.margin)||0})">Edytuj</button>
          <button class="del" onclick="deleteSupplier('${escHtml(s.id)}')">Usuń</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:var(--muted);text-align:center">Brak hurtowni</td></tr>';

    renderPagination('suppliers-pagination', data.total, page, 20, loadSuppliers);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAddSupplier() {
  document.getElementById('modal-supplier-id').value      = '';
  document.getElementById('modal-supplier-name').value    = '';
  document.getElementById('modal-supplier-type').value    = 'manual';
  document.getElementById('modal-supplier-url').value     = '';
  document.getElementById('modal-supplier-country').value = '';
  document.getElementById('modal-supplier-margin').value  = '0';
  document.getElementById('modal-supplier-title').textContent = 'Dodaj hurtownię';
  document.getElementById('modal-supplier').classList.add('open');
}

function openEditSupplier(id, name, type, url, country, margin) {
  document.getElementById('modal-supplier-id').value      = id;
  document.getElementById('modal-supplier-name').value    = name;
  document.getElementById('modal-supplier-type').value    = type;
  document.getElementById('modal-supplier-url').value     = url;
  document.getElementById('modal-supplier-country').value = country;
  document.getElementById('modal-supplier-margin').value  = margin;
  document.getElementById('modal-supplier-title').textContent = 'Edytuj hurtownię';
  document.getElementById('modal-supplier').classList.add('open');
}

async function saveSupplier() {
  const id = document.getElementById('modal-supplier-id').value;
  const body = {
    name:             document.getElementById('modal-supplier-name').value,
    integration_type: document.getElementById('modal-supplier-type').value,
    api_url:          document.getElementById('modal-supplier-url').value || null,
    country:          document.getElementById('modal-supplier-country').value || null,
    margin:           parseFloat(document.getElementById('modal-supplier-margin').value) || 0,
  };
  try {
    if (id) {
      await apiFetch(`/api/admin/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      showToast('Hurtownia zaktualizowana');
    } else {
      await apiFetch('/api/admin/suppliers', { method: 'POST', body: JSON.stringify(body) });
      showToast('Hurtownia dodana');
    }
    document.getElementById('modal-supplier').classList.remove('open');
    loadSuppliers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSupplier(id) {
  if (!confirm('Usunąć hurtownię?')) return;
  try {
    await apiFetch(`/api/admin/suppliers/${id}`, { method: 'DELETE' });
    showToast('Hurtownia usunięta');
    loadSuppliers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────

async function loadOrders(page = pages.orders.page) {
  pages.orders.page = page;
  const status = document.getElementById('orders-status-filter')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(status ? { status } : {}) });
  try {
    const data = await apiFetch(`/api/admin/orders?${params}`);
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = (data.orders || []).map(o => `
      <tr>
        <td style="font-family:monospace;font-size:.7rem">${escHtml(o.id.slice(0,8))}…</td>
        <td>${escHtml(o.store_name || o.store_id)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${fmtCurrency(o.total)}</td>
        <td>${fmtDate(o.created_at)}</td>
        <td><div class="action-btns">
          <button onclick="openEditOrder('${escHtml(o.id)}','${escHtml(o.status)}')">Status</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:var(--muted);text-align:center">Brak zamówień</td></tr>';

    renderPagination('orders-pagination', data.total, page, 20, loadOrders);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditOrder(id, status) {
  document.getElementById('modal-order-id').value     = id;
  document.getElementById('modal-order-status').value = status;
  document.getElementById('modal-order').classList.add('open');
}

async function saveOrder() {
  const id     = document.getElementById('modal-order-id').value;
  const status = document.getElementById('modal-order-status').value;
  try {
    await apiFetch(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    showToast('Status zamówienia zmieniony');
    document.getElementById('modal-order').classList.remove('open');
    loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

async function loadSubscriptions(page = pages.subscriptions.page) {
  pages.subscriptions.page = page;
  const params = new URLSearchParams({ page, limit: 20 });
  try {
    const data = await apiFetch(`/api/admin/subscriptions?${params}`);
    const tbody = document.getElementById('subscriptions-tbody');
    tbody.innerHTML = (data.subscriptions || []).map(s => `
      <tr>
        <td>${escHtml(s.email || s.user_id)}</td>
        <td>${statusBadge(s.plan)}</td>
        <td>${statusBadge(s.status)}</td>
        <td>${fmtDate(s.ends_at)}</td>
        <td><div class="action-btns">
          <button onclick="openEditSub('${escHtml(s.id)}','${escHtml(s.plan)}','${escHtml(s.status)}')">Edytuj</button>
        </div></td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="color:var(--muted);text-align:center">Brak subskrypcji</td></tr>';

    renderPagination('subscriptions-pagination', data.total, page, 20, loadSubscriptions);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openEditSub(id, plan, status) {
  document.getElementById('modal-sub-id').value     = id;
  document.getElementById('modal-sub-plan').value   = plan;
  document.getElementById('modal-sub-status').value = status;
  document.getElementById('modal-subscription').classList.add('open');
}

async function saveSub() {
  const id     = document.getElementById('modal-sub-id').value;
  const plan   = document.getElementById('modal-sub-plan').value;
  const status = document.getElementById('modal-sub-status').value;
  try {
    await apiFetch(`/api/admin/subscriptions/${id}`, { method: 'PATCH', body: JSON.stringify({ plan, status }) });
    showToast('Subskrypcja zaktualizowana');
    document.getElementById('modal-subscription').classList.remove('open');
    loadSubscriptions();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function loadAudit(page = pages.audit.page) {
  pages.audit.page = page;
  const action = document.getElementById('audit-action-filter')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(action ? { action } : {}) });
  try {
    const data = await apiFetch(`/api/admin/audit-logs?${params}`);
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = (data.logs || []).map(l => `
      <tr>
        <td>${escHtml(l.user_email || l.user_id || '–')}</td>
        <td><code style="font-size:.7rem">${escHtml(l.action)}</code></td>
        <td>${escHtml(l.resource || '–')}</td>
        <td style="font-family:monospace;font-size:.7rem">${escHtml((l.resource_id||'').slice(0,8)) || '–'}</td>
        <td>${escHtml(l.ip_address || '–')}</td>
        <td>${fmtDate(l.created_at)}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="color:var(--muted);text-align:center">Brak logów</td></tr>';

    renderPagination('audit-pagination', data.total, page, 20, loadAudit);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Event bindings ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Login
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    document.getElementById('login-error').textContent = '';
    try {
      await login(email, password);
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
    }
  });

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('logout-btn').addEventListener('click', logout);

  // Navigation
  document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
    item.addEventListener('click', () => showPanel(item.dataset.panel));
  });

  // Users
  document.getElementById('users-search').addEventListener('input', () => loadUsers(1));
  document.getElementById('users-add-btn').addEventListener('click', () =>
    document.getElementById('modal-add-user').classList.add('open'));
  document.getElementById('modal-user-save').addEventListener('click', saveUser);
  document.getElementById('modal-user-cancel').addEventListener('click', () =>
    document.getElementById('modal-user').classList.remove('open'));
  document.getElementById('modal-add-user-save').addEventListener('click', addUser);
  document.getElementById('modal-add-user-cancel').addEventListener('click', () =>
    document.getElementById('modal-add-user').classList.remove('open'));

  // Shops
  document.getElementById('shops-status-filter').addEventListener('change', () => loadShops(1));
  document.getElementById('modal-shop-save').addEventListener('click', saveShop);
  document.getElementById('modal-shop-cancel').addEventListener('click', () =>
    document.getElementById('modal-shop').classList.remove('open'));

  // Products
  document.getElementById('products-search').addEventListener('input', () => loadProducts(1));

  // Suppliers
  document.getElementById('suppliers-add-btn').addEventListener('click', openAddSupplier);
  document.getElementById('modal-supplier-save').addEventListener('click', saveSupplier);
  document.getElementById('modal-supplier-cancel').addEventListener('click', () =>
    document.getElementById('modal-supplier').classList.remove('open'));

  // Orders
  document.getElementById('orders-status-filter').addEventListener('change', () => loadOrders(1));
  document.getElementById('modal-order-save').addEventListener('click', saveOrder);
  document.getElementById('modal-order-cancel').addEventListener('click', () =>
    document.getElementById('modal-order').classList.remove('open'));

  // Subscriptions
  document.getElementById('modal-sub-save').addEventListener('click', saveSub);
  document.getElementById('modal-sub-cancel').addEventListener('click', () =>
    document.getElementById('modal-subscription').classList.remove('open'));

  // Audit
  document.getElementById('audit-action-filter').addEventListener('input', () => loadAudit(1));

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Auto-login if token exists
  tryAutoLogin();
});
