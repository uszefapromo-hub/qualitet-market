
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('cart-list');
  if(!root) return;
  const cart = window.QM.cart();
  if(!cart.length){
    root.innerHTML = '<p class="empty">Koszyk jest pusty. Wejdź do sklepu i dodaj produkty.</p>';
    return;
  }
  const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  root.innerHTML = `
    <div class="list-cards">
      ${cart.map(item => `
      <article class="store-card">
        <strong>${item.name}</strong>
        <div>Ilość: ${item.qty}</div>
        <div>Cena: ${window.QM.money(item.price * item.qty)}</div>
      </article>`).join('')}
    </div>
    <div class="kv"><span>Razem</span><strong>${window.QM.money(total)}</strong></div>
  `;
});
