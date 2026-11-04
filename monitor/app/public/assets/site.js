/* Monitor de recursos: detalhe de tráfego de um site */
(() => {
  'use strict';

  const { $, el, getJSON, chart, legend, setBadge, pct, int, bytes, secs, ago, nf0, fDay } = window.Mon;

  const isAdmin = document.body.dataset.role === 'admin';
  const app = new URLSearchParams(location.search).get('app') || '';
  const SPANS = { today: 86400, yesterday: 86400, '7d': 604800, '30d': 2592000 };
  const BUCKET_LABEL = { 300: 'por 5 min', 3600: 'por hora', 14400: 'por 4 horas' };
  const TYPES = [
    ['ajax', 'admin-ajax.php (pedidos AJAX)'],
    ['rest', 'API REST (/wp-json)'],
    ['search', 'Pesquisas no site'],
    ['login', 'Página de entrada (wp-login.php)'],
    ['admin', 'Área de administração (wp-admin)'],
    ['xmlrpc', 'xmlrpc.php'],
    ['cron', 'wp-cron.php'],
    ['feed', 'Feeds RSS'],
  ];
  const LEVELS = { fatal: 'Fatal', warning: 'Aviso', notice: 'Nota', deprecated: 'Obsoleto' };

  const state = { range: 'today', timer: null };
  const span = () => SPANS[state.range];

  // Duas séries no mesmo eixo e na mesma unidade (pedidos): legenda sempre visível.
  const reqSeries = [
    { label: 'Recebidos', color: '--series' },
    { label: 'Chegaram ao PHP', color: '--series-2' },
  ];
  $('#lg-req').replaceChildren(legend(reqSeries));
  const chReq = chart($('#ch-req'), { height: 220, series: reqSeries, fmt: int, span });
  const chCpu = chart($('#ch-cpu'), { height: 220, fmt: pct, yfmt: (v) => nf0.format(v) + '%', span,
    series: [{ label: 'CPU do PHP', color: '--series', fill: '--series-fill' }] });

  const empty = (cols, text = 'Sem dados neste período.') => el('tr', {}, el('td', { colspan: cols, class: 'empty-cell' }, text));

  function tile(id, big, sub) {
    $('#' + id + ' .big').textContent = big;
    $('#' + id + ' .sub').textContent = sub;
  }

  function render(d) {
    const t = d.totals;
    const a = d.app;
    document.title = `${a.label} · Monitor de recursos`;
    $('#s-name').textContent = a.label;
    const link = $('#s-url');
    if (a.url) { link.href = a.url; link.textContent = a.url.replace(/^https?:\/\//, ''); } else link.textContent = '';
    $('#s-php').textContent = [a.php ? 'PHP ' + a.php : '', isAdmin && a.id ? a.id : ''].filter(Boolean).join(' · ');

    const banner = $('#logs-banner');
    banner.hidden = d.logs_age != null && d.logs_age < 900;
    banner.textContent = d.logs_age == null
      ? 'Os logs ainda não foram lidos. A leitura automática corre a cada 5 minutos depois de instalada.'
      : `A leitura dos logs parou (última ${ago(d.logs_age)}). Os números deste ecrã podem estar desatualizados.`;
    $('#logs-status').textContent = d.logs_age == null ? 'Logs ainda não lidos' : `Logs lidos ${ago(d.logs_age)}`;

    // Indicadores
    const minutes = Math.max(1, (Math.min(d.to, Date.now() / 1000) - d.from) / 60);
    tile('t-req', int(t.front), `${int(t.front / minutes)} por minuto · ${int(t.static)} ficheiros estáticos`);
    tile('t-cache', t.cache_pct == null ? '–' : pct(t.cache_pct), `${int(t.backend)} pedidos não vieram da cache`);
    setBadge($('#t-cache .badge'), t.cache_pct == null || t.front < 100 ? null : t.cache_pct < 20 ? 'crit' : t.cache_pct < 50 ? 'warn' : null,
      { warn: '▲ Baixa', crit: '● Muito baixa' });
    tile('t-php', int(t.php), `tempo médio ${secs(t.php_avg)} · ${int(t.php_slow)} acima de 1 s`);
    const cpuShare = d.ncpu ? (100 * t.php_cpu) / (minutes * 60) / d.ncpu : null;
    tile('t-cpu', secs(t.php_cpu), `em média ${pct(cpuShare)} do servidor`);
    tile('t-bots', t.bot_pct == null ? '–' : pct(t.bot_pct), `${int(t.bot_front)} pedidos · ${int(t.bot_backend)} chegaram ao PHP`);
    tile('t-err', int(t.errors), `${int(t.err_fatal)} fatais · ${int(t.err_warning)} avisos · ${int(t.err_deprecated + t.err_notice)} outros`);
    setBadge($('#t-err .badge'), t.err_fatal > 0 ? 'crit' : t.err_warning > 1000 ? 'warn' : null, { warn: '▲ Muitos', crit: '● Fatais' });

    // Gráficos
    $('#u-req').textContent = BUCKET_LABEL[d.bucket] || '';
    const s = d.series;
    chReq.setData([s.ts, s.front, s.php]);
    chCpu.setData([s.ts, s.cpu]);

    // URLs
    $('#tb-urls').replaceChildren(...(d.urls.length ? d.urls.map((u) => el('tr', {},
      el('td', { class: 'url', title: u.path }, u.path),
      el('td', { class: 'num' }, int(u.n)),
      el('td', { class: 'num' }, secs(u.time / u.n)),
      el('td', { class: 'num' }, secs(u.cpu)),
      el('td', { class: 'num' }, t.php_cpu > 0 ? pct((100 * u.cpu) / t.php_cpu) : '–'),
      el('td', { class: 'num' }, bytes(u.mem_max)),
      el('td', { class: 'num' }, int(u.slow)))) : [empty(7)]));

    // Robôs
    $('#tb-bots').replaceChildren(...(d.bots.length ? d.bots.map((b) => el('tr', {},
      el('td', {}, b.bot === '' ? 'Pessoas (browsers)' : b.bot),
      el('td', { class: 'num' }, int(b.front)),
      el('td', { class: 'num' }, t.front > 0 ? pct((100 * b.front) / t.front) : '–'),
      el('td', { class: 'num' }, `${int(b.backend)}` + (b.front > 0 ? ` (${nf0.format(Math.min(100, (100 * b.backend) / b.front))}%)` : '')),
      el('td', { class: 'num' }, int(b.ajax)))) : [empty(5)]));

    // Tipos de pedido
    const typeRows = TYPES.filter(([k]) => t[k] > 0).sort((x, y) => t[y[0]] - t[x[0]]);
    $('#tb-types').replaceChildren(...(typeRows.length ? typeRows.map(([k, label]) => el('tr', {},
      el('td', {}, label), el('td', { class: 'num' }, int(t[k])),
      el('td', { class: 'num' }, t.front > 0 ? pct((100 * t[k]) / t.front) : '–'))) : [empty(3)]));

    // Erros
    $('#err-summary').textContent = t.errors > 0
      ? `${int(t.errors)} mensagens: ${int(t.err_fatal)} fatais, ${int(t.err_warning)} avisos, ${int(t.err_notice)} notas e ${int(t.err_deprecated)} de código obsoleto.`
        + (isAdmin ? '' : ' O detalhe técnico está disponível para a equipa WidgiLabs.')
      : 'Sem erros PHP registados neste período.';
    $('#err-wrap').hidden = !isAdmin || !d.errors.length;
    $('#tb-errors').replaceChildren(...d.errors.map((e) => el('tr', {},
      el('td', {}, el('span', { class: 'level level-' + e.level }, LEVELS[e.level] || e.level)),
      el('td', { class: 'msg' }, e.msg),
      el('td', { class: 'where' }, e.file ? `${e.file}:${e.line}` : '–'),
      el('td', { class: 'num' }, int(e.n)),
      el('td', { class: 'num' }, ago(Math.max(0, Math.round(Date.now() / 1000 - e.last)))))));

    // Slow log
    $('#tb-slow').replaceChildren(...(d.slow.length ? d.slow.map((x) => el('tr', {},
      el('td', {}, x.comp), el('td', { class: 'num' }, int(x.n)),
      el('td', { class: 'where admin-only' }, x.example || '–'))) : [empty(3, 'Nenhum pedido passou de 5 segundos neste período.')]));
  }

  async function load() {
    clearTimeout(state.timer);
    const range = state.range;
    try {
      const d = await getJSON(`api.php?a=site&app=${encodeURIComponent(app)}&range=${range}`);
      if (range === state.range) {
        if (d.error) throw new Error(d.error);
        render(d);
      }
    } catch (e) {
      if (e.message !== 'auth') {
        const b = $('#logs-banner');
        b.hidden = false;
        b.textContent = e.message === 'HTTP 404' ? 'Site não encontrado.' : 'Não foi possível carregar os dados. A tentar de novo…';
      }
    }
    // Os logs são lidos a cada 5 minutos: atualizar a cada minuto chega.
    if (!document.hidden) state.timer = setTimeout(load, 60000);
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  for (const b of document.querySelectorAll('.range button')) {
    b.addEventListener('click', () => {
      state.range = b.dataset.range;
      for (const x of document.querySelectorAll('.range button')) x.setAttribute('aria-pressed', String(x === b));
      load();
    });
  }
  load();
})();
