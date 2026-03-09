<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cennik | QualitetMarket</title>
<link rel="stylesheet" href="styles.css">

</head>
<body>
<header class="topbar">
  <div class="container topbar-inner">
    <a class="brand" href="platforma.html"><span class="brand-badge">QM</span><span>QualitetMarket</span></a>
    <nav class="nav"><a href="platforma.html" class="">Platforma</a><a href="dashboard.html" class="">Dashboard</a><a href="sklep.html" class="">Sklep</a><a href="koszyk.html" class="">Koszyk</a><a href="zamowienia.html" class="">Zamówienia</a><a href="panel-sklepu.html" class="">Panel sklepu</a><a href="hurtownie.html" class="">Hurtownie</a><a href="cennik.html" class="active">Cennik</a></nav>
    <div class="top-actions">
      <span class="plan-pill gradient-pill">Plan: <strong data-current-plan>BASIC</strong></span>
      <a class="btn mobile-only" href="dashboard.html">Menu</a>
    </div>
  </div>
</header>

<main>
  <section class="section">
    <div class="container grid cols-3">
      <div class="card pad">
        <span class="badge">BASIC</span>
        <h2 style="margin-top:10px">Start</h2>
        <p class="hero-text" style="font-size:16px">Podstawowy dostęp do sklepu i panelu.</p>
        <div class="list" style="margin:16px 0">
          <div class="list-item"><span>Sklep</span><strong>Tak</strong></div>
          <div class="list-item"><span>Dashboard</span><strong>Tak</strong></div>
          <div class="list-item"><span>Hurtownie</span><strong>Nie</strong></div>
        </div>
        <button class="btn primary" data-plan-select="basic">Wybierz BASIC</button>
      </div>
      <div class="card pad">
        <span class="badge">PRO</span>
        <h2 style="margin-top:10px">Sprzedaż</h2>
        <p class="hero-text" style="font-size:16px">Dostęp do hurtowni i importu produktów.</p>
        <div class="list" style="margin:16px 0">
          <div class="list-item"><span>Sklep</span><strong>Tak</strong></div>
          <div class="list-item"><span>Dashboard</span><strong>Tak</strong></div>
          <div class="list-item"><span>Hurtownie</span><strong>Tak</strong></div>
        </div>
        <button class="btn primary" data-plan-select="pro">Wybierz PRO</button>
      </div>
      <div class="card pad">
        <span class="badge">ELITE</span>
        <h2 style="margin-top:10px">Pełny</h2>
        <p class="hero-text" style="font-size:16px">Najwyższy plan pod rozwój marketplace.</p>
        <div class="list" style="margin:16px 0">
          <div class="list-item"><span>Sklep</span><strong>Tak</strong></div>
          <div class="list-item"><span>Dashboard</span><strong>Tak</strong></div>
          <div class="list-item"><span>Hurtownie</span><strong>Tak</strong></div>
        </div>
        <button class="btn primary" data-plan-select="elite">Wybierz ELITE</button>
      </div>
    </div>
  </section>
</main>

<footer class="footer"><div class="container">QualitetMarket dark marketplace • mobile first • GitHub Pages safe</div></footer>
<script src="js/config.js"></script>
<script src="js/planGuard.js"></script>
<script src="js/pricing.js"></script>
</body>
</html>