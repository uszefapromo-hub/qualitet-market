(function () {
  const API_BASE = window.QM_API_BASE || window.location.origin;
  const DEFAULT_MARGIN = 35;
  const STORE_CACHE_KEY = "qm_operator_store";
  const AUTO_SYNC_MS = 30000;

  const state = {
    store: null,
    syncTimer: null,
    lastSyncAt: null,
  };

  function getQMApi() {
    return window.QMApi || null;
  }

  async function apiCall(methodName, fallbackUrl, options = {}) {
    const api = getQMApi();

    if (api && typeof api[methodName] === "function") {
      return api[methodName](...(options.args || []));
    }

    const res = await fetch(`${API_BASE}${fallbackUrl}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${fallbackUrl} failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  function withMargin(basePrice, margin = DEFAULT_MARGIN) {
    const price = Number(basePrice);
    const pct = Number(margin);
    if (isNaN(price) || isNaN(pct)) return 0;
    return Math.round(price * (1 + pct / 100));
  }

  function normalizeProduct(product, margin) {
    const basePrice =
      Number(product.basePrice ?? product.base_price ?? product.wholesalePrice ?? product.price ?? 0);

    return {
      id: product.id,
      name: product.name || product.title || "Produkt",
      image: product.image || product.thumbnail || product.photo || "",
      sourceName: product.supplierName || product.supplier || product.wholesaler || "Hurtownia",
      category: product.category || "nowości",
      isNew: Boolean(product.isNew ?? product.is_new ?? true),
      stock: Number(product.stock ?? product.quantity ?? 0),
      basePrice,
      finalPrice: withMargin(basePrice, margin),
      margin,
      raw: product,
    };
  }

  async function createStoreFromDescription({ description, margin = DEFAULT_MARGIN }) {
    const payload = {
      description,
      margin,
      mode: "auto",
      autoImport: true,
      autoPricing: true,
      autoSyncNewProducts: true,
    };

    const data = await apiCall(
      "createStore",
      "/api/stores",
      { method: "POST", body: payload, args: [payload] }
    );

    const store = {
      id: data.id || data.storeId || data.store?.id,
      slug: data.slug || data.store?.slug || null,
      name: data.name || data.store?.name || "Twój Sklep",
      description,
      margin,
      products: [],
    };

    state.store = store;
    persistStore();
    return store;
  }

  async function fetchSupplierProducts() {
    try {
      return await apiCall(
        "getSupplierProducts",
        "/api/suppliers/products?sort=newest&status=active",
        { method: "GET", args: [] }
      );
    } catch (e1) {
      try {
        return await apiCall(
          "getProducts",
          "/api/products?source=suppliers&sort=newest",
          { method: "GET", args: [] }
        );
      } catch (e2) {
        return await apiCall(
          "listProducts",
          "/api/listing/products?sort=newest",
          { method: "GET", args: [] }
        );
      }
    }
  }

  async function attachProductsToStore(storeId, products) {
    const payload = {
      products: products.map((p) => ({
        externalProductId: p.id,
        name: p.name,
        basePrice: p.basePrice,
        price: p.finalPrice,
        margin: p.margin,
        image: p.image,
        sourceName: p.sourceName,
        category: p.category,
        stock: p.stock,
        isNew: p.isNew,
      })),
    };

    try {
      return await apiCall(
        "attachProductsToStore",
        `/api/stores/${storeId}/products/import`,
        { method: "POST", body: payload, args: [storeId, payload] }
      );
    } catch (e1) {
      return await apiCall(
        "importStoreProducts",
        `/api/shop-products/import`,
        { method: "POST", body: { storeId, ...payload }, args: [{ storeId, ...payload }] }
      );
    }
  }

  async function importNewestProductsIntoStore() {
    if (!state.store?.id) throw new Error("Brak sklepu");

    const raw = await fetchSupplierProducts();
    const list = Array.isArray(raw)
      ? raw
      : raw.items || raw.products || raw.data || [];

    const normalized = list.map((p) => normalizeProduct(p, state.store.margin));

    await attachProductsToStore(state.store.id, normalized);

    state.store.products = normalized;
    state.lastSyncAt = new Date().toISOString();
    persistStore();
    renderAll();
  }

  async function syncOnlyNewProducts() {
    if (!state.store?.id) return;

    const raw = await fetchSupplierProducts();
    const list = Array.isArray(raw)
      ? raw
      : raw.items || raw.products || raw.data || [];

    const incoming = list.map((p) => normalizeProduct(p, state.store.margin));

    const existingIds = new Set((state.store.products || []).map((p) => String(p.id)));
    const newOnes = incoming.filter((p) => !existingIds.has(String(p.id)));

    if (!newOnes.length) {
      state.lastSyncAt = new Date().toISOString();
      persistStore();
      renderAll();
      return;
    }

    await attachProductsToStore(state.store.id, newOnes);
    state.store.products = [...newOnes, ...(state.store.products || [])];
    state.lastSyncAt = new Date().toISOString();
    persistStore();
    renderAll();
  }

  function persistStore() {
    localStorage.setItem(
      STORE_CACHE_KEY,
      JSON.stringify({
        store: state.store,
        lastSyncAt: state.lastSyncAt,
      })
    );
  }

  function restoreStore() {
    const raw = localStorage.getItem(STORE_CACHE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      state.store = parsed.store || null;
      state.lastSyncAt = parsed.lastSyncAt || null;
    } catch (_) {
      console.warn("Failed to restore store from localStorage:", _);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderStoreStatus() {
    const el = document.getElementById("qm-store-status");
    if (!el) return;

    if (!state.store) {
      el.innerHTML = "Sklep jeszcze nie został utworzony.";
      return;
    }

    el.innerHTML = `
      <strong>Sklep:</strong> ${escapeHtml(state.store.name)}<br>
      <strong>ID:</strong> ${escapeHtml(String(state.store.id))}<br>
      <strong>Marża:</strong> ${escapeHtml(String(state.store.margin))}%<br>
      <strong>Produktów:</strong> ${(state.store.products || []).length}<br>
      <strong>Ostatnia synchronizacja:</strong> ${escapeHtml(state.lastSyncAt || "jeszcze nie było")}
    `;
  }

  function renderProducts() {
    const grid = document.getElementById("qm-products-grid");
    if (!grid) return;

    const products = state.store?.products || [];

    grid.innerHTML = products.map((p) => `
      <article class="product-card">
        <div class="product-img">
          ${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : "📦"}
        </div>
        <div class="product-body">
          <h4 class="product-title">${escapeHtml(p.name)}</h4>
          <div class="price">${escapeHtml(String(p.finalPrice))} zł</div>
          <div class="meta">
            Hurt: ${escapeHtml(String(p.basePrice))} zł<br>
            Marża: ${escapeHtml(String(p.margin))}%<br>
            Źródło: ${escapeHtml(p.sourceName)}<br>
            ${p.isNew ? "Nowość" : "Produkt"}
          </div>
        </div>
      </article>
    `).join("");
  }

  function renderAll() {
    renderStoreStatus();
    renderProducts();
  }

  async function bootstrapAutoStore() {
    restoreStore();
    renderAll();

    const openBtn = document.getElementById("qm-open-store-btn");
    const syncBtn = document.getElementById("qm-sync-btn");
    const descInput = document.getElementById("qm-store-description");

    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        try {
          openBtn.disabled = true;

          if (!state.store?.id) {
            await createStoreFromDescription({
              description:
                descInput?.value?.trim() ||
                "Automatyczny sklep z nowościami z hurtowni i cenami z marżą",
              margin: DEFAULT_MARGIN,
            });
          }

          await importNewestProductsIntoStore();
        } catch (err) {
          console.error(err);
          alert("Nie udało się utworzyć sklepu lub pobrać produktów z API.");
        } finally {
          openBtn.disabled = false;
        }
      });
    }

    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        try {
          syncBtn.disabled = true;
          await syncOnlyNewProducts();
        } catch (err) {
          console.error(err);
          alert("Synchronizacja nowości nie powiodła się.");
        } finally {
          syncBtn.disabled = false;
        }
      });
    }

    state.syncTimer = setInterval(async () => {
      try {
        await syncOnlyNewProducts();
      } catch (err) {
        console.error("AUTO SYNC ERROR", err);
      }
    }, AUTO_SYNC_MS);

    window.addEventListener("beforeunload", () => {
      if (state.syncTimer) {
        clearInterval(state.syncTimer);
        state.syncTimer = null;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bootstrapAutoStore);
})();
