/* Monitor de recursos: utilitários partilhados (formatação pt-PT, DOM e gráficos) */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const font = getComputedStyle(document.body).fontFamily;

  const nf0 = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fHM = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const fHMS = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fDay = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' });
  const fDayHM = new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const pct = (v) => (v == null || isNaN(v) ? '–' : nf1.format(v) + '%');
  const int = (v) => (v == null || isNaN(v) ? '–' : nf0.format(v));
  function bytes(b) {
    if (b == null || isNaN(b)) return '–';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i === 0 ? nf0.format(b) : (b < 10 ? nf1.format(b) : nf0.format(b))) + ' ' + u[i];
  }
  const rate = (b) => bytes(b) + '/s';
  /** Segundos de CPU ou de tempo, em unidades legíveis. */
  function secs(s) {
    if (s == null || isNaN(s)) return '–';
    if (s < 1) return nf0.format(s * 1000) + ' ms';
    if (s < 60) return nf1.format(s) + ' s';
    if (s < 3600) return nf1.format(s / 60) + ' min';
    return nf1.format(s / 3600) + ' h';
  }
  function ago(sec) {
    if (sec == null) return '–';
    if (sec < 60) return `há ${sec} s`;
    if (sec < 3600) return `há ${Math.round(sec / 60)} min`;
    if (sec < 86400) return `há ${nf1.format(sec / 3600)} h`;
    return `há ${nf0.format(sec / 86400)} dias`;
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      // Estilos via CSSOM: a CSP não permite atributos style inline.
      if (k === 'class') e.className = v;
      else if (k === 'style') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
    if (r.status === 401) { location.href = 'login.php'; throw new Error('auth'); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  /* ---------- Gráficos (uPlot) ---------- */
  let tip = null;

  function timeTicks(span) {
    return (u, splits) => splits.map((t) => {
      const d = new Date(t * 1000);
      // Em períodos longos, a data só aparece à meia-noite; nas outras marcas, a hora.
      if (span() > 172800 && d.getHours() === 0 && d.getMinutes() === 0) return fDay.format(d);
      return fHM.format(d);
    });
  }

  function showTip(u, series, fmt, span) {
    tip = tip || $('#tooltip');
    const i = u.cursor.idx;
    if (!tip || i == null || u.cursor.left == null || u.cursor.left < 0 || u.data[0][i] == null) {
      if (tip) tip.hidden = true;
      return;
    }
    const t = u.data[0][i];
    const when = span() > 86400 ? fDayHM.format(t * 1000) : fHMS.format(t * 1000);
    const rows = series.map((s, k) => {
      const v = u.data[k + 1][i];
      return series.length === 1
        ? [el('b', {}, fmt(v)), el('br')]
        : [el('span', { class: 'tip-key', style: { background: s.color } }), `${s.label}: `, el('b', {}, fmt(v)), el('br')];
    });
    tip.replaceChildren(...rows.flat(), (series.length === 1 && series[0].label ? series[0].label + ' · ' : '') + when);
    tip.hidden = false;
    const r = u.over.getBoundingClientRect();
    let x = r.left + u.cursor.left + 14;
    const y = r.top + u.cursor.top - 12;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = r.left + u.cursor.left - tip.offsetWidth - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }

  /* Gráficos criados, para os voltar a desenhar quando o tema muda. */
  const charts = [];
  const col = (v) => (v && v.startsWith('--') ? css(v) : v);

  /**
   * Gráfico de linhas no tempo. Devolve um objeto com setData().
   * series: [{label, color, fill?}] (cores como variáveis CSS, por exemplo '--series');
   * fmt formata valores; yfmt formata o eixo; span() devolve a duração do período.
   */
  function chart(host, { height, series, fmt, yfmt, fixedMax, dynamicMax, spark, span }) {
    span = span || (() => 3600);
    const make = () => {
      const resolved = series.map((s) => ({ ...s, color: col(s.color), fill: col(s.fill) }));
      const axis = { stroke: css('--axis'), grid: { stroke: css('--grid'), width: 1 }, ticks: { show: false }, font: '12px ' + font };
      const opts = {
        width: Math.max(100, host.clientWidth),
        height,
        padding: spark ? [6, 2, 2, 2] : [10, 12, 0, 0],
        legend: { show: false },
        cursor: { y: false, drag: { x: false, y: false }, points: { size: 8, stroke: css('--card'), width: 2 } },
        scales: {
          x: { time: true },
          y: { range: (u, min, max) => [0, fixedMax ?? Math.max(dynamicMax ? dynamicMax() : 0, (max || 0) * 1.15, 1)] },
        },
        series: [{}, ...resolved.map((s) => ({
          label: s.label, stroke: s.color, width: 2, fill: s.fill || undefined,
          points: { show: false, fill: s.color },
        }))],
        axes: spark ? [{ show: false }, { show: false }] : [
          { ...axis, values: timeTicks(span), space: 70 },
          { ...axis, size: 52, values: (u, vals) => vals.map(yfmt || ((v) => nf0.format(v))) },
        ],
        hooks: { setCursor: [(u) => showTip(u, resolved, fmt, span)] },
      };
      const u = new uPlot(opts, [[], ...series.map(() => [])], host);
      u.over.addEventListener('mouseleave', () => { if (tip) tip.hidden = true; });
      return u;
    };
    const entry = { u: make(), make };
    charts.push(entry);
    new ResizeObserver(() => entry.u.setSize({ width: Math.max(100, host.clientWidth), height })).observe(host);
    return { setData: (d) => entry.u.setData(d) };
  }

  function rethemeCharts() {
    for (const c of charts) {
      const data = c.u.data;
      c.u.destroy();
      c.u = c.make();
      c.u.setData(data);
    }
  }

  /* ---------- Preferências: tema claro/escuro e vista básica/avançada ---------- */
  const root = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignorar */ } };
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  const effectiveTheme = () => root.dataset.theme || (darkMQ.matches ? 'dark' : 'light');

  function syncPrefButtons() {
    const t = $('#btn-theme');
    if (t) {
      const dark = effectiveTheme() === 'dark';
      t.textContent = dark ? '☀ Claro' : '☾ Escuro';
      t.setAttribute('aria-label', dark ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
    }
    for (const b of document.querySelectorAll('[data-view-btn]')) {
      b.setAttribute('aria-pressed', String(b.dataset.viewBtn === root.dataset.view));
    }
  }

  function initPrefs() {
    const t = $('#btn-theme');
    if (t) {
      t.addEventListener('click', () => {
        const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        store('wlmon-theme', next);
        syncPrefButtons();
        rethemeCharts();
      });
    }
    darkMQ.addEventListener('change', () => { if (!root.dataset.theme) { syncPrefButtons(); rethemeCharts(); } });
    for (const b of document.querySelectorAll('[data-view-btn]')) {
      b.addEventListener('click', () => {
        root.dataset.view = b.dataset.viewBtn;
        store('wlmon-view', b.dataset.viewBtn);
        syncPrefButtons();
      });
    }
    syncPrefButtons();
  }
  initPrefs();

  /** Legenda para gráficos com mais de uma série (a cor nunca é a única pista). */
  function legend(series) {
    return el('div', { class: 'legend' }, series.map((s) =>
      el('span', { class: 'legend-item' }, el('span', { class: 'legend-key', style: { background: s.color.startsWith('--') ? `var(${s.color})` : s.color } }), s.label)));
  }

  function setBadge(badge, lvl, labels = { warn: '▲ Elevado', crit: '● Crítico' }) {
    if (!badge) return;
    badge.hidden = !lvl;
    badge.className = 'badge ' + (lvl || '');
    badge.textContent = lvl ? labels[lvl] : '';
  }


  /* ---------- Recomendações ---------- */
  const SEV = { crit: '● Urgente', warn: '▲ Importante', info: '◆ Sugestão' };

  /**
   * Lista de recomendações. opts: { showSite, limit, empty }.
   * O detalhe técnico e os passos só vêm na resposta da API para o admin;
   * aparecem na vista avançada.
   */
  function renderRecs(list, summary, more, data, opts = {}) {
    const items = data.items || [];
    const c = data.counts || {};
    const parts = [];
    if (c.crit) parts.push(`${c.crit} ${c.crit === 1 ? 'urgente' : 'urgentes'}`);
    if (c.warn) parts.push(`${c.warn} ${c.warn === 1 ? 'importante' : 'importantes'}`);
    if (c.info) parts.push(`${c.info} ${c.info === 1 ? 'sugestão' : 'sugestões'}`);
    summary.textContent = items.length ? `${items.length} oportunidades: ${parts.join(', ')}.` : '';
    let expanded = list.dataset.expanded === '1';
    const draw = () => {
      const shown = expanded ? items : items.slice(0, opts.limit || 6);
      list.replaceChildren(...(items.length ? shown.map((r) => el('li', { class: 'rec rec-' + r.severity },
        el('div', { class: 'rec-head' },
          el('span', { class: 'sev sev-' + r.severity }, SEV[r.severity] || r.severity),
          opts.showSite ? (r.site ? el('a', { class: 'rec-site', href: 'site.php?app=' + encodeURIComponent(r.site.key) }, r.site.label)
            : el('span', { class: 'rec-site' }, 'Servidor')) : null,
          el('span', { class: 'rec-area' }, r.area)),
        el('h3', { class: 'rec-title' }, r.title),
        el('p', { class: 'rec-simple' }, r.simple),
        el('div', { class: 'rec-meta' },
          el('span', { class: 'chip' }, 'Impacto ' + r.impact),
          el('span', { class: 'chip' }, 'Esforço ' + r.effort),
          (r.evidence || []).map((e) => el('span', { class: 'chip chip-ev' }, e))),
        r.tech || (r.actions && r.actions.length) ? el('details', { class: 'rec-more adv' },
          el('summary', {}, 'Detalhe técnico e o que fazer'),
          r.tech ? el('p', { class: 'rec-tech' }, r.tech) : null,
          r.actions && r.actions.length ? el('ol', { class: 'rec-actions' }, r.actions.map((a) => el('li', {}, a))) : null) : null))
        : [el('li', { class: 'rec rec-none' }, opts.empty || 'Sem recomendações de momento.')]));
      more.hidden = items.length <= (opts.limit || 6);
      more.textContent = expanded ? 'Mostrar menos' : `Ver todas (${items.length})`;
    };
    more.onclick = () => { expanded = !expanded; list.dataset.expanded = expanded ? '1' : '0'; draw(); };
    draw();
  }

  window.Mon = { $, css, el, getJSON, chart, legend, setBadge, renderRecs, pct, int, bytes, rate, secs, ago, nf0, nf1, nf2, fHMS, fDay };
})();
