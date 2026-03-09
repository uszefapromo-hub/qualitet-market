document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;

  const cartList = document.getElementById('cart-list');
  const cartTotals = document.getElementById('cart-totals');
  const checkoutBtn = document.getElementById('go-checkout');

  function getTotals(cart){
    return {
      qty: cart.reduce((a,b)=>a + Number(b.qty||0), 0),
      total: cart.reduce((a,b)=>a + Number(b.finalPrice||b.price||0) * Number(b.qty||0), 0)
    };
  }

  function renderCart(){
    if(!cartList) return;
    const cart = QM.getCart();
    if(!cart.length){
      cartList.innerHTML = '<div class="card pad center">Koszyk jest pusty.</div>';
      if(cartTotals) cartTotals.innerHTML = '';
      return;
    }

    cartList.innerHTML = cart.map((item, index) => `
      <div class="cart-item">
        <div class="cart-thumb">${item.img || '📦'}</div>
        <div>
          <strong>${item.name}</strong>
          <div class="small">${QM.money(item.finalPrice || item.price)} / szt.</div>
          <div class="btns" style="margin-top:8px">
            <button class="btn" data-qty="${index}" data-dir="-1">-</button>
            <span class="store-pill">Ilość: ${item.qty}</span>
            <button class="btn" data-qty="${index}" data-dir="1">+</button>
            <button class="btn red" data-remove="${index}">Usuń</button>
          </div>
        </div>
        <div><strong>${QM.money((item.finalPrice || item.price) * item.qty)}</strong></div>
      </div>
    `).join('');

    const totals = getTotals(cart);
    if(cartTotals){
      cartTotals.innerHTML = `
        <div class="list-item"><span>Pozycji</span><strong>${totals.qty}</strong></div>
        <div class="list-item"><span>Razem</span><strong>${QM.money(totals.total)}</strong></div>
      `;
    }

    cartList.querySelectorAll('[data-qty]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-qty'));
        const dir = Number(btn.getAttribute('data-dir'));
        const cart = QM.getCart();
        cart[idx].qty += dir;
        if(cart[idx].qty <= 0) cart.splice(idx,1);
        QM.setCart(cart);
        renderCart();
      });
    });

    cartList.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove'));
        const cart = QM.getCart();
        cart.splice(idx,1);
        QM.setCart(cart);
        renderCart();
      });
    });
  }

  if(checkoutBtn){
    checkoutBtn.addEventListener('click', () => location.href = 'checkout.html');
  }

  renderCart();
});
