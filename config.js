.showcase{display:grid;grid-template-columns:1.06fr .94fr;gap:18px}
.filters{display:grid;grid-template-columns:1.15fr .8fr .8fr;gap:12px;margin-top:18px}
.products-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.product-card{
  position:relative;border:1px solid var(--line);border-radius:24px;overflow:hidden;
  background:linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
  box-shadow:var(--shadow)
}
.product-card:before{
  content:"";position:absolute;inset:auto auto 74% -10%;width:150px;height:150px;border-radius:999px;
  background:radial-gradient(circle, rgba(56,189,248,.18), transparent 70%)
}
.product-media{
  aspect-ratio:4/3;display:grid;place-items:center;font-size:60px;
  background:
    radial-gradient(circle at top left, rgba(56,189,248,.2), transparent 25%),
    radial-gradient(circle at bottom right, rgba(236,72,153,.2), transparent 25%),
    linear-gradient(180deg,#122246,#0d1730)
}
.product-body{padding:18px;display:grid;gap:10px}
.product-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.product-price{font-size:26px;font-weight:900}
.product-actions{display:flex;gap:10px;flex-wrap:wrap}
.highlight-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px}
.highlight-box{
  padding:16px;border-radius:20px;border:1px solid var(--line);
  background:linear-gradient(135deg, rgba(255,255,255,.07), rgba(255,255,255,.03))
}
.cart-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}
.cart-list{display:grid;gap:12px}
.cart-item{
  display:grid;grid-template-columns:84px 1fr auto;gap:12px;padding:14px;
  border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.04)
}
.cart-thumb{
  border-radius:16px;background:linear-gradient(135deg,#13264b,#0d1630);
  display:grid;place-items:center;font-size:34px
}
.summary{position:sticky;top:88px}
@media (max-width:980px){
  .showcase,.products-grid,.highlight-row,.cart-grid{grid-template-columns:1fr}
  .filters{grid-template-columns:1fr}
  .cart-item{grid-template-columns:64px 1fr}
}
