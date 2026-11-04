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
<title>Tráfego do site · Monitor de recursos</title>
<link rel="stylesheet" href="assets/uPlot.min.css?v=1.6.30">
<link rel="stylesheet" href="assets/app.css?v=<?= MON_VERSION ?>">
</head>
<body data-role="<?= h($user['role']) ?>">
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="./"><span class="brand-mark" aria-hidden="true"></span>Monitor de recursos</a>
    <div class="server-name"><?= h($cfg['server_name']) ?></div>
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
  <a class="back" href="./">← Todos os sites</a>
  <div class="page-head">
    <div>
      <h1 id="s-name">–</h1>
      <p class="page-sub"><a id="s-url" target="_blank" rel="noopener noreferrer"></a> <span id="s-php"></span></p>
    </div>
    <div class="range" role="group" aria-label="Período">
      <button type="button" data-range="today" aria-pressed="true">Hoje</button>
      <button type="button" data-range="yesterday" aria-pressed="false">Ontem</button>
      <button type="button" data-range="7d" aria-pressed="false">7 dias</button>
      <button type="button" data-range="30d" aria-pressed="false">30 dias</button>
    </div>
  </div>
  <div class="banner" id="logs-banner" hidden role="status"></div>

  <section class="tiles" aria-label="Resumo do período">
    <article class="tile" id="t-req"><h3>Pedidos recebidos</h3><p class="big">–</p><p class="sub">–</p></article>
    <article class="tile" id="t-cache"><h3>Servidos pela cache</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
    <article class="tile adv" id="t-php"><h3>Pedidos ao PHP</h3><p class="big">–</p><p class="sub">–</p></article>
    <article class="tile adv" id="t-cpu"><h3>CPU gasta pelo PHP</h3><p class="big">–</p><p class="sub">–</p></article>
    <article class="tile" id="t-bots"><h3>Pedidos de robôs</h3><p class="big">–</p><p class="sub">–</p></article>
    <article class="tile" id="t-err"><h3>Erros PHP</h3><p class="big">–</p><p class="sub">–</p><span class="badge" hidden></span></article>
  </section>

  <section class="panel">
    <div class="charts">
      <figure class="chart-card">
        <figcaption>Pedidos <span class="unit" id="u-req">por 5 min</span></figcaption>
        <div id="lg-req"></div>
        <div class="chart" id="ch-req" role="img" aria-label="Pedidos recebidos e pedidos que chegaram ao PHP ao longo do tempo"></div>
      </figure>
      <figure class="chart-card adv">
        <figcaption>CPU usada pelo PHP deste site <span class="unit">% do servidor</span></figcaption>
        <div class="legend-spacer" aria-hidden="true"></div>
        <div class="chart" id="ch-cpu" role="img" aria-label="CPU usada pelo PHP deste site ao longo do tempo"></div>
      </figure>
    </div>
  </section>

  <section class="panel adv">
    <div class="panel-head">
      <h2>URLs que mais gastam CPU</h2>
      <p class="panel-note">Pedidos que chegaram ao PHP, agrupados por endereço (sem parâmetros).</p>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th scope="col">URL</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">Tempo médio</th>
          <th scope="col" class="num">CPU total</th><th scope="col" class="num">% da CPU do site</th><th scope="col" class="num">Memória máx.</th><th scope="col" class="num">Mais de 1 s</th></tr></thead>
        <tbody id="tb-urls"></tbody>
      </table>
    </div>
  </section>

  <div class="cols">
    <section class="panel">
      <div class="panel-head">
        <h2>Robôs e visitantes</h2>
        <p class="panel-note">Quem faz os pedidos e quantos escapam à cache.</p>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th scope="col">Origem</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">% do total</th>
            <th scope="col" class="num">Chegaram ao PHP</th><th scope="col" class="num">admin-ajax</th></tr></thead>
          <tbody id="tb-bots"></tbody>
        </table>
      </div>
    </section>
    <section class="panel adv">
      <div class="panel-head">
        <h2>Tipos de pedido</h2>
        <p class="panel-note">Pedidos WordPress que normalmente não passam pela cache.</p>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th scope="col">Tipo</th><th scope="col" class="num">Pedidos</th><th scope="col" class="num">% do total</th></tr></thead>
          <tbody id="tb-types"></tbody>
        </table>
      </div>
    </section>
  </div>

  <section class="panel">
    <div class="panel-head">
      <h2>Erros PHP</h2>
      <p class="panel-note" id="err-summary">–</p>
    </div>
    <div class="table-wrap adv" id="err-wrap">
      <table class="data">
        <thead><tr><th scope="col">Nível</th><th scope="col">Mensagem</th><th scope="col">Onde</th><th scope="col" class="num">Ocorrências</th><th scope="col" class="num">Última</th></tr></thead>
        <tbody id="tb-errors"></tbody>
      </table>
    </div>
  </section>

  <section class="panel adv">
    <div class="panel-head">
      <h2>Pedidos muito lentos</h2>
      <p class="panel-note">Registados pelo PHP quando um pedido passa de 5 segundos, com o plugin ou tema que estava a correr.</p>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th scope="col">Plugin, tema ou núcleo</th><th scope="col" class="num">Ocorrências</th><th scope="col" class="admin-only">Exemplo (função e ficheiro)</th></tr></thead>
        <tbody id="tb-slow"></tbody>
      </table>
    </div>
  </section>
</main>

<footer class="foot wrap">
  <span id="logs-status">–</span>
  <span>Monitor de recursos v<?= MON_VERSION ?> · WidgiLabs</span>
</footer>

<div class="tooltip" id="tooltip" hidden></div>
<script src="assets/uPlot.iife.min.js?v=1.6.30"></script>
<script src="assets/common.js?v=<?= MON_VERSION ?>"></script>
<script src="assets/site.js?v=<?= MON_VERSION ?>"></script>
</body>
</html>
