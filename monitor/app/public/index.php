<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();
$user = require_user();
$cfg = mon_config();
?><!doctype html>
<html lang="pt-PT" data-view="<?= $user['role'] === 'admin' ? 'advanced' : 'basic' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<script src="assets/theme.js?v=<?= MON_VERSION ?>"></script>
<title>Monitor de recursos</title>
<link rel="stylesheet" href="assets/uPlot.min.css?v=1.6.30">
<link rel="stylesheet" href="assets/app.css?v=<?= MON_VERSION ?>">
</head>
<body data-role="<?= h($user['role']) ?>">
<header class="topbar">
  <div class="topbar-inner">
    <div class="brand"><span class="brand-mark" aria-hidden="true"></span>Monitor de recursos</div>
    <div class="server-name"><?= h($cfg['server_name']) ?></div>
    <div class="live" id="live" aria-live="polite"><span class="dot" aria-hidden="true"></span><span class="live-text">A ligar…</span></div>
    <div class="prefs">
      <div class="seg" role="group" aria-label="Vista">
        <button type="button" data-view-btn="basic" aria-pressed="false">Básica</button>
        <button type="button" data-view-btn="advanced" aria-pressed="false">Avançada</button>
      </div>
      <button type="button" class="btn-ghost" id="btn-theme">☾ Escuro</button>
    </div>
    <form method="post" action="logout.php" class="logout">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
      <span class="who"><?= h($user['name'] ?: $user['email']) ?></span>
      <button type="submit" class="btn-ghost">Sair</button>
    </form>
  </div>
</header>

<main class="wrap">
  <div class="banner" id="stale" hidden role="status"></div>

  <section class="tiles" aria-label="Estado atual do servidor">
    <article class="tile" id="t-cpu"><h3>CPU</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
    <article class="tile" id="t-mem"><h3>Memória</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
    <article class="tile adv" id="t-load"><h3>Carga</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
    <article class="tile" id="t-disk"><h3>Disco</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
    <article class="tile adv" id="t-io"><h3>Leitura e escrita em disco</h3><p class="big">–</p><p class="sub">–</p></article>
    <article class="tile adv" id="t-net"><h3>Rede</h3><p class="big">–</p><p class="sub">–</p></article>
  </section>


  <section class="panel recs-panel" aria-labelledby="recs-title">
    <div class="panel-head">
      <h2 id="recs-title">Oportunidades de melhoria</h2>
      <p class="panel-note" id="recs-summary">A analisar…</p>
    </div>
    <ol class="recs" id="recs"></ol>
    <button type="button" class="btn-link" id="recs-more" hidden></button>
  </section>
  <section class="panel">
    <div class="panel-head">
      <h2>Histórico do servidor</h2>
      <div class="range" role="group" aria-label="Período">
        <button type="button" data-range="1h" aria-pressed="true">1 h</button>
        <button type="button" data-range="6h" aria-pressed="false">6 h</button>
        <button type="button" data-range="24h" aria-pressed="false">24 h</button>
        <button type="button" data-range="7d" aria-pressed="false">7 dias</button>
        <button type="button" data-range="30d" aria-pressed="false">30 dias</button>
      </div>
    </div>
    <div class="charts">
      <figure class="chart-card">
        <figcaption>CPU usada <span class="unit">% do servidor</span></figcaption>
        <div class="chart" id="ch-cpu" role="img" aria-label="Gráfico da CPU usada ao longo do tempo"></div>
      </figure>
      <figure class="chart-card">
        <figcaption>Memória usada <span class="unit">% do total</span></figcaption>
        <div class="chart" id="ch-mem" role="img" aria-label="Gráfico da memória usada ao longo do tempo"></div>
      </figure>
    </div>
    <p class="empty" id="hist-empty" hidden>Ainda não há histórico. Aparece alguns minutos depois de a recolha automática começar.</p>
  </section>

  <section class="panel">
    <div class="panel-head">
      <h2>Sites</h2>
      <p class="panel-note">CPU e memória do PHP de cada site. A CPU é a percentagem do servidor inteiro.</p>
    </div>
    <div class="sites" id="sites"></div>
  </section>

  <section class="panel adv">
    <div class="panel-head">
      <h2>Serviços do servidor</h2>
      <p class="panel-note">Base de dados, cache e servidores web, partilhados por todos os sites.</p>
    </div>
    <div class="table-wrap">
      <table class="services">
        <thead><tr><th scope="col">Serviço</th><th scope="col" class="num">CPU</th><th scope="col" class="num">Memória</th><th scope="col" class="num">Processos</th></tr></thead>
        <tbody id="services"></tbody>
      </table>
    </div>
  </section>
</main>

<footer class="foot wrap">
  <span id="collector-status">–</span>
  <span>Monitor de recursos v<?= MON_VERSION ?> · WidgiLabs</span>
</footer>

<div class="tooltip" id="tooltip" hidden></div>
<script src="assets/uPlot.iife.min.js?v=1.6.30"></script>
<script src="assets/common.js?v=<?= MON_VERSION ?>"></script>
<script src="assets/app.js?v=<?= MON_VERSION ?>"></script>
</body>
</html>
