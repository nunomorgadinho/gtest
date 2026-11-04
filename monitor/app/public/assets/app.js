/* Monitor de recursos: dashboard em tempo real */
(() => {
  'use strict';

  const LIVE_MS = 3000;
  const SPANS = { '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '30d': 2592000 };
  const RANGE_SHORT = { '1h': '1 h', '6h': '6 h', '24h': '24 h', '7d': '7 d', '30d': '30 d' };

  const $ = (s, el = document) => el.querySelector(s);
  const isAdmin = document.body.dataset.role === 'admin';
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const font = getComputedStyle(document.body).fontFamily;

  /* ---------- Formatação (pt-PT) ---------- */
  const nf1 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
  const fHM = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const fHMS = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fDay = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
  const fDayHM = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const pct = (v) => (v == null || isNaN(v) ? '–' : nf1.format(v) + '%');
  function bytes(b) {
    if (b == null || isNaN(b)) return '–';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i === 0 ? nf0.format(b) : (b < 10 ? nf1.format(b) : nf0.format(b))) + ' ' + u[i];
  }
  const rate = (b) => bytes(b) + '/s';
  function ago(sec) {
    if (sec == null) return '–';
    if (sec < 60) return `há ${sec} s`;
    if (sec < 3600) return `há ${Math.round(sec / 60)} min`;
    return `há ${nf1.format(sec / 3600)} h`;
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') e.className = v; else e.setAttribute(k, v);
    }
    for (const c of children) if (c != null) e.append(c);
    return e;
  }

  /* ---------- Estado ---------- */
  const state = { range: '1h', hist: null, live: null, charts: {}, sites: new Map(), sparkMax: 1, timer: null, histTimer: null };
  const keyOf = (c) => c.id || c.label;

  /* ---------- Gráficos ---------- */
  const tip = $('#tooltip');

  function timeTicks(u, splits) {
    const span = SPANS[state.range];
    return splits.map((t) => {
      const d = new Date(t * 1000);
      // Em períodos longos, a data só aparece à meia-noite; nas outras marcas, a hora.
      if (span > 172800 && d.getHours() === 0 && d.getMinutes() === 0) return fDay.format(d);
      return fHM.format(d);
    });
  }

  function showTip(u, fmt, title) {
    const i = u.cursor.idx;
    if (i == null || u.cursor.left == null || u.cursor.left < 0) { tip.hidden = true; return; }
    const t = u.data[0][i];
    const v = u.data[1][i];
    if (t == null) { tip.hidden = true; return; }
    const when = SPANS[state.range] > 86400 ? fDayHM.format(t * 1000) : fHMS.format(t * 1000);
    tip.replaceChildren(el('b', {}, fmt(v)), el('br'), (title ? title + ' · ' : '') + when);
    tip.hidden = false;
    const r = u.over.getBoundingClientRect();
    let x = r.left + u.cursor.left + 14;
    const y = r.top + u.cursor.top - 12;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = r.left + u.cursor.left - tip.offsetWidth - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  function makeChart(host, { height, fixedMax, dynamicMax, fmt, title, spark }) {
    const axis = {
      stroke: css('--axis'),
      grid: { stroke: css('--grid'), width: 1 },
      ticks: { show: false },
      font: '12px ' + font,
    };
    const opts = {
      width: Math.max(100, host.clientWidth),
      height,
      padding: spark ? [6, 2, 2, 2] : [10, 12, 0, 0],
      legend: { show: false },
      cursor: {
        y: false,
        drag: { x: false, y: false },
        points: { size: 8, fill: css('--series'), stroke: css('--card'), width: 2 },
      },
      scales: {
        x: { time: true },
        y: { range: (u, min, max) => [0, fixedMax ?? Math.max(dynamicMax ? dynamicMax() : 0, (max || 0) * 1.15, 1)] },
      },
      series: [
        {},
        { stroke: css('--series'), width: 2, fill: css('--series-fill'), points: { show: false } },
      ],
      axes: spark
        ? [{ show: false }, { show: false }]
        : [
            { ...axis, values: timeTicks, space: 70 },
            { ...axis, size: 48, values: (u, vals) => vals.map((v) => nf0.format(v) + '%') },
          ],
      hooks: { setCursor: [(u) => showTip(u, fmt, typeof title === 'function' ? title() : title)] },
    };
    const u = new uPlot(opts, [[], []], host);
    u.over.addEventListener('mouseleave', () => { tip.hidden = true; });
    new ResizeObserver(() => u.setSize({ width: Math.max(100, host.clientWidth), height })).observe(host);
    return u;
  }

  state.charts.cpu = makeChart($('#ch-cpu'), { height: 220, fixedMax: 100, fmt: pct, title: 'CPU' });
  state.charts.mem = makeChart($('#ch-mem'), { height: 220, fixedMax: 100, fmt: pct, title: 'Memória' });

  /* ---------- Indicadores ---------- */
  function level(v, warn, crit) {
    if (v == null) return null;
    return v >= crit ? 'crit' : v >= warn ? 'warn' : null;
  }

  function setTile(id, big, sub, lvl) {
    const t = $('#' + id);
    $('.big', t).textContent = big;
    $('.sub', t).textContent = sub;
    const b = $('.badge', t);
    if (!b) return;
    b.hidden = !lvl;
    b.className = 'badge ' + (lvl || '');
    b.textContent = lvl === 'crit' ? '● Crítico' : lvl === 'warn' ? '▲ Elevado' : '';
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
  function siteAvg(key) {
    const c = state.hist?.consumers.find((x) => x.kind === 'app' && keyOf(x) === key);
    if (!c || !c.cpu.length) return null;
    return c.cpu.reduce((a, b) => a + (b || 0), 0) / c.cpu.length;
  }

  function buildSites(apps) {
    const host = $('#sites');
    const avgs = new Map(apps.map((a) => [keyOf(a), siteAvg(keyOf(a)) ?? 0]));
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
        const name = a.url
          ? el('a', { href: a.url, target: '_blank', rel: 'noopener noreferrer' }, a.label)
          : document.createTextNode(a.label);
        const card = el('article', { class: 'site' },
          el('div', { class: 'site-head' },
            el('div', { class: 'site-name', title: a.label }, name),
            el('div', { class: 'site-meta' }, a.php ? 'PHP ' + a.php : '')),
          isAdmin && a.id ? el('div', { class: 'site-id' }, a.id) : null,
          el('div', { class: 'site-nums' },
            el('div', {}, el('b', { class: 'v-cpu' }, '–'), el('span', {}, 'CPU agora')),
            el('div', {}, el('b', { class: 'v-rss' }, '–'), el('span', {}, 'Memória')),
            el('div', {}, el('b', { class: 'v-avg' }, '–'), el('span', { class: 'l-avg' }, 'Média'))),
          el('div', { class: 'share', 'aria-hidden': 'true' }, el('i')),
          el('div', { class: 'share-label' }, '–'),
          el('div', { class: 'spark', role: 'img', 'aria-label': `CPU de ${a.label} ao longo do tempo` }));
        entry = { card, chart: null, label: a.label };
        state.sites.set(key, entry);
      }
      host.append(entry.card);
      if (!entry.chart) {
        entry.chart = makeChart($('.spark', entry.card), {
          height: 64, spark: true, fmt: pct, title: entry.label, dynamicMax: () => state.sparkMax,
        });
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
    const avgs = apps.map((c) => ({ key: keyOf(c), avg: c.cpu.reduce((a, b) => a + (b || 0), 0) / Math.max(1, c.cpu.length) }));
    const total = avgs.reduce((a, b) => a + b.avg, 0);
    state.sparkMax = Math.max(1, ...apps.flatMap((c) => c.cpu.map((v) => v || 0)));
    for (const [key, e] of state.sites) {
      const c = apps.find((x) => keyOf(x) === key);
      const avg = avgs.find((x) => x.key === key)?.avg ?? 0;
      const share = total > 0 ? (100 * avg) / total : 0;
      $('.v-avg', e.card).textContent = pct(avg);
      $('.l-avg', e.card).textContent = `Média (${RANGE_SHORT[state.range]})`;
      $('.share i', e.card).style.width = share.toFixed(1) + '%';
      $('.share-label', e.card).textContent = `${nf0.format(share)}% da CPU usada pelos sites neste período`;
      e.chart.setData([h.ts, c ? c.cpu : h.ts.map(() => 0)]);
    }
  }

  /* ---------- Serviços ---------- */
  function renderServices(d) {
    const rows = d.consumers.filter((c) => c.kind === 'service').sort((a, b) => b.rss - a.rss);
    $('#services').replaceChildren(...rows.map((c) => el('tr', {},
      el('td', {}, c.label),
      el('td', { class: 'num' }, pct(c.cpu)),
      el('td', { class: 'num' }, bytes(c.rss)),
      el('td', { class: 'num' }, nf0.format(c.procs)))));
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
    $('#collector-status').textContent = age == null ? 'Recolha automática: inativa' : `Última amostra gravada ${ago(age)}`;
  }

  function setLive(ok, ts) {
    const l = $('#live');
    l.classList.toggle('off', !ok);
    $('.live-text', l).textContent = ok ? `Ao vivo · ${fHMS.format(ts * 1000)}` : 'Sem ligação, a tentar de novo…';
  }

  /* ---------- Histórico ---------- */
  function renderHistory() {
    const h = state.hist;
    const empty = !h || !h.ts.length;
    $('#hist-empty').hidden = !empty;
    state.charts.cpu.setData([h?.ts || [], h?.server.cpu || []]);
    state.charts.mem.setData([h?.ts || [], h?.server.mem || []]);
    if (state.live) buildSites(state.live.consumers.filter((c) => c.kind === 'app'));
    renderSiteHistory();
  }

  async function loadHistory() {
    clearTimeout(state.histTimer);
    const range = state.range;
    try {
      const r = await fetch(`api.php?a=history&range=${range}`, { cache: 'no-store', credentials: 'same-origin' });
      if (r.status === 401) { location.href = 'login.php'; return; }
      const h = await r.json();
      if (range !== state.range) return;
      state.hist = { ts: h.ts || [], server: h.server || {}, consumers: h.consumers || [] };
      if (!state.hist.server.cpu) state.hist.server = { cpu: [], mem: [] };
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
        h.consumers.push({ ...a, cpu: [...h.ts.slice(0, -1).map(() => 0), a.cpu], rss: [...h.ts.slice(0, -1).map(() => 0), a.rss] });
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
      const r = await fetch('api.php?a=live', { cache: 'no-store', credentials: 'same-origin' });
      if (r.status === 401) { location.href = 'login.php'; return; }
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
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

  pollLive();
  loadHistory();
})();
