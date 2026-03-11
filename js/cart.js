(function(){
  'use strict';

  var CART_KEY = 'qm_cart';
  var CART_ORDERS_KEY = 'qm_orders';
  var CURRENCY_FMT = new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN', maximumFractionDigits:0});

  function formatPrice(value){
    return CURRENCY_FMT.format(Number(value) || 0);
  }

  function getCart(){
    try{
      return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    }catch(e){
      return [];
    }
  }

  function saveCart(items){
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  function getCartCount(cart){
    return (cart || getCart()).reduce(function(sum, i){ return sum + (Number(i.qty) || 1); }, 0);
  }

  function getCartTotal(cart){
    return (cart || getCart()).reduce(function(sum, i){ return sum + ((Number(i.price) || 0) * (Number(i.qty) || 1)); }, 0);
  }

  function updateCartBadge(){
    var count = getCartCount();
    document.querySelectorAll('[data-cart-badge]').forEach(function(el){
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function addToCart(product){
    var cart = getCart();
    var existing = cart.filter(function(i){ return i.id === product.id; })[0];
    if(existing){
      existing.qty = (Number(existing.qty) || 1) + 1;
    } else {
      cart.push({id: product.id, name: product.name, price: product.price, img: product.img || '', qty: 1});
    }
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function removeFromCart(productId){
    var cart = getCart().filter(function(i){ return i.id !== productId; });
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function updateQty(productId, qty){
    var cart = getCart();
    cart.forEach(function(i){
      if(i.id === productId){ i.qty = Math.max(1, Number(qty) || 1); }
    });
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function clearCart(){
    saveCart([]);
    updateCartBadge();
  }

  function saveOrder(formData, cart){
    var orders = [];
    try{ orders = JSON.parse(localStorage.getItem(CART_ORDERS_KEY) || '[]'); }catch(e){}
    var now = new Date().toISOString();
    var year = new Date().getFullYear();
    var maxSeq = orders.reduce(function(max, o){
      var m = o.number && o.number.match(/QM-\d{4}-(\d+)/);
      var n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
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
      items: cart.map(function(i){ return {id: i.id, name: i.name, price: i.price, qty: i.qty || 1}; }),
      total: getCartTotal(cart),
      status: 'pending',
      createdAt: now
    };
    orders.push(order);
    localStorage.setItem(CART_ORDERS_KEY, JSON.stringify(orders));
    return order;
  }

  window.QMCart = {
    getCart: getCart,
    saveCart: saveCart,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    formatPrice: formatPrice,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    updateQty: updateQty,
    clearCart: clearCart,
    saveOrder: saveOrder,
    updateCartBadge: updateCartBadge
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
      if(!id || !name || isNaN(price)) return;
      QMCart.addToCart({id: id, name: name, price: price, img: img});
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
