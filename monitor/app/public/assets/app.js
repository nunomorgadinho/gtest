/* Monitor de recursos: página principal (servidor em tempo real) */
(() => {
  'use strict';

  const { $, el, getJSON, chart, setBadge, renderRecs, pct, int, bytes, rate, ago, nf0, nf2, fHMS } = window.Mon;

  const LIVE_MS = 3000;
  const SPANS = { '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000 };
  const RANGE_SHORT = { '1h': '1 h', '6h': '6 h', '24h': '24 h', '7d': '7 d', '30d': '30 d' };
  const isAdmin = document.body.dataset.role === 'admin';

  const state = { range: '1h', hist: null, live: null, charts: {}, sites: new Map(), sparkMax: 1, timer: null, histTimer: null };
  const keyOf = (c) => c.id || c.label;
  const span = () => SPANS[state.range];

  state.charts.cpu = chart($('#ch-cpu'), { height: 220, fixedMax: 100, fmt: pct, yfmt: (v) => nf0.format(v) + '%', span,
    series: [{ label: 'CPU', color: '--series', fill: '--series-fill' }] });
  state.charts.mem = chart($('#ch-mem'), { height: 220, fixedMax: 100, fmt: pct, yfmt: (v) => nf0.format(v) + '%', span,
    series: [{ label: 'Memória', color: '--series', fill: '--series-fill' }] });

  /* ---------- Indicadores ---------- */
  const level = (v, warn, crit) => (v == null ? null : v >= crit ? 'crit' : v >= warn ? 'warn' : null);

  function setTile(id, big, sub, lvl) {
    const t = $('#' + id);
    $('.big', t).textContent = big;
    $('.sub', t).textContent = sub;
    setBadge($('.badge', t), lvl);
  }

  function renderTiles(d) {
    const s = d.server;
    const memPct = s.mem_total ? (100 * s.mem_used) / s.mem_total : null;
    const diskPct = s.disk_total ? (100 * s.disk_used) / s.disk_total : null;
    const perCpu = s.load1 / d.ncpu;
    setTile('t-cpu', pct(s.cpu), `${d.ncpu} CPUs · espera de disco ${pct(s.iowait)}`, level(s.cpu, 70, 90));
    let memSub = `${bytes(s.mem_used)} de ${bytes(s.mem_total)}`;
    if (s.swap_used > 50 * 1048576) memSub += ` · swap ${bytes(s.swap_used)}`;
    setTile('t-mem', pct(memPct), memSub, level(memPct, 80, 92));
    setTile('t-load', nf2.format(s.load1), `${nf2.format(perCpu)} por CPU · 15 min: ${nf2.format(s.load15)}`, level(perCpu, 1, 1.5));
    setTile('t-disk', pct(diskPct), `${bytes(s.disk_total - s.disk_used)} livres de ${bytes(s.disk_total)}`, level(diskPct, 80, 90));
    setTile('t-io', rate(s.disk_r + s.disk_w), `leitura ${rate(s.disk_r)} · escrita ${rate(s.disk_w)}`);
    setTile('t-net', rate(s.net_rx + s.net_tx), `entrada ${rate(s.net_rx)} · saída ${rate(s.net_tx)}`);
  }

  /* ---------- Sites ---------- */
  const avgOf = (c) => (c && c.cpu.length ? c.cpu.reduce((a, b) => a + (b || 0), 0) / c.cpu.length : 0);

  function buildSites(apps) {
    const host = $('#sites');
    const avgs = new Map(apps.map((a) => [keyOf(a), avgOf(state.hist?.consumers.find((x) => x.kind === 'app' && keyOf(x) === keyOf(a)))]));
    // Ordem estável: pelo consumo médio no período; o monitor fica sempre no fim.
    apps.sort((a, b) => (a.type === 'monitor') - (b.type === 'monitor') || avgs.get(keyOf(b)) - avgs.get(keyOf(a)) || a.label.localeCompare(b.label));
    const order = apps.map(keyOf).join('|');
    if (host.dataset.order === order) return;
    host.dataset.order = order;
    host.replaceChildren();
    for (const a of apps) {
      const key = keyOf(a);
      let entry = state.sites.get(key);
      if (!entry) {
        const card = el('article', { class: 'site' },
          el('div', { class: 'site-head' },
            el('div', { class: 'site-name', title: a.label },
              a.url ? el('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.label) : a.label),
            el('div', { class: 'site-meta' }, a.php ? 'PHP ' + a.php : '')),
          isAdmin && a.id ? el('div', { class: 'site-id adv' }, a.id) : null,
          el('div', { class: 'site-nums' },
            el('div', {}, el('b', { class: 'v-cpu' }, '–'), el('span', {}, 'CPU agora')),
            el('div', {}, el('b', { class: 'v-rss' }, '–'), el('span', {}, 'Memória')),
            el('div', {}, el('b', { class: 'v-avg' }, '–'), el('span', { class: 'l-avg' }, 'Média'))),
          el('div', { class: 'share', 'aria-hidden': 'true' }, el('i')),
          el('div', { class: 'share-label' }, '–'),
          el('div', { class: 'spark adv', role: 'img', 'aria-label': `CPU de ${a.label} ao longo do tempo` }),
          el('div', { class: 'site-traffic' }, '–'),
          a.type !== 'monitor' ? el('a', { class: 'site-more', href: 'site.php?app=' + encodeURIComponent(key) }, 'Ver tráfego e pedidos →') : null);
        entry = { card, chart: null, label: a.label };
        state.sites.set(key, entry);
      }
      host.append(entry.card);
      if (!entry.chart) {
        entry.chart = chart($('.spark', entry.card), { height: 64, spark: true, fmt: pct, span,
          dynamicMax: () => state.sparkMax, series: [{ label: entry.label, color: '--series', fill: '--series-fill' }] });
      }
    }
  }

  function renderSites(d) {
    const apps = d.consumers.filter((c) => c.kind === 'app');
    buildSites(apps);
    for (const a of apps) {
      const e = state.sites.get(keyOf(a));
      if (!e) continue;
      $('.v-cpu', e.card).textContent = pct(a.cpu);
      $('.v-rss', e.card).textContent = bytes(a.rss);
    }
  }

  function renderSiteHistory() {
    const h = state.hist;
    if (!h) return;
    const apps = h.consumers.filter((c) => c.kind === 'app');
    const total = apps.reduce((a, c) => a + avgOf(c), 0);
    state.sparkMax = Math.max(1, ...apps.flatMap((c) => c.cpu.map((v) => v || 0)));
    for (const [key, e] of state.sites) {
      const c = apps.find((x) => keyOf(x) === key);
      const avg = avgOf(c);
      const share = total > 0 ? (100 * avg) / total : 0;
      $('.v-avg', e.card).textContent = pct(avg);
      $('.l-avg', e.card).textContent = `Média (${RANGE_SHORT[state.range]})`;
      $('.share i', e.card).style.width = share.toFixed(1) + '%';
      $('.share-label', e.card).textContent = `${nf0.format(share)}% da CPU usada pelos sites neste período`;
      e.chart.setData([h.ts, c ? c.cpu : h.ts.map(() => 0)]);
      const t = h.traffic?.[key];
      $('.site-traffic', e.card).textContent = t && t.front > 0
        ? `${int(t.front)} pedidos · cache ${t.cache_pct == null ? '–' : nf0.format(t.cache_pct) + '%'} · robôs ${nf0.format(t.bot_pct || 0)}%`
        : 'Sem tráfego registado neste período';
    }
  }

  /* ---------- Serviços ---------- */
  function renderServices(d) {
    const rows = d.consumers.filter((c) => c.kind === 'service').sort((a, b) => b.rss - a.rss);
    $('#services').replaceChildren(...rows.map((c) => el('tr', {},
      el('td', {}, c.label), el('td', { class: 'num' }, pct(c.cpu)),
      el('td', { class: 'num' }, bytes(c.rss)), el('td', { class: 'num' }, int(c.procs)))));
  }

  /* ---------- Estado da recolha ---------- */
  function renderCollector(d) {
    const age = d.collector.age;
    const banner = $('#stale');
    if (age == null) {
      banner.hidden = false;
      banner.textContent = 'A recolha automática ainda não está ativa: os valores ao vivo funcionam, mas o histórico não está a ser gravado.';
    } else if (age > 180) {
      banner.hidden = false;
      banner.textContent = `A recolha automática parou (última amostra ${ago(age)}). O histórico não está a ser gravado.`;
    } else {
      banner.hidden = true;
    }
    const logs = d.collector.logs_age;
    $('#collector-status').textContent = (age == null ? 'Recolha automática: inativa' : `Última amostra gravada ${ago(age)}`)
      + (logs == null ? ' · logs ainda não lidos' : ` · logs lidos ${ago(logs)}`);
  }

  function setLive(ok, ts) {
    const l = $('#live');
    l.classList.toggle('off', !ok);
    $('.live-text', l).textContent = ok ? `Ao vivo · ${fHMS.format(ts * 1000)}` : 'Sem ligação, a tentar de novo…';
  }

  /* ---------- Histórico ---------- */
  function renderHistory() {
    const h = state.hist;
    $('#hist-empty').hidden = !!(h && h.ts.length);
    state.charts.cpu.setData([h?.ts || [], h?.server.cpu || []]);
    state.charts.mem.setData([h?.ts || [], h?.server.mem || []]);
    if (state.live) buildSites(state.live.consumers.filter((c) => c.kind === 'app'));
    renderSiteHistory();
  }

  async function loadHistory() {
    clearTimeout(state.histTimer);
    const range = state.range;
    try {
      const h = await getJSON(`api.php?a=history&range=${range}`);
      if (range !== state.range) return;
      state.hist = { ts: h.ts || [], server: h.server?.cpu ? h.server : { cpu: [], mem: [] }, consumers: h.consumers || [], traffic: h.traffic || {} };
      renderHistory();
    } catch (e) { /* tenta outra vez no próximo ciclo */ }
    // Em 1 h o gráfico avança com os dados ao vivo; ressincroniza a cada 5 min.
    state.histTimer = setTimeout(loadHistory, range === '1h' ? 300000 : 60000);
  }

  /** Em 1 h, cada leitura ao vivo é acrescentada aos gráficos. */
  function appendLive(d) {
    const h = state.hist;
    if (state.range !== '1h' || !h) return;
    const last = h.ts[h.ts.length - 1];
    if (last != null && d.ts <= last) return;
    h.ts.push(d.ts);
    h.server.cpu.push(d.server.cpu);
    h.server.mem.push(d.server.mem_total ? (100 * d.server.mem_used) / d.server.mem_total : null);
    for (const c of h.consumers) {
      const now = d.consumers.find((x) => x.kind === c.kind && keyOf(x) === keyOf(c));
      c.cpu.push(now ? now.cpu : 0);
      c.rss.push(now ? now.rss : 0);
    }
    for (const a of d.consumers.filter((x) => x.kind === 'app')) {
      if (!h.consumers.some((c) => c.kind === 'app' && keyOf(c) === keyOf(a))) {
        const zeros = h.ts.slice(0, -1).map(() => 0);
        h.consumers.push({ ...a, cpu: [...zeros, a.cpu], rss: [...zeros, a.rss] });
      }
    }
    const cut = d.ts - 3600;
    let n = 0;
    while (n < h.ts.length && h.ts[n] < cut) n++;
    if (n) {
      h.ts.splice(0, n);
      h.server.cpu.splice(0, n);
      h.server.mem.splice(0, n);
      for (const c of h.consumers) { c.cpu.splice(0, n); c.rss.splice(0, n); }
    }
    renderHistory();
  }

  /* ---------- Ciclo ao vivo ---------- */
  async function pollLive() {
    clearTimeout(state.timer);
    try {
      const d = await getJSON('api.php?a=live');
      state.live = d;
      renderTiles(d);
      renderSites(d);
      renderServices(d);
      renderCollector(d);
      appendLive(d);
      setLive(true, d.ts);
    } catch (e) {
      setLive(false);
    }
    if (!document.hidden) state.timer = setTimeout(pollLive, LIVE_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(state.timer);
    else { pollLive(); loadHistory(); }
  });

  for (const b of document.querySelectorAll('.range button')) {
    b.addEventListener('click', () => {
      state.range = b.dataset.range;
      for (const x of document.querySelectorAll('.range button')) x.setAttribute('aria-pressed', String(x === b));
      state.hist = null;
      loadHistory();
    });
  }

  async function loadRecs() {
    try {
      const d = await getJSON('api.php?a=advice');
      renderRecs($('#recs'), $('#recs-summary'), $('#recs-more'), d, { showSite: true, limit: isAdmin ? 8 : 5 });
    } catch (e) { /* tenta outra vez mais tarde */ }
  }
  setInterval(() => { if (!document.hidden) loadRecs(); }, 300000);

  pollLive();
  loadHistory();
  loadRecs();
})();
