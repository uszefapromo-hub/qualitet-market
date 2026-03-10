
document.addEventListener('DOMContentLoaded', () => {
  const checkoutForm = document.getElementById('checkout-form');
  const summary = document.getElementById('checkout-summary');
  const ordersList = document.getElementById('orders-list');
  const cart = window.QM.cart();
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  if(summary){
    summary.innerHTML = cart.length
      ? `<div class="list-cards">${cart.map(i => `<article class="store-card"><strong>${i.name}</strong><div>${i.qty} szt.</div></article>`).join('')}</div><div class="kv"><span>Razem</span><strong>${window.QM.money(total)}</strong></div>`
      : '<p class="empty">Brak produktów w koszyku.</p>';
  }

  if(checkoutForm){
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if(!cart.length){ alert('Koszyk jest pusty.'); return; }
      const data = new FormData(checkoutForm);
      const orders = window.QM.orders();
      orders.unshift({
        id:`ord-${Date.now()}`,
        customer:data.get('name'),
        email:data.get('email'),
        phone:data.get('phone'),
        address:data.get('address'),
        total,
        items:cart,
        status:'nowe'
      });
      window.QM.write(window.QM.KEYS.orders, orders);
      window.QM.write(window.QM.KEYS.cart, []);
      alert('Zamówienie zapisane.');
      location.href = 'zamowienia.html';
    });
  }

  if(ordersList){
    const orders = window.QM.orders();
    ordersList.innerHTML = orders.length
      ? `<div class="list-cards">${orders.map(o => `<article class="store-card"><strong>${o.id}</strong><div>${o.customer}</div><div>${window.QM.money(o.total)} • status ${o.status}</div></article>`).join('')}</div>`
      : '<p class="empty">Brak zamówień.</p>';
  }
});
