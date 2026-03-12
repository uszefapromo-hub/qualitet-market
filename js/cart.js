(function(){
  'use strict';

  var CART_KEY = 'qm_cart';
  var CART_ORDERS_KEY = 'qm_orders';
  var CURRENCY_FMT = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN', maximumFractionDigits:0});

  function formatPrice(value){
    return CURRENCY_FMT.format(Number(value) || 0);
  }

  // ─── localStorage helpers ────────────────────────────────────────────────────

  function getCart(){
    try{
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    }catch(e){
      return [];
    }
  }

  function saveCart(items){
    try{ localStorage.setItem(CART_KEY, JSON.stringify(items)); }catch(_){}
  }

  function getCartCount(cart){
    return (cart || getCart()).reduce(function(sum, item){ return sum + (Number(item.qty) || 1); }, 0);
  }

  function getCartTotal(cart){
    return (cart || getCart()).reduce(function(sum, item){ return sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)); }, 0);
  }

  function updateCartBadge(){
    var count = getCartCount();
    document.querySelectorAll('[data-cart-badge]').forEach(function(badgeElement){
      badgeElement.textContent = count;
      badgeElement.hidden = count === 0;
    });
  }

  // ─── API helpers ─────────────────────────────────────────────────────────────

  function isLoggedIn(){
    try{ return Boolean(localStorage.getItem('qm_token')); }catch(_){ return false; }
  }

  function apiAddByShopProduct(shopProductId, quantity){
    if(!window.QMApi){ return Promise.reject(new Error('QMApi not loaded')); }
    return window.QMApi.Cart.addByShopProduct(shopProductId, quantity);
  }

  function apiRemoveItem(itemId){
    if(!window.QMApi){ return Promise.reject(new Error('QMApi not loaded')); }
    return window.QMApi.Cart.removeItemById(itemId);
  }

  function apiGetCart(storeId){
    if(!window.QMApi){ return Promise.reject(new Error('QMApi not loaded')); }
    return window.QMApi.Cart.get(storeId);
  }

  // ─── Cart operations (localStorage-first, API sync when logged in) ───────────

  function addToCart(product){
    var cart = getCart();
    var existing = cart.filter(function(item){ return item.id === product.id; })[0];
    if(existing){
      existing.qty = (Number(existing.qty) || 1) + 1;
    } else {
      cart.push({id: product.id, name: product.name, price: product.price, img: product.img || '', qty: 1});
    }
    saveCart(cart);
    updateCartBadge();

    // If logged in and product has shop_product_id, also add via API (fire-and-forget)
    if(isLoggedIn() && product.shop_product_id){
      apiAddByShopProduct(product.shop_product_id, 1).catch(function(){/* offline / error – localStorage is source of truth */});
    }

    return cart;
  }

  function removeFromCart(productId){
    var cart = getCart();
    var item = cart.filter(function(item){ return item.id === productId; })[0];
    var newCart = cart.filter(function(item){ return item.id !== productId; });
    saveCart(newCart);
    updateCartBadge();

    // If logged in and item has a backend itemId, remove via API too
    if(isLoggedIn() && item && item.apiItemId){
      apiRemoveItem(item.apiItemId).catch(function(){/* offline */});
    }

    return newCart;
  }

  function updateQty(productId, qty){
    var cart = getCart();
    cart.forEach(function(item){
      if(item.id === productId){ item.qty = Math.max(1, Number(qty) || 1); }
    });
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function clearCart(){
    saveCart([]);
    updateCartBadge();
  }

  /**
   * addByShopProduct – primary add method for logged-in users.
   * Adds via backend API and also mirrors to localStorage for offline display.
   */
  function addByShopProduct(shopProductId, name, price, imgUrl, quantity){
    quantity = quantity || 1;

    // Mirror to localStorage immediately for instant UI feedback
    var cart = getCart();
    var existing = cart.filter(function(item){ return item.id === shopProductId; })[0];
    if(existing){
      existing.qty = (Number(existing.qty) || 1) + quantity;
    } else {
      cart.push({id: shopProductId, name: name || 'Produkt', price: price || 0, img: imgUrl || '', qty: quantity});
    }
    saveCart(cart);
    updateCartBadge();

    if(isLoggedIn()){
      return apiAddByShopProduct(shopProductId, quantity).then(function(resp){
        // Sync the backend cart item UUID back to localStorage so we can remove by API ID later.
        if(resp && resp.items){
          var newCart = getCart();
          var local = newCart.filter(function(item){ return item.id === shopProductId; })[0];
          if(local && resp.items.length){
            var apiItem = resp.items[resp.items.length - 1];
            if(apiItem){ local.apiItemId = apiItem.id; }
          }
          saveCart(newCart);
        }
        return resp;
      });
    }
    return Promise.resolve({items: cart});
  }

  // ─── Order helpers ────────────────────────────────────────────────────────────

  function saveOrder(formData, cart){
    var orders = [];
    try{ orders = JSON.parse(localStorage.getItem(CART_ORDERS_KEY) || '[]'); }catch(e){}
    var now = new Date().toISOString();
    var year = new Date().getFullYear();
    var maxSeq = orders.reduce(function(max, order){
      var match = order.number && order.number.match(/QM-\d{4}-(\d+)/);
      var sequenceNumber = match ? parseInt(match[1], 10) : 0;
      return sequenceNumber > max ? sequenceNumber : max;
    }, 0);
    var seq = String(maxSeq + 1).padStart(4, '0');
    var randomSuffix = Math.floor(Math.random() * 900 + 100);
    var order = {
      id: 'ord_' + Date.now() + '_' + randomSuffix,
      number: 'QM-' + year + '-' + seq,
      client: formData.name || 'Klient',
      clientEmail: formData.email || '',
      clientPhone: formData.phone || '',
      clientAddress: formData.address || '',
      items: cart.map(function(item){ return {id: item.id, name: item.name, price: item.price, qty: item.qty || 1}; }),
      total: getCartTotal(cart),
      status: 'pending',
      createdAt: now
    };
    orders.push(order);
    try{ localStorage.setItem(CART_ORDERS_KEY, JSON.stringify(orders)); }catch(_){}
    return order;
  }

  /**
   * createOrder – submits order to backend API when logged in, falls back to localStorage.
   * @param {object} formData  - {name, email, phone, address}
   * @param {Array}  cartItems - current cart items
   * @param {string} storeId   - backend store UUID (optional)
   * @returns {Promise<object>} - resolves with order object
   */
  function createOrder(formData, cartItems, storeId){
    if(isLoggedIn() && storeId && window.QMApi && window.QMApi.Orders){
      var items = cartItems.map(function(item){
        return {product_id: item.id, quantity: item.qty || 1};
      });
      return window.QMApi.Orders.create({
        store_id: storeId,
        items: items,
        shipping_address: formData.address || '',
        notes: [formData.name, formData.phone].filter(Boolean).join(' | ')
      }).then(function(order){
        // Also mirror to localStorage for offline access
        var localOrder = {
          id: order.id,
          number: order.order_number || ('QM-API-' + order.id.slice(0, 8).toUpperCase()),
          client: formData.name,
          clientEmail: formData.email,
          clientPhone: formData.phone,
          clientAddress: formData.address,
          total: order.total,
          status: order.status,
          createdAt: order.created_at
        };
        try{
          var stored = JSON.parse(localStorage.getItem(CART_ORDERS_KEY) || '[]');
          stored.push(localOrder);
          localStorage.setItem(CART_ORDERS_KEY, JSON.stringify(stored));
        } catch(_){}
        return localOrder;
      });
    }
    // Fallback: localStorage-only order
    return Promise.resolve(saveOrder(formData, cartItems));
  }

  window.QMCart = {
    getCart: getCart,
    saveCart: saveCart,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    formatPrice: formatPrice,
    addToCart: addToCart,
    addByShopProduct: addByShopProduct,
    removeFromCart: removeFromCart,
    updateQty: updateQty,
    clearCart: clearCart,
    saveOrder: saveOrder,
    createOrder: createOrder,
    updateCartBadge: updateCartBadge,
    isLoggedIn: isLoggedIn,
  };

  document.addEventListener('DOMContentLoaded', function(){
    updateCartBadge();

    document.addEventListener('click', function(e){
      var btn = e.target.closest('[data-add-to-cart]');
      if(!btn) return;
      var id = btn.dataset.productId;
      var name = btn.dataset.productName;
      var price = parseFloat(btn.dataset.productPrice);
      var img = btn.dataset.productImg || '';
      var shopProductId = btn.dataset.shopProductId || id;
      if(!id || !name || isNaN(price)) return;

      // Use addByShopProduct when possible (handles both API + localStorage)
      if(shopProductId && shopProductId !== id){
        QMCart.addByShopProduct(shopProductId, name, price, img, 1).catch(function(){
          QMCart.addToCart({id: id, name: name, price: price, img: img});
        });
      } else {
        QMCart.addToCart({id: id, name: name, price: price, img: img});
      }

      var origText = btn.textContent;
      btn.textContent = '✓ Dodano';
      btn.disabled = true;
      setTimeout(function(){
        btn.textContent = origText;
        btn.disabled = false;
      }, 1500);
    });
  });
})();
