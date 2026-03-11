/**
 * flow.js – API integration layer for HurtDetalUszefaQUALITET PWA
 *
 * Connects the following pages to the backend REST API (js/api.js / window.QMApi):
 *   • login.html  – POST /api/auth/login  (with legacy-flag sync + demo fallback)
 *   • sklep.html  – GET  /api/products    (replaces localStorage demo products)
 *   • koszyk.html – POST /api/orders      (replaces localStorage order when authenticated)
 *
 * Loading order matters: this script must be listed AFTER js/app.js so its
 * DOMContentLoaded callback runs after app.js has set up its listeners.
 * Event-capture is used on forms so our handler fires before app.js bubble handlers.
 */
(function () {
  'use strict';

  /* ── Utility ────────────────────────────────────────────────────────────── */

  function api() { return window.QMApi || null; }
  function page() { return (document.body && document.body.dataset.page) || ''; }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var CURRENCY = new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency: 'PLN', maximumFractionDigits: 0,
  });
  function fmt(v) { return CURRENCY.format(Number(v) || 0); }

  /* ── 1. Login (login.html) ──────────────────────────────────────────────── */

  function initApiLogin() {
    if (page() !== 'login') return;
    var a = api();
    if (!a) return;

    var form = document.querySelector('[data-login-form]');
    if (!form) return;

    /* Error element – inserted before the .cta-row if not present */
    var errorEl = form.querySelector('[data-login-error]');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.setAttribute('data-login-error', '');
      errorEl.style.cssText = 'color:#ff7272;font-size:13px;margin-top:8px;display:none';
      var ctaRow = form.querySelector('.cta-row');
      if (ctaRow) { form.insertBefore(errorEl, ctaRow); }
      else { form.appendChild(errorEl); }
    }

    /**
     * Use capture so this handler fires BEFORE the app.js bubble listener.
     * stopImmediatePropagation prevents the legacy localStorage handler from running
     * on success; on demo-fallback we also redirect, so it never runs.
     */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var emailInput    = form.querySelector('input[name="email"]');
      var passwordInput = form.querySelector('input[name="password"]');
      var email    = emailInput    ? emailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value     : '';

      var btn      = form.querySelector('[type="submit"]');
      var origText = btn ? btn.textContent : 'Zaloguj';
      if (btn) { btn.disabled = true; btn.textContent = 'Logowanie\u2026'; }
      errorEl.style.display = 'none';

      a.Auth.login(email, password)
        .then(function () {
          /* Sync legacy localStorage keys so app.js pages continue to work */
          try {
            localStorage.setItem('app_user_email',  email);
            localStorage.setItem('app_user_logged', 'true');
          } catch (_) { /* noop – storage might be unavailable */ }
          window.location.href = 'dashboard.html';
        })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.textContent = origText; }

          if (!err.status) {
            /* Network / CORS error → demo-mode fallback so offline dev still works */
            try {
              localStorage.setItem('app_user_email',  email);
              localStorage.setItem('app_user_logged', 'true');
            } catch (_) { /* noop */ }
            window.location.href = 'dashboard.html';
            return;
          }

          var msg =
            err.status === 401 ? 'Nieprawidłowy e-mail lub has\u0142o.' :
            err.status === 422 ? 'Podaj poprawny e-mail i has\u0142o.' :
            (err.message || 'B\u0142\u0105d logowania. Spr\u00f3buj ponownie.');
          errorEl.textContent = msg;
          errorEl.style.display = '';
        });
    }, true /* capture */);

    /* Register button → show a simple registration form overlay */
    var registerBtn = form.querySelector('[type="button"]');
    if (registerBtn) {
      registerBtn.addEventListener('click', function () {
        showRegisterPanel(form, a, errorEl);
      });
    }
  }

  function showRegisterPanel(loginForm, a, errorEl) {
    var panel = document.querySelector('[data-register-panel]');
    if (panel) {
      panel.hidden = false;
      loginForm.hidden = true;
      return;
    }

    /* Build a minimal inline registration form */
    panel = document.createElement('div');
    panel.setAttribute('data-register-panel', '');
    panel.innerHTML =
      '<h2 style="margin:0 0 16px;font-size:20px">Utwórz konto</h2>' +
      '<div class="checkout-field" style="margin-bottom:10px">' +
        '<label for="reg-name">Imię i nazwisko</label>' +
        '<input id="reg-name" name="name" type="text" placeholder="Jan Kowalski" autocomplete="name" required>' +
      '</div>' +
      '<div class="checkout-field" style="margin-bottom:10px">' +
        '<label for="reg-email">E-mail</label>' +
        '<input id="reg-email" name="email" type="email" placeholder="email@domena.pl" autocomplete="email" required>' +
      '</div>' +
      '<div class="checkout-field" style="margin-bottom:10px">' +
        '<label for="reg-pass">Hasło (min. 8 znaków)</label>' +
        '<input id="reg-pass" name="password" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="new-password" required>' +
      '</div>' +
      '<p data-reg-error style="color:#ff7272;font-size:13px;margin-bottom:8px;display:none"></p>' +
      '<div class="cta-row">' +
        '<button class="btn btn-primary" type="button" data-reg-submit>Zarejestruj się</button>' +
        '<button class="btn btn-secondary" type="button" data-reg-back>Wróć do logowania</button>' +
      '</div>';

    loginForm.parentNode.insertBefore(panel, loginForm.nextSibling);
    loginForm.hidden = true;

    var regError  = panel.querySelector('[data-reg-error]');
    var submitBtn = panel.querySelector('[data-reg-submit]');
    var backBtn   = panel.querySelector('[data-reg-back]');

    backBtn.addEventListener('click', function () {
      panel.hidden = true;
      loginForm.hidden = false;
    });

    submitBtn.addEventListener('click', function () {
      var name     = panel.querySelector('#reg-name').value.trim();
      var email    = panel.querySelector('#reg-email').value.trim();
      var password = panel.querySelector('#reg-pass').value;

      if (!name || !email || password.length < 8) {
        regError.textContent = 'Uzupełnij wszystkie pola (hasło min. 8 znaków).';
        regError.style.display = '';
        return;
      }
      regError.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Tworzę konto\u2026';

      a.Auth.register(email, password, name, 'seller')
        .then(function () {
          try {
            localStorage.setItem('app_user_email',  email);
            localStorage.setItem('app_user_logged', 'true');
          } catch (_) { /* noop */ }
          window.location.href = 'dashboard.html';
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Zarejestruj się';
          if (!err.status) {
            /* network error – allow demo mode */
            try {
              localStorage.setItem('app_user_email',  email);
              localStorage.setItem('app_user_logged', 'true');
            } catch (_) { /* noop */ }
            window.location.href = 'dashboard.html';
            return;
          }
          regError.textContent = err.message || 'Błąd rejestracji.';
          regError.style.display = '';
        });
    });
  }

  /* ── 2. Products (sklep.html) ───────────────────────────────────────────── */

  function initApiProducts() {
    if (page() !== 'sklep') return;
    var a = api();
    if (!a) return;

    var grid = document.querySelector('[data-store-products-grid]');
    if (!grid) return;

    /*
     * GET /api/products is a public endpoint – no auth required.
     * We request active products; the response is { total, page, limit, products }.
     */
    a.Products.list({ status: 'active', limit: 30 })
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products) ? data.products : []);

        if (!products.length) return; /* keep demo products from app.js */

        /* Replace demo grid with API products */
        renderApiProducts(products, grid);

        var emptyState = document.querySelector('[data-store-products-empty]');
        if (emptyState) emptyState.hidden = true;

        /* Update store description/name if a store context is attached */
        var storeDesc = document.querySelector('[data-store-description]');
        if (storeDesc && !storeDesc.textContent.trim()) {
          storeDesc.textContent = 'Produkty z platformy QualitetMarket';
        }
      })
      .catch(function () {
        /* API unavailable – demo data from app.js stays, no action needed */
      });
  }

  function renderApiProducts(products, grid) {
    grid.innerHTML = '';

    products.forEach(function (product) {
      var sellingPrice = product.price_override != null
        ? parseFloat(product.price_override)
        : parseFloat(product.selling_price || product.price_gross || 0);

      var card = document.createElement('article');
      card.className = 'product-card product-tile';

      /* Media */
      var media = document.createElement('div');
      media.className = 'product-media';
      var imgEl = document.createElement('img');
      imgEl.src     = product.image_url || 'assets/images/demo/category-electronics.svg';
      imgEl.alt     = escHtml(product.name || 'Produkt');
      imgEl.loading = 'lazy';
      media.appendChild(imgEl);

      /* Details */
      var details = document.createElement('div');
      details.className = 'product-details';

      var catTag = document.createElement('span');
      catTag.className   = 'tag';
      catTag.textContent = product.category_name || product.category || 'Kategoria';

      var title = document.createElement('h3');
      title.textContent = product.name || 'Produkt';

      var hint = document.createElement('p');
      hint.className   = 'hint';
      hint.textContent = product.description || '';

      var meta = document.createElement('div');
      meta.className = 'product-meta';
      var priceEl = document.createElement('span');
      priceEl.className   = 'price';
      priceEl.textContent = fmt(sellingPrice);
      meta.appendChild(priceEl);

      /* Actions */
      var actions = document.createElement('div');
      actions.className = 'cta-row product-actions';

      var addBtn = document.createElement('button');
      addBtn.className = 'btn btn-primary';
      addBtn.type      = 'button';
      addBtn.textContent = 'Do koszyka';

      /* Store product data on the button for QMCart data-add-to-cart handler */
      addBtn.dataset.addToCart    = '';
      addBtn.dataset.productId    = String(product.id || '');
      addBtn.dataset.productName  = String(product.name || '');
      addBtn.dataset.productPrice = String(sellingPrice);
      addBtn.dataset.productImg   = String(product.image_url || '');

      addBtn.addEventListener('click', function () {
        addToCartWithApiFirst(product, sellingPrice, addBtn);
      });

      var detailsLink = document.createElement('a');
      detailsLink.className   = 'btn btn-secondary';
      detailsLink.href        = 'listing.html';
      detailsLink.textContent = 'Szczegóły';

      actions.appendChild(addBtn);
      actions.appendChild(detailsLink);

      details.appendChild(catTag);
      details.appendChild(title);
      details.appendChild(hint);
      details.appendChild(meta);
      details.appendChild(actions);

      card.appendChild(media);
      card.appendChild(details);
      grid.appendChild(card);
    });
  }

  /**
   * Add a product to the cart.
   * Primary:  POST /api/cart { shop_product_id } when product.shop_product_id is present
   *           and the user is authenticated.
   * Fallback: localStorage QMCart (always available for guests).
   */
  function addToCartWithApiFirst(product, price, btn) {
    var a = api();
    var origText = btn ? btn.textContent : 'Do koszyka';

    var doLocalCart = function () {
      if (window.QMCart) {
        window.QMCart.addToCart({
          id:    String(product.id   || ''),
          name:  String(product.name || 'Produkt'),
          price: price,
          img:   String(product.image_url || ''),
        });
      }
      if (btn) {
        btn.textContent = '\u2713 Dodano';
        btn.disabled    = true;
        setTimeout(function () {
          btn.textContent = origText;
          btn.disabled    = false;
        }, 1500);
      }
    };

    if (a && a.Auth.isLoggedIn() && product.shop_product_id != null) {
      if (btn) { btn.disabled = true; btn.textContent = 'Dodawanie…'; }
      a.Cart.addByShopProduct(String(product.shop_product_id), 1)
        .then(function () {
          if (btn) {
            btn.textContent = '\u2713 Dodano';
            setTimeout(function () {
              btn.textContent = origText;
              btn.disabled    = false;
            }, 1500);
          }
        })
        .catch(function () {
          /* API cart failed – still save to localStorage */
          doLocalCart();
        });
    } else {
      doLocalCart();
    }
  }

  /* ── 3. Checkout (koszyk.html) ──────────────────────────────────────────── */

  function initApiCheckout() {
    if (page() !== 'koszyk') return;
    var a = api();
    if (!a) return;

    /* If authenticated, try to sync API cart into localStorage so the inline
       script renders up-to-date items. */
    if (a.Auth.isLoggedIn()) {
      syncApiCartToLocal(a);
    }

    var form = document.querySelector('[data-checkout-form]');
    if (!form) return;

    /**
     * Capture listener fires before the inline script's bubble listener.
     * We always call e.preventDefault() + e.stopImmediatePropagation() and
     * handle the full order flow here (API or localStorage fallback).
     */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var cart = window.QMCart;
      if (!cart) return;

      var items = cart.getCart();
      if (!items.length) return;

      var btn      = form.querySelector('[data-checkout-btn]');
      var origText = btn ? btn.textContent : 'Złóż zamówienie';
      if (btn) { btn.disabled = true; btn.textContent = 'Sk\u0142adam zam\u00f3wienie\u2026'; }

      var fd = new FormData(form);
      var formData = {
        name:    (fd.get('name')    || '').trim(),
        email:   (fd.get('email')   || '').trim(),
        phone:   (fd.get('phone')   || '').trim(),
        address: (fd.get('address') || '').trim(),
      };

      /* Validation */
      if (!formData.name || !formData.email || !formData.address) {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
        showCheckoutError(form, 'Proszę uzupełnić wymagane pola: Imię i nazwisko, E-mail, Adres dostawy.');
        return;
      }

      if (a.Auth.isLoggedIn()) {
        placeApiOrder(a, items, formData, btn, origText, form, cart);
      } else {
        placeLocalOrder(items, formData, btn, cart);
      }
    }, true /* capture */);
  }

  function placeApiOrder(a, items, formData, btn, origText, form, cart) {
    /* Attempt to get the seller's store so we know the store_id required by
       POST /api/orders. If the user is a buyer (no store), fall back. */
    a.MyStore.get()
      .then(function (store) {
        if (!store || !store.id) {
          placeLocalOrder(items, formData, btn, cart);
          return;
        }

        /* i.productId is the real product UUID stored by syncApiCartToLocal;
           fall back to i.id for items added directly from the API products list. */
        var orderItems = items.map(function (i) {
          return { product_id: String(i.productId || i.id || ''), quantity: Number(i.qty) || 1 };
        });

        var notes = formData.name
          + (formData.email ? ' | ' + formData.email : '')
          + (formData.phone ? ' | ' + formData.phone : '');

        return a.Orders.create({
          store_id:         store.id,
          items:            orderItems,
          shipping_address: formData.address,
          notes:            notes,
        });
      })
      .then(function (order) {
        if (!order) return; /* already fell back */

        /* Clear the active cart; historical orders in localStorage are preserved. */
        cart.clearCart();

        var numEl     = document.querySelector('[data-order-number]');
        var contentEl = document.querySelector('[data-cart-content]');
        var successEl = document.querySelector('[data-order-success]');
        if (numEl) {
          numEl.textContent = 'Numer zam\u00f3wienia: ' + (order.order_number || order.id || '—');
        }
        if (contentEl) contentEl.hidden = true;
        if (successEl) successEl.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = origText; }

        if (!err.status) {
          /* Network error – fall back to localStorage order */
          placeLocalOrder(items, formData, btn, cart);
          return;
        }

        /* API returned an error (e.g. products not found in store, stock issue) */
        showCheckoutError(
          form,
          'B\u0142\u0105d zam\u00f3wienia: ' + (err.message || 'Spr\u00f3buj ponownie.')
        );
      });
  }

  function placeLocalOrder(items, formData, btn, cart) {
    /* Mirrors the inline script logic in koszyk.html */
    if (btn) { btn.disabled = true; }
    var order = cart.saveOrder(formData, items);
    try { sessionStorage.setItem('qm_last_order', order.number); } catch (_) { /* noop */ }
    setTimeout(function () {
      cart.clearCart();
      var numEl     = document.querySelector('[data-order-number]');
      var contentEl = document.querySelector('[data-cart-content]');
      var successEl = document.querySelector('[data-order-success]');
      if (numEl) numEl.textContent = 'Numer zam\u00f3wienia: ' + order.number;
      if (contentEl) contentEl.hidden = true;
      if (successEl) successEl.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 400);
  }

  function showCheckoutError(form, msg) {
    var el = form.querySelector('[data-checkout-error]');
    if (!el) {
      el = document.createElement('p');
      el.setAttribute('data-checkout-error', '');
      el.style.cssText = 'color:#ff7272;font-size:13px;margin-top:8px';
      var checkoutBtn = form.querySelector('[data-checkout-btn]');
      if (checkoutBtn) { form.insertBefore(el, checkoutBtn); }
      else { form.appendChild(el); }
    }
    el.textContent = msg;
    el.hidden = false;
  }

  /**
   * Fetch the API cart and populate localStorage QMCart so the existing inline
   * koszyk.html script renders the correct items.
   * Runs asynchronously; if it completes before the user interacts it will
   * update the displayed cart via QMCart.saveCart + a custom DOM event.
   */
  function syncApiCartToLocal(a) {
    a.MyStore.get()
      .then(function (store) {
        if (!store || !store.id) return null;
        return a.Cart.get(store.id);
      })
      .then(function (cartData) {
        if (!cartData) return;
        var apiItems = Array.isArray(cartData.items) ? cartData.items : [];
        if (!apiItems.length) return;

        if (!window.QMCart) return;
        var localItems = window.QMCart.getCart();

        /*
         * Only populate from the API when the local cart is empty.
         * If the user added items offline we keep those to avoid silently
         * discarding them; a merge UI is out of scope for this MVP.
         */
        if (!localItems.length) {
          var mapped = apiItems.map(function (item) {
            return {
              /* productId stores the real UUID used by POST /api/orders */
              productId: String(item.product_id || ''),
              /* id is the display key used by QMCart quantity/remove controls */
              id:        String(item.product_id || item.id || ''),
              name:      String(item.name || item.product_name || 'Produkt'),
              price:     parseFloat(item.unit_price || item.price || 0),
              qty:       parseInt(item.quantity, 10) || 1,
              img:       String(item.image_url || ''),
              apiId:     String(item.id || ''), /* UUID for DELETE /api/cart/items/:id */
            };
          });
          window.QMCart.saveCart(mapped);

          /* Signal koszyk.html inline script to re-render */
          try {
            document.dispatchEvent(new CustomEvent('qm:cart-synced'));
          } catch (_) { /* noop in old browsers */ }
        }
      })
      .catch(function () { /* API unavailable – keep localStorage cart */ });
  }

  /* ── Bootstrap ──────────────────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    initApiLogin();
    initApiProducts();
    initApiCheckout();
  });

}());
