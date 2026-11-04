/* Monitor de recursos: detalhe de tráfego de um site */
(() => {
  'use strict';

  const { $, el, getJSON, chart, legend, setBadge, renderRecs, pct, int, bytes, secs, ago, nf0, fDay } = window.Mon;

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


  /* ---------------- Base de dados e WordPress ---------------- */
  const UPLOAD_CATS = {
    images: 'Imagens originais', thumbs: 'Miniaturas geradas pelo WordPress', converted: 'Cópias WebP/AVIF',
    media: 'Vídeo e áudio', docs: 'Documentos (PDF, Office, ZIP)', other: 'Outros',
  };
  const STATE = { ok: 'OK', warn: 'Atenção', crit: 'Crítico', off: '–' };

  function every(sec) {
    if (!sec) return '–';
    if (sec < 60) return `${sec} s`;
    if (sec < 3600) return `${nf0.format(sec / 60)} min`;
    if (sec < 86400) return `${nf0.format(sec / 3600)} h`;
    return `${nf0.format(sec / 86400)} dias`;
  }

  function wtile(id, big, sub) {
    $('#' + id + ' .big').textContent = big;
    $('#' + id + ' .sub').textContent = sub;
  }

  const row = (...cells) => el('tr', {}, ...cells);
  const td = (v, cls) => el('td', cls ? { class: cls } : {}, v);
  const fill = (id, rows, cols, text) => $('#' + id).replaceChildren(...(rows.length ? rows : [empty(cols, text)]));

  function renderWp(d) {
    const wp = d.wp;
    const up = d.uploads;
    const banner = $('#wp-banner');
    if (!wp) {
      banner.hidden = false;
      banner.textContent = 'Ainda não há análise do WordPress deste site. Corre de hora a hora (a base de dados é analisada uma vez por dia).';
      $('#wp-age').textContent = '';
      return;
    }
    const db = wp.db || {};
    const fs = wp.fs || {};
    banner.hidden = !db.error;
    banner.textContent = db.error ? 'A base de dados não pôde ser analisada: ' + db.error : '';
    $('#wp-age').textContent = `Analisado ${ago(d.now - wp.ts)}` + (up ? ` · uploads ${ago(d.now - up.ts)}` : ' · uploads ainda não analisados');

    // Indicadores
    const tables = db.tables || [];
    let dbSub = `${tables.length} tabelas`;
    const tr = (d.trend || []).filter((t) => t.db != null);
    if (tr.length > 1) {
      const delta = tr[tr.length - 1].db - tr[Math.max(0, tr.length - 31)].db;
      dbSub += ` · ${delta >= 0 ? '+' : '−'}${bytes(Math.abs(delta))} em ${Math.min(30, tr.length - 1)} dias`;
    } else if (db.db_free > 10 * 1048576) {
      dbSub += ` · ${bytes(db.db_free)} por recuperar`;
    }
    wtile('w-db', bytes(db.db_bytes), dbSub);
    const al = db.autoload || {};
    wtile('w-autoload', bytes(al.bytes), `carregadas em cada pedido · ${int(al.count)} opções`);
    setBadge($('#w-autoload .badge'), al.bytes > 2 * 1048576 ? 'crit' : al.bytes > 800 * 1024 ? 'warn' : null,
      { warn: '▲ Grande', crit: '● Muito grande' });
    const installed = fs.plugins || [];
    const active = new Set(db.active_plugins || []);
    const inactive = installed.filter((p) => !active.has(p.file));
    wtile('w-plugins', int(active.size), `${int(installed.length)} instalados · ${int(inactive.length)} inativos`);
    if (up) {
      const th = up.cats?.thumbs?.bytes || 0;
      wtile('w-uploads', bytes(up.bytes), `${int(up.files)} ficheiros · ${pct(up.bytes ? (100 * th) / up.bytes : 0)} miniaturas`);
    } else {
      wtile('w-uploads', '–', 'Análise semanal ainda não feita');
    }
    const cron = db.cron || {};
    const as = db.action_scheduler;
    wtile('w-cron', int(cron.events), `${int(cron.overdue)} em atraso` + (as && as.status?.failed ? ` · ${int(as.status.failed)} falhadas` : ''));
    setBadge($('#w-cron .badge'), cron.overdue > 5 || (as && as.late > 100) ? 'warn' : null, { warn: '▲ Atrasos', crit: '● Atrasos' });
    wtile('w-ver', fs.wp_version || '–', [d.app.php ? 'PHP ' + d.app.php : '', db.theme?.stylesheet ? 'tema ' + db.theme.stylesheet : ''].filter(Boolean).join(' · '));

    // Configuração
    const cfg = fs.config || {};
    const posts = db.posts || {};
    const isStaging = /^staging\./i.test(d.app.label);
    const conf = [];
    const add = (label, state, level, note) => conf.push(row(td(label), td(el('span', { class: 'state state-' + level }, state)), td(note || '', 'note')));
    add('Cache de objetos', fs.object_cache ? 'Ativa' : 'Não', fs.object_cache ? 'ok' : 'warn',
      fs.object_cache || 'Sem Redis: cada pedido repete as mesmas consultas à base de dados');
    add('Cache de páginas no WordPress', fs.page_cache ? 'Ativa' : 'Não', fs.page_cache ? 'ok' : 'off',
      fs.page_cache || 'O Varnish do servidor pode fazer este papel');
    add('Modo de depuração (WP_DEBUG)', cfg.WP_DEBUG === true ? 'Ligado' : 'Desligado', cfg.WP_DEBUG === true ? 'warn' : 'ok',
      cfg.WP_DEBUG === true ? 'Em produção deve estar desligado' : '');
    if (fs.debug_log != null) {
      add('Ficheiro debug.log', bytes(fs.debug_log), fs.debug_log > 50 * 1048576 ? 'warn' : 'off', 'wp-content/debug.log');
    }
    add('WP-Cron', cfg.DISABLE_WP_CRON === true ? 'Cron do sistema' : 'Nas visitas', cfg.DISABLE_WP_CRON === true ? 'ok' : 'warn',
      cfg.DISABLE_WP_CRON === true ? '' : 'As tarefas correm durante as visitas; é mais leve com um cron do sistema');
    const rev = cfg.WP_POST_REVISIONS;
    add('Revisões guardadas', rev === undefined || rev === true || rev === -1 ? 'Ilimitadas' : rev === false || rev === 0 ? 'Desativadas' : `Até ${rev}`,
      rev === undefined || rev === true || rev === -1 ? 'warn' : 'ok', posts.revisions ? `${int(posts.revisions)} revisões na base de dados` : '');
    add('Tabelas MyISAM', db.myisam ? int(db.myisam) : 'Nenhuma', db.myisam ? 'warn' : 'ok', db.myisam ? 'Converter para InnoDB' : '');
    if (db.blog_public != null) {
      add('Visível nos motores de busca', db.blog_public ? 'Sim' : 'Não', isStaging && db.blog_public ? 'warn' : 'off',
        isStaging && db.blog_public ? 'Site de staging aberto aos robôs de pesquisa' : '');
    }
    if (cfg.WP_MEMORY_LIMIT) add('Memória do WordPress (WP_MEMORY_LIMIT)', String(cfg.WP_MEMORY_LIMIT), 'off', '');
    $('#tb-config').replaceChildren(...conf);

    // Limpeza
    const cm = db.comments || {};
    const tt = db.transients || {};
    const cl = [];
    const addC = (label, v) => { if (v) cl.push(row(td(label), td(v, 'num'))); };
    addC('Revisões de artigos e páginas', posts.revisions ? int(posts.revisions) + (posts.revision_meta ? ` (+${int(posts.revision_meta)} metadados)` : '') : 0);
    addC('Rascunhos automáticos', posts.auto_drafts ? int(posts.auto_drafts) : 0);
    addC('Conteúdos no lixo', posts.trash ? int(posts.trash) : 0);
    addC('Metadados órfãos (de conteúdos apagados)', posts.orphan_meta ? int(posts.orphan_meta) : 0);
    addC('Comentários marcados como spam', cm.spam ? int(cm.spam) : 0);
    addC('Comentários no lixo', cm.trash ? int(cm.trash) : 0);
    addC('Transients expirados', tt.expired ? `${int(tt.expired)} de ${int(tt.count)}` : 0);
    if (as) {
      const old = (as.status?.complete || 0) + (as.status?.failed || 0) + (as.status?.canceled || 0);
      addC('Ações antigas do Action Scheduler', old ? int(old) : 0);
    }
    addC('Espaço livre dentro das tabelas', db.db_free > 10 * 1048576 ? bytes(db.db_free) : 0);
    fill('tb-cleanup', cl, 2, 'Nada relevante para limpar.');

    // Tabelas
    $('#tables-note').textContent = `${tables.length} tabelas · ${bytes(db.db_bytes)} no total`;
    fill('tb-tables', tables.slice(0, 12).map((t) => row(td(t.name, 'mono'), td(t.engine || '–'), td(int(t.rows), 'num'), td(bytes(t.bytes), 'num'))), 4);
    fill('tb-autoload', (db.autoload_top || []).filter((o) => o.bytes > 1024).map((o) => row(td(o.name, 'mono'), td(bytes(o.bytes), 'num'))), 2, 'Nenhuma opção acima de 1 KB.');

    // Cron
    fill('tb-cron', (cron.hooks || []).map((h) => row(td(h.hook, 'mono'), td(int(h.n), 'num'), td(every(h.interval), 'num'),
      td(h.overdue ? int(h.overdue) : '–', 'num'))), 4, 'Sem eventos agendados.');
    const asRows = [];
    if (as) {
      for (const [k, label] of [['pending', 'Pendentes'], ['failed', 'Falhadas'], ['complete', 'Concluídas'], ['canceled', 'Canceladas']]) {
        if (as.status?.[k]) asRows.push(row(td(label), td(int(as.status[k]), 'num')));
      }
      if (as.late) asRows.push(row(td('Pendentes em atraso (mais de 10 min)'), td(int(as.late), 'num')));
      for (const h of as.hooks || []) asRows.push(row(td(h.hook, 'mono'), td(int(h.n), 'num')));
    }
    fill('tb-as', asRows, 2, 'Este site não usa o Action Scheduler.');

    // Plugins: ativos primeiro
    $('#plugins-note').textContent = `${int(active.size)} ativos, ${int(inactive.length)} inativos` + (fs.mu_plugins?.length ? ` · ${fs.mu_plugins.length} mu-plugins` : '');
    const plugins = [...installed].sort((a, b) => active.has(b.file) - active.has(a.file) || a.name.localeCompare(b.name));
    fill('tb-plugins', plugins.map((p) => row(td(p.name), td(p.version || '–'),
      td(el('span', { class: 'state state-' + (active.has(p.file) ? 'ok' : 'off') }, active.has(p.file) ? 'Ativo' : 'Inativo')))), 3);

    // Uploads
    if (up) {
      $('#uploads-note').textContent = `${int(up.files)} ficheiros · ${bytes(up.bytes)}` + (up.big_count ? ` · ${int(up.big_count)} acima de 5 MB` : '');
      const cats = Object.entries(up.cats || {}).sort((a, b) => b[1].bytes - a[1].bytes);
      fill('tb-uploads', cats.map(([k, c]) => row(td(UPLOAD_CATS[k] || k), td(int(c.files), 'num'), td(bytes(c.bytes), 'num'),
        td(pct(up.bytes ? (100 * c.bytes) / up.bytes : 0), 'num'))), 4);
      fill('tb-years', Object.entries(up.years || {}).reverse().map(([y, b]) => row(td(y), td(bytes(b), 'num'))), 2);
      fill('tb-big', (up.big || []).slice(0, 8).map((f) => row(td(f.path, 'mono'), td(bytes(f.bytes), 'num'))), 2, 'Nenhum ficheiro acima de 5 MB.');
    } else {
      $('#uploads-note').textContent = 'A composição dos uploads é analisada uma vez por semana.';
      for (const id of ['tb-uploads', 'tb-years', 'tb-big']) fill(id, [], 4, 'Ainda não analisado.');
    }
  }

  async function loadWp() {
    try {
      const d = await getJSON(`api.php?a=wp&app=${encodeURIComponent(app)}`);
      if (!d.error) renderWp(d);
    } catch (e) { /* a secção fica com os valores anteriores */ }
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
  for (const b of document.querySelectorAll('.range button')) {
    b.addEventListener('click', () => {
      state.range = b.dataset.range;
      for (const x of document.querySelectorAll('.range button')) x.setAttribute('aria-pressed', String(x === b));
      load();
    });
  }
  async function loadRecs() {
    try {
      const d = await getJSON(`api.php?a=advice&app=${encodeURIComponent(app)}`);
      renderRecs($('#recs'), $('#recs-summary'), $('#recs-more'), d, { limit: 6, empty: 'Sem recomendações para este site de momento.' });
    } catch (e) { /* tenta outra vez mais tarde */ }
  }
  setInterval(() => { if (!document.hidden) loadRecs(); }, 300000);

  load();
  loadWp();
  loadRecs();
  setInterval(() => { if (!document.hidden) loadWp(); }, 600000);
})();
