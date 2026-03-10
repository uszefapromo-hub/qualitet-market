
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('margin-form');
  if(!form) return;

  const output = {
    price: document.querySelector('[data-price-result]'),
    profit: document.querySelector('[data-profit-result]'),
    breakEven: document.querySelector('[data-break-even]'),
    totalProfit: document.querySelector('[data-total-profit]'),
    dailyAds: document.querySelector('[data-daily-ads]')
  };

  const calc = () => {
    const data = new FormData(form);
    const cost = Number(data.get('cost') || 0);
    const margin = Number(data.get('margin') || 0);
    const ads = Number(data.get('ads') || 0);
    const qty = Math.max(1, Number(data.get('qty') || 1));
    const price = cost * (1 + margin/100);
    const profit = price - cost;
    const breakEven = Math.ceil(ads / Math.max(1, profit));
    const totalProfit = (profit * qty) - ads;
    const dailyAds = ads / 30;
    output.price.textContent = window.QM.money(price);
    output.profit.textContent = window.QM.money(profit);
    output.breakEven.textContent = `${breakEven} szt.`;
    output.totalProfit.textContent = window.QM.money(totalProfit);
    output.dailyAds.textContent = window.QM.money(dailyAds);
    localStorage.setItem(window.QM.KEYS.margin, String(margin));
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); calc(); });
  form.margin.value = window.QM.getMargin();
  calc();
});
