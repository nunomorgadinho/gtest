/* Interface da app: criar, guardar, editar, jogar e exportar jogos. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const G = window.MDJGen;
  const TPL = G.TEMPLATES_PT;
  const TPL_ICON = { plataforma: '🏃', corrida: '🏎️', espaco: '🚀', masmorra: '🗝️', torre: '🧱', cortar: '🔪', bolhas: '🫧' };
  const EXTRA_HEROES = ['🐱', '🐶', '🐰', '🐼', '🦁', '🐵', '🐸', '🦊', '🐧', '🦖', '🤖', '🥷', '🧙', '🦸', '🚀', '🏎️', '🐙', '🐝', '👻', '🦄'];
  let games = [], cur = null, preview = null, full = null, chosenType = null;

  // ---------- armazenamento ----------
  function load() { try { games = JSON.parse(localStorage.getItem('mdj_games') || 'null'); } catch (e) { games = null; } }
  function save() { try { localStorage.setItem('mdj_games', JSON.stringify(games)); } catch (e) { toast('Não foi possível guardar neste dispositivo'); } }
  load();
  if (!Array.isArray(games)) {
    // primeiros jogos de exemplo
    games = [
      G.generate('Aventura no céu com uma fada', { name: 'Aventura no Céu', template: 'plataforma', themeKey: 'fantasia', hero: '🧚', seed: 11 }),
      G.generate('corrida', { name: 'Pixel Turbo', template: 'corrida', themeKey: 'cidade', hero: '🏎️', seed: 22 }),
      G.generate('labirinto', { name: 'Masmorra Sombria', template: 'masmorra', themeKey: 'terror', hero: '🧙', seed: 33 }),
      G.generate('nave', { name: 'Fuga Espacial', template: 'espaco', themeKey: 'espaco', hero: '🚀', seed: 44 })
    ];
    games.forEach((g, i) => { g.id = 'exemplo' + i; g.created = Date.now() - (4 - i) * 1000; });
    save();
  }

  function toast(s) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); window.scrollTo(0, 0); }

  // ---------- início ----------
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function renderIdeas() {
    const box = $('ideas'); box.innerHTML = '';
    const sur = document.createElement('button'); sur.className = 'chip'; sur.textContent = '🎲 Surpreende-me';
    sur.onclick = () => { $('desc').value = shuffle(G.IDEAS)[0]; };
    box.appendChild(sur);
    shuffle(G.IDEAS).slice(0, 4).forEach((s) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = s; b.onclick = () => { $('desc').value = s; }; box.appendChild(b); });
  }
  function renderTypes() {
    const box = $('types'); box.innerHTML = '';
    [[null, '✨ Automático']].concat(Object.keys(TPL).map((k) => [k, TPL_ICON[k] + ' ' + TPL[k]])).forEach(([k, l]) => {
      const b = document.createElement('button'); b.className = 'chip' + (chosenType === k ? ' sel' : ''); b.textContent = l;
      b.onclick = () => { chosenType = k; renderTypes(); }; box.appendChild(b);
    });
  }
  function renderGallery() {
    const box = $('gallery'); box.innerHTML = '';
    $('count').textContent = games.length ? games.length + (games.length === 1 ? ' jogo' : ' jogos') : '';
    if (!games.length) { box.innerHTML = '<div class="empty">Ainda não tens jogos. Descreve um em cima e toca em Criar Jogo.</div>'; return; }
    games.slice().sort((a, b) => b.created - a.created).forEach((g) => {
      const card = document.createElement('div'); card.className = 'game'; card.setAttribute('role', 'button'); card.tabIndex = 0;
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 320; card.appendChild(cv);
      try { MDJ.thumb(cv, G.resolve(g)); } catch (e) { /* miniatura opcional */ }
      const info = document.createElement('div'); info.className = 'info';
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = g.name;
      const tp = document.createElement('div'); tp.className = 'tp'; tp.textContent = TPL_ICON[g.template] + ' ' + TPL[g.template];
      info.append(nm, tp); card.appendChild(info);
      const pl = document.createElement('button'); pl.className = 'play'; pl.textContent = '▶'; pl.setAttribute('aria-label', 'Jogar ' + g.name);
      pl.onclick = (e) => { e.stopPropagation(); playFull(g); };
      card.appendChild(pl);
      card.onclick = () => openEditor(g.id);
      box.appendChild(card);
    });
  }

  // ---------- criar ----------
  function sparkles() {
    const e = ['✨', '⭐', '🌟', '💫', '🎮'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div'); s.className = 'spark'; s.textContent = e[i % e.length];
      s.style.left = innerWidth / 2 + 'px'; s.style.top = innerHeight / 2 + 'px';
      s.style.setProperty('--dx', (Math.random() - 0.5) * 360 + 'px'); s.style.setProperty('--dy', (Math.random() - 0.5) * 420 + 'px');
      document.body.appendChild(s); setTimeout(() => s.remove(), 1100);
    }
  }
  $('createBtn').onclick = () => {
    const desc = $('desc').value.trim() || shuffle(G.IDEAS)[0];
    const g = G.generate(desc, chosenType ? { template: chosenType } : null);
    const steps = ['A ler a tua ideia', 'A escolher o mundo: ' + G.THEMES[g.themeKey].label, 'A desenhar o herói ' + g.hero, 'A compor a música', 'A afinar a diversão'];
    $('making').classList.add('on'); $('createBtn').disabled = true;
    let k = 0; $('progBar').style.width = '0%';
    const tick = () => {
      $('progTxt').textContent = steps[k]; $('progBar').style.width = ((k + 1) / steps.length * 100) + '%';
      if (++k < steps.length) setTimeout(tick, window.MDJ_FAST ? 10 : 420);
      else setTimeout(() => {
        $('making').classList.remove('on'); $('createBtn').disabled = false;
        games.push(g); save(); renderGallery(); sparkles(); openEditor(g.id); toast('“' + g.name + '” está pronto! Experimenta já.');
      }, window.MDJ_FAST ? 10 : 450);
    };
    tick();
  };

  // ---------- editor ----------
  function seg(boxId, items, value, onPick) {
    const box = $(boxId); box.innerHTML = '';
    items.forEach(([v, label]) => {
      const b = document.createElement('button'); b.textContent = label; if (v === value) b.className = 'sel';
      b.onclick = () => { onPick(v); }; box.appendChild(b);
    });
  }
  function renderEditor() {
    const g = cur;
    $('edTitle').textContent = g.name; if (document.activeElement !== $('nameIn')) $('nameIn').value = g.name;
    seg('tplSeg', Object.keys(TPL).map((k) => [k, TPL_ICON[k] + ' ' + TPL[k]]), g.template, (v) => change({ template: v }));
    seg('themeSeg', Object.keys(G.THEMES).map((k) => [k, G.THEMES[k].deco[0] + ' ' + G.THEMES[k].label]), g.themeKey, (v) => change({ themeKey: v, hueShift: 0 }));
    const heroes = [...new Set(G.THEMES[g.themeKey].heroes.concat([g.hero], EXTRA_HEROES))];
    seg('heroSeg', heroes.map((h) => [h, h]), g.hero, (v) => change({ hero: v }));
    $('hueIn').value = g.hueShift || 0;
    seg('speedSeg', [[0.8, '🐢 Calmo'], [1, '🙂 Normal'], [1.3, '⚡ Rápido']], g.speed, (v) => change({ speed: v }));
    seg('diffSeg', [[0, 'Fácil'], [1, 'Normal'], [2, 'Difícil']], g.difficulty, (v) => change({ difficulty: v }));
    $('musicIn').checked = g.music !== false;
  }
  function restartPreview() {
    if (preview) preview.stop();
    preview = MDJ.run($('prevCv'), G.resolve(cur), { top: 4 });
  }
  function change(p) { Object.assign(cur, p); save(); renderEditor(); restartPreview(); }
  function openEditor(id) {
    cur = games.find((g) => g.id === id); if (!cur) return;
    show('editor'); renderEditor(); requestAnimationFrame(restartPreview);
  }
  function closeEditor() { if (preview) { preview.stop(); preview = null; } cur = null; show('home'); renderGallery(); }
  $('backBtn').onclick = closeEditor;
  $('nameIn').oninput = () => { const v = $('nameIn').value.trim(); if (v) { cur.name = v; $('edTitle').textContent = v; save(); } };
  $('nameIn').onchange = () => restartPreview();
  $('hueIn').oninput = () => { cur.hueShift = +$('hueIn').value; save(); restartPreview(); };
  $('musicIn').onchange = () => { cur.music = $('musicIn').checked; save(); restartPreview(); };
  $('delBtn').onclick = () => {
    if (!confirm('Apagar “' + cur.name + '”? Esta ação não se pode desfazer.')) return;
    games = games.filter((g) => g !== cur); save(); closeEditor(); toast('Jogo apagado');
  };
  $('playBtn').onclick = () => playFull(cur);

  // ---------- jogar em ecrã inteiro ----------
  function playFull(g) {
    if (preview) preview.pause();
    $('playLayer').classList.add('on');
    requestAnimationFrame(() => { full = MDJ.run($('playCv'), G.resolve(g), { top: 56 }); });
    try { document.documentElement.requestFullscreen && !window.Android && document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* opcional */ }
  }
  function closePlay() {
    if (full) { full.stop(); full = null; }
    $('playLayer').classList.remove('on');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (preview) preview.resume();
    if (!cur) renderGallery();
  }
  $('closePlay').onclick = closePlay;

  // ---------- APK ----------
  function apkDialog(icon, title, txt, buttons) {
    $('apkIcon').textContent = icon; $('apkTitle').textContent = title; $('apkTxt').innerHTML = txt;
    const box = $('apkBtns'); box.innerHTML = '';
    (buttons || []).forEach(([label, cls, fn]) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = fn; box.appendChild(b); });
    $('apkLayer').classList.add('on');
  }
  const closeApk = () => $('apkLayer').classList.remove('on');
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  $('apkBtn').onclick = () => {
    const g = cur;
    apkDialog('📦', 'A preparar o APK…', 'A juntar o motor, o teu jogo e o ícone, e a assinar a app.');
    setTimeout(() => {
      let res;
      try { res = MDJApk.build(g, G.resolve(g)); } catch (e) { apkDialog('⚠️', 'Não deu para criar o APK', esc(e.message), [['Fechar', 'big', closeApk]]); return; }
      window.lastApk = res;
      const kb = Math.round(res.bytes.length / 1024) + ' KB';
      if (window.Android && Android.saveApk) {
        const where = Android.saveApk(MDJApk.bytesToB64(res.bytes), res.fileName);
        if (!where) { apkDialog('⚠️', 'Não deu para guardar', 'Verifica se há espaço livre no telemóvel.', [['Fechar', 'big', closeApk]]); return; }
        apkDialog('✅', 'APK pronto!', '<b>' + esc(res.label) + '</b> (' + kb + ')<br>Guardado em ' + esc(where) + '.<br><br>Na primeira vez, o Android pede para autorizar o Mago dos Jogos a instalar apps.', [
          ['Instalar agora', 'big alt', () => {
            const r = Android.installApk(res.fileName);
            if (r === 'permission') toast('Ativa “Permitir desta fonte” e toca outra vez em Instalar');
          }],
          ['Fechar', 'link', closeApk]
        ]);
      } else if (window.claude && claude.use) {
        // página publicada no claude.ai: só se pode oferecer .zip, por isso o APK vai lá dentro
        claude.use('downloads').then((dl) => {
          if (!dl) throw { code: 'unavailable' };
          return dl.save({ filename: res.fileName.replace(/\.apk$/, '') + '-apk.zip', data: MDJApk.zipOne(res.fileName, res.bytes) });
        }).then(() => {
          apkDialog('✅', 'APK pronto!', '<b>' + esc(res.fileName) + '</b> (' + kb + ') vai dentro do ficheiro .zip.<br><br>Abre o .zip no telemóvel Android (7.0 ou mais recente), toca no APK e aceita instalar apps de fontes desconhecidas.', [['Fechar', 'big', closeApk]]);
        }, (e) => {
          const msg = e && e.code === 'declined' ? 'Cancelaste a transferência.' : 'Esta página não consegue descarregar ficheiros aqui. Usa a app Mago dos Jogos ou o ficheiro HTML.';
          apkDialog('ℹ️', 'APK não descarregado', msg, [['Fechar', 'big', closeApk]]);
        });
      } else {
        const url = URL.createObjectURL(new Blob([res.bytes], { type: 'application/vnd.android.package-archive' }));
        const a = document.createElement('a'); a.href = url; a.download = res.fileName; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        apkDialog('✅', 'APK descarregado!', '<b>' + esc(res.fileName) + '</b> (' + kb + ')<br><br>Envia o ficheiro para um telemóvel Android (7.0 ou mais recente), abre-o e aceita instalar apps de fontes desconhecidas.', [['Fechar', 'big', closeApk]]);
      }
    }, 60);
  };

  // botão "voltar" do Android e pausa
  window.mdjBack = () => {
    if ($('apkLayer').classList.contains('on')) { closeApk(); return true; }
    if ($('playLayer').classList.contains('on')) { closePlay(); return true; }
    if (cur) { closeEditor(); return true; }
    return false;
  };
  window.mdjPause = () => { if (full) full.pause(); if (preview) preview.pause(); };
  window.mdjResume = () => { if (full) full.resume(); else if (preview) preview.resume(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.mdjBack(); });

  renderIdeas(); renderTypes(); renderGallery();
  window.mdj = { get games() { return games; }, get cur() { return cur; }, get preview() { return preview; }, get full() { return full; }, openEditor, playFull, closePlay };
})();
