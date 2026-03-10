(function(){
  const locale = document.documentElement.lang || 'pl-PL';
  const currencyFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const integerFormatter = new Intl.NumberFormat(locale, {maximumFractionDigits: 0});
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatCurrency = (value) => `${currencyFormatter.format(value)} zł`;
  const formatCount = (value) => integerFormatter.format(Math.round(value));

  const animateValue = (element, value, formatter) => {
    if(!element){
      return;
    }
    const safeValue = Number.isFinite(value) ? value : 0;
    const startValue = toNumber(element.dataset.value);
    if(prefersReducedMotion){
      element.textContent = formatter(safeValue);
      element.dataset.value = `${safeValue}`;
      return;
    }
    const duration = 480;
    const startTime = performance.now();
    element.classList.remove('is-animated');
    void element.offsetWidth;
    element.classList.add('is-animated');

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (safeValue - startValue) * eased;
      element.textContent = formatter(current);
      if(progress < 1){
        requestAnimationFrame(step);
      } else {
        element.dataset.value = `${safeValue}`;
      }
    };

    requestAnimationFrame(step);
  };

  const showCta = (element) => {
    if(element && element.hasAttribute('hidden')){
      element.removeAttribute('hidden');
    }
  };

  const initMarginCalculator = () => {
    const form = document.querySelector('[data-margin-calculator]');
    if(!form){
      return;
    }
    const costInput = form.querySelector('[data-input-cost]');
    const marginInput = form.querySelector('[data-input-margin]');
    const priceOutput = document.querySelector('[data-margin-price]');
    const profitOutput = document.querySelector('[data-margin-profit]');
    const cta = document.querySelector('[data-margin-cta]');

    const update = () => {
      const cost = Math.max(toNumber(costInput.value), 0);
      const margin = Math.max(toNumber(marginInput.value), 0);
      const price = cost * (1 + margin / 100);
      const profit = price - cost;
      animateValue(priceOutput, price, formatCurrency);
      animateValue(profitOutput, profit, formatCurrency);
      showCta(cta);
    };

    costInput.addEventListener('input', update);
    marginInput.addEventListener('input', update);
    update();
  };

  const initProfitCalculator = () => {
    const form = document.querySelector('[data-profit-calculator]');
    if(!form){
      return;
    }
    const costInput = form.querySelector('[data-input-cost]');
    const priceInput = form.querySelector('[data-input-price]');
    const countInput = form.querySelector('[data-input-count]');
    const profitOutput = document.querySelector('[data-profit-monthly]');
    const revenueOutput = document.querySelector('[data-revenue-monthly]');
    const cta = document.querySelector('[data-profit-cta]');

    const update = () => {
      const cost = Math.max(toNumber(costInput.value), 0);
      const price = Math.max(toNumber(priceInput.value), 0);
      const count = Math.max(toNumber(countInput.value), 0);
      const revenue = price * count;
      const profit = (price - cost) * count;
      animateValue(revenueOutput, revenue, formatCurrency);
      animateValue(profitOutput, profit, formatCurrency);
      showCta(cta);
    };

    costInput.addEventListener('input', update);
    priceInput.addEventListener('input', update);
    countInput.addEventListener('input', update);
    update();
  };

  const planDetails = {
    basic: {
      name: 'BASIC',
      description: 'Startowy plan dla małego katalogu i spokojnego wzrostu sprzedaży.'
    },
    pro: {
      name: 'PRO',
      description: 'Plan dla rozwijających się sklepów z reklamami i większym ruchem.'
    },
    elite: {
      name: 'ELITE',
      description: 'Najmocniejszy pakiet dla dużej skali, automatyzacji i wysokich celów.'
    }
  };

  const choosePlan = ({products, target, ads, automation}) => {
    if(products >= 120 || target >= 12000 || (ads && automation && (products >= 60 || target >= 8000))){
      return 'elite';
    }
    if(products >= 40 || target >= 4000 || ads || automation){
      return 'pro';
    }
    return 'basic';
  };

  const initPlanCalculator = () => {
    const form = document.querySelector('[data-plan-calculator]');
    if(!form){
      return;
    }
    const productsInput = form.querySelector('[data-input-products]');
    const targetInput = form.querySelector('[data-input-target]');
    const adsInput = form.querySelector('[data-input-ads]');
    const automationInput = form.querySelector('[data-input-automation]');
    const planCard = document.querySelector('[data-plan-card]');
    const planName = document.querySelector('[data-plan-name]');
    const planDesc = document.querySelector('[data-plan-desc]');
    const planProducts = document.querySelector('[data-plan-products]');
    const planTarget = document.querySelector('[data-plan-target]');
    const planNote = document.querySelector('[data-plan-note]');
    const cta = document.querySelector('[data-plan-cta]');

    const update = () => {
      const products = Math.max(Math.round(toNumber(productsInput.value)), 0);
      const target = Math.max(toNumber(targetInput.value), 0);
      const ads = adsInput.checked;
      const automation = automationInput.checked;
      const planKey = choosePlan({products, target, ads, automation});
      const detail = planDetails[planKey];
      if(planCard){
        planCard.classList.remove('plan-basic', 'plan-pro', 'plan-elite');
        planCard.classList.add(`plan-${planKey}`);
      }
      if(planName){
        planName.textContent = detail.name;
      }
      if(planDesc){
        planDesc.textContent = detail.description;
      }
      if(planNote){
        const addons = [ads ? 'reklamy' : null, automation ? 'automatyzację' : null].filter(Boolean);
        planNote.textContent = addons.length
          ? `Uwzględniono dodatki: ${addons.join(' + ')}.`
          : 'Bez dodatków marketingowych i automatyzacji.';
      }
      animateValue(planProducts, products, formatCount);
      animateValue(planTarget, target, formatCurrency);
      showCta(cta);
    };

    productsInput.addEventListener('input', update);
    targetInput.addEventListener('input', update);
    adsInput.addEventListener('change', update);
    automationInput.addEventListener('change', update);
    update();
  };

  const init = () => {
    initMarginCalculator();
    initProfitCalculator();
    initPlanCalculator();
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
