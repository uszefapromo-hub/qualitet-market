document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;

  const checkoutForm = document.getElementById('checkout-form');
  const ordersTable = document.getElementById('orders-table-body');

  function getTotals(cart){
    return {
      qty: cart.reduce((a,b)=>a + Number(b.qty||0), 0),
      total: cart.reduce((a,b)=>a + Number(b.finalPrice||b.price||0) * Number(b.qty||0), 0)
    };
  }

  if(checkoutForm){
    checkoutForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cart = QM.getCart();
      if(!cart.length){
        alert('Koszyk jest pusty');
        return;
      }
      const fd = new FormData(checkoutForm);
      const totals = getTotals(cart);
      const order = {
        id:'ORD-' + Date.now(),
        store: QM.getActiveStoreSlug(),
        customer: fd.get('customer'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        address: fd.get('address'),
        note: fd.get('note'),
        items: cart,
        total: totals.total,
        createdAt: new Date().toISOString()
      };
      const orders = QM.getOrders();
      orders.unshift(order);
      QM.setOrders(orders);
      QM.setCart([]);
      location.href = 'zamowienia.html';
    });
  }

  if(ordersTable){
    const orders = QM.getOrders();
    if(!orders.length){
      ordersTable.innerHTML = '<tr><td colspan="5" class="center">Brak zamówień</td></tr>';
      return;
    }
    ordersTable.innerHTML = orders.map(order => `
      <tr>
        <td>${order.id}</td>
        <td>${order.customer || '-'}</td>
        <td>${order.store || '-'}</td>
        <td>${QM.money(order.total)}</td>
        <td>${new Date(order.createdAt).toLocaleString('pl-PL')}</td>
      </tr>
    `).join('');
  }
});
