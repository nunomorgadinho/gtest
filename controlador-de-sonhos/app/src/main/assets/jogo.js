/*
 * Controlador de Sonhos
 * Guia o sonhador pela noite (23:00 às 07:00), apanha coisas boas, evita pesadelos.
 */
(function () {
  "use strict";

  // =====================================================================
  // Configuração
  // =====================================================================
  const DURACAO_NOITE = 90;        // segundos de jogo por noite
  const VIDAS_MAX = 3;
  const DURACAO_LUCIDO = 6;
  const DURACAO_LENTO = 5;
  const INVULNERAVEL = 1.4;
  const LIMITE_CIMA = () => Math.max(150, H * 0.22); // o sonhador não sobe para debaixo do HUD

  // Mundos de sonho: cada um ocupa um quarto da noite
  const MUNDOS = [
    { nome: "Nuvens de Algodão", ceu: ["#1a0f4a", "#5b2a86", "#d77fb3"], especial: "🍭", maus: ["👻", "🦇"], deco: ["☁️"] },
    { nome: "Oceano de Chá",     ceu: ["#06173a", "#0e4d72", "#3aa5a8"], especial: "🐠", maus: ["🦈", "🐙"], deco: ["🫧", "🐚"] },
    { nome: "Cidade dos Relógios", ceu: ["#1f0e1e", "#5a2440", "#c46a4a"], especial: "🧁", maus: ["🕷️", "👹"], deco: ["🕰️", "🏰"] },
    { nome: "Viagem Espacial",   ceu: ["#03020c", "#1a0b45", "#4a1d7a"], especial: "🪐", maus: ["☄️", "👾"], deco: ["🛰️", "🌑"] }
  ];
  const AMANHECER = ["#2a1f5c", "#d76b6b", "#ffc27a"];

  const BONS = [
    { emoji: "⭐", pontos: 10, peso: 6 },
    { emoji: "🌙", pontos: 25, peso: 2 }
  ];

  // =====================================================================
  // Estado
  // =====================================================================
  const tela = document.getElementById("tela");
  const ctx = tela.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  let modo = "menu"; // menu | jogar | pausa | fim
  let j = null;      // estado da partida
  let tGlobal = 0;
  let ultimoFrame = 0;

  const guardado = (() => {
    try { return JSON.parse(localStorage.getItem("sonhos.progresso")) || {}; } catch (e) { return {}; }
  })();
  guardado.recorde = guardado.recorde || 0;
  guardado.melhorNoite = guardado.melhorNoite || 1;
  guardado.noite = guardado.noite || 1;
  if (guardado.som === undefined) guardado.som = true;
  function grava() { try { localStorage.setItem("sonhos.progresso", JSON.stringify(guardado)); } catch (e) { /* ignora */ } }

  // Estrelas do fundo (posições relativas)
  const estrelasFundo = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + .3, f: Math.random() * 6, v: Math.random() * .3 + .1 }));
  const decoFundo = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: i / 7, s: 40 + Math.random() * 50, v: 12 + Math.random() * 18, i }));

  // =====================================================================
  // Utilitários
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const escolhe = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function misturaCor(a, b, t) { const x = hexRgb(a), y = hexRgb(b); return "rgb(" + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(",") + ")"; }

  function redimensiona() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    tela.width = Math.round(W * DPR); tela.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (j) { j.alvo.x = Math.min(j.alvo.x, W - 30); j.alvo.y = Math.min(j.alvo.y, H - 40); }
  }
  window.addEventListener("resize", redimensiona);

  // Sprites de emoji com brilho, pré-desenhados para desempenho
  const sprites = new Map();
  function sprite(emoji, tam, brilho) {
    const chave = emoji + "|" + tam + "|" + (brilho || "");
    let s = sprites.get(chave);
    if (s) return s;
    const pad = brilho ? Math.ceil(tam * .45) : 4;
    const lado = Math.ceil(tam + pad * 2);
    const c = document.createElement("canvas");
    c.width = Math.ceil(lado * DPR); c.height = Math.ceil(lado * DPR);
    const g = c.getContext("2d");
    g.scale(DPR, DPR);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = tam + 'px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    if (brilho) {
      g.shadowColor = brilho; g.shadowBlur = tam * .45;
      g.fillText(emoji, lado / 2, lado / 2 + tam * .06);
      g.shadowBlur = tam * .2;
    }
    g.fillText(emoji, lado / 2, lado / 2 + tam * .06);
    s = { c, lado };
    sprites.set(chave, s);
    return s;
  }
  function desenhaEmoji(emoji, x, y, tam, brilho, alfa, rot) {
    const s = sprite(emoji, Math.round(tam), brilho);
    ctx.save();
    if (alfa !== undefined) ctx.globalAlpha = alfa;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(s.c, -s.lado / 2, -s.lado / 2, s.lado, s.lado);
    ctx.restore();
  }

  // =====================================================================
  // Áudio: música ambiente e efeitos (Web Audio, sem ficheiros)
  // =====================================================================
  const Som = (() => {
    let ac = null, mestre = null, musica = null, efeitos = null, eco = null;
    let proxima = 0, passo = 0, timer = null, aTocar = false;
    const ESCALA = [0, 2, 4, 7, 9]; // pentatónica maior
    const ACORDES = [[57, 64, 69], [53, 60, 65], [60, 67, 72], [55, 62, 67]]; // Lá m, Fá, Dó, Sol
    const BPM = 84, COLCHEIA = 60 / BPM / 2;
    const f = (m) => 440 * Math.pow(2, (m - 69) / 12);

    function init() {
      if (ac) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      mestre = ac.createGain(); mestre.gain.value = guardado.som ? 0.9 : 0; mestre.connect(ac.destination);
      musica = ac.createGain(); musica.gain.value = 0.32; musica.connect(mestre);
      efeitos = ac.createGain(); efeitos.gain.value = 0.7; efeitos.connect(mestre);
      // Eco sonhador
      eco = ac.createDelay(1); eco.delayTime.value = COLCHEIA * 3;
      const ret = ac.createGain(); ret.gain.value = 0.38;
      const filtro = ac.createBiquadFilter(); filtro.type = "lowpass"; filtro.frequency.value = 2200;
      eco.connect(filtro).connect(ret).connect(eco); ret.connect(musica);
      timer = setInterval(agenda, 40);
      return true;
    }

    function tom(freq, t, dur, tipo, vol, destino, ataque) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = tipo; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (ataque || 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(destino);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }

    function agenda() {
      if (!aTocar || ac.state !== "running") return;
      if (proxima < ac.currentTime) proxima = ac.currentTime + 0.05;
      while (proxima < ac.currentTime + 0.2) {
        const compasso = Math.floor(passo / 8) % 4;
        const p = passo % 8;
        const acorde = ACORDES[compasso];
        const lucido = j && j.lucidoAte > j.tempo;
        // Pad suave no início de cada compasso
        if (p === 0) acorde.forEach((m) => tom(f(m - 12), proxima, COLCHEIA * 8, "triangle", 0.05, musica, 0.5));
        // Baixo
        if (p === 0 || p === 4) tom(f(acorde[0] - 24), proxima, COLCHEIA * 3.5, "sine", 0.16, musica, 0.02);
        // Arpejo de caixinha de música (mais rápido no sonho lúcido)
        if (p % 2 === 0 || lucido) {
          const base = acorde[0] + 12;
          const grau = ESCALA[(p * 3 + compasso * 2 + (lucido ? passo : 0)) % ESCALA.length];
          const n = tom(f(base + grau + (p > 5 ? 12 : 0)), proxima, 0.5, "sine", lucido ? 0.09 : 0.07, musica);
          const g2 = ac.createGain(); g2.gain.value = 0.5; n.connect(g2).connect(eco);
        }
        proxima += COLCHEIA;
        passo++;
      }
    }

    return {
      comecar() {
        if (!init()) return;
        if (ac.state !== "running") ac.resume();
        if (!aTocar) { aTocar = true; proxima = ac.currentTime + 0.1; }
      },
      pausa() { if (ac) ac.suspend(); },
      retoma() { if (ac && aTocar) ac.resume(); },
      ligado(v) { if (mestre) mestre.gain.setTargetAtTime(v ? 0.9 : 0, ac.currentTime, 0.05); },
      efeito(nome, extra) {
        if (!ac || !guardado.som || ac.state !== "running") return;
        const t = ac.currentTime + 0.01;
        if (nome === "estrela") { const b = 76 + Math.min(extra || 0, 8) * 2; tom(f(b), t, 0.18, "sine", 0.2, efeitos); tom(f(b + 7), t + 0.05, 0.25, "sine", 0.15, efeitos); }
        if (nome === "lua") { [72, 79, 84].forEach((m, i) => tom(f(m), t + i * 0.05, 0.4, "triangle", 0.15, efeitos)); }
        if (nome === "lucidez") { tom(f(88), t, 0.3, "sine", 0.15, efeitos); tom(f(95), t + 0.07, 0.35, "sine", 0.12, efeitos); }
        if (nome === "dano") {
          const o = tom(160, t, 0.4, "sawtooth", 0.18, efeitos); o.frequency.exponentialRampToValueAtTime(50, t + 0.35);
        }
        if (nome === "lucido") { const o = tom(220, t, 1.2, "triangle", 0.2, efeitos, 0.05); o.frequency.exponentialRampToValueAtTime(1760, t + 1); }
        if (nome === "poder") { [67, 71, 74, 79].forEach((m, i) => tom(f(m), t + i * 0.06, 0.3, "square", 0.06, efeitos)); }
        if (nome === "converte") { tom(f(84 + Math.floor(Math.random() * 5)), t, 0.2, "square", 0.07, efeitos); }
        if (nome === "vitoria") { [72, 76, 79, 84, 88, 91].forEach((m, i) => tom(f(m), t + i * 0.12, 0.8, "triangle", 0.15, efeitos)); }
        if (nome === "derrota") { [64, 60, 57, 52].forEach((m, i) => tom(f(m), t + i * 0.18, 0.6, "triangle", 0.15, efeitos)); }
        if (nome === "alarme") { for (let i = 0; i < 4; i++) tom(1400, t + i * 0.07, 0.05, "square", 0.05, efeitos); }
      }
    };
  })();

  // =====================================================================
  // Partida
  // =====================================================================
  function novaPartida(noite) {
    j = {
      noite,
      tempo: 0,
      pontos: 0,
      vidas: VIDAS_MAX,
      lucidez: 0,
      lucidoAte: -1,
      lentoAte: -1,
      invulAte: -1,
      combo: 0,
      comboMax: 1,
      estrelas: 0,
      mundo: -1,
      sonhador: { x: W / 2, y: H * 0.72, cara: "😴" },
      alvo: { x: W / 2, y: H * 0.72 },
      entidades: [],
      particulas: [],
      textos: [],
      spawn: { bom: 0.5, mau: 1.2, poder: 4, zzz: 0 },
      abanar: 0
    };
  }

  function velocidade() {
    const frac = j.tempo / DURACAO_NOITE;
    let v = 150 * (1 + 0.1 * (j.noite - 1)) * (1 + 0.55 * frac);
    if (j.lentoAte > j.tempo) v *= 0.45;
    return v;
  }

  function mundoAtual() { return Math.min(3, Math.floor(j.tempo / DURACAO_NOITE * 4)); }

  function cria(tipo, emoji, extra) {
    const tam = extra && extra.tam || (tipo === "mau" ? 42 : 34);
    const e = Object.assign({
      tipo, emoji, tam,
      x: rnd(tam, W - tam), y: -tam,
      vy: velocidade() * rnd(0.8, 1.2), vx: 0,
      mov: "reto", fase: Math.random() * 6, rot: 0
    }, extra || {});
    j.entidades.push(e);
    return e;
  }

  function geraEntidades(dt) {
    const frac = j.tempo / DURACAO_NOITE;
    const m = MUNDOS[mundoAtual()];
    const amanhecer = frac > 0.88;
    const sp = j.spawn;

    sp.bom -= dt;
    if (sp.bom <= 0) {
      sp.bom = rnd(0.35, 0.65);
      const r = Math.random();
      if (r < 0.12) cria("bom", m.especial, { pontos: 40, tam: 38, mov: "onda" });
      else {
        const total = BONS.reduce((s, b) => s + b.peso, 0);
        let x = Math.random() * total, b = BONS[0];
        for (const op of BONS) { x -= op.peso; if (x <= 0) { b = op; break; } }
        cria("bom", b.emoji, { pontos: b.pontos, mov: Math.random() < 0.3 ? "onda" : "reto" });
      }
    }

    sp.mau -= dt;
    if (sp.mau <= 0) {
      const base = Math.max(0.32, 1.15 - 0.13 * mundoAtual() - 0.08 * (j.noite - 1));
      sp.mau = rnd(base * 0.7, base * 1.3) * (amanhecer ? 0.6 : 1);
      if (amanhecer && Math.random() < 0.6) {
        cria("mau", "⏰", { mov: "abana", tam: 40 });
        Som.efeito("alarme");
      } else {
        const emoji = escolhe(m.maus);
        const padrao = emoji === "🦇" || emoji === "👾" ? "ziguezague" : emoji === "👹" || emoji === "🦈" ? "persegue" : emoji === "☄️" ? "diagonal" : Math.random() < 0.35 ? "onda" : "reto";
        const e = cria("mau", emoji, { mov: padrao });
        if (padrao === "diagonal") { e.x = rnd(0, W); e.vx = (e.x < W / 2 ? 1 : -1) * rnd(40, 90); }
      }
    }

    sp.poder -= dt;
    if (sp.poder <= 0) {
      sp.poder = rnd(3.5, 6);
      const r = Math.random();
      if (r < 0.62) cria("poder", "✨", { poder: "lucidez", tam: 36, mov: "onda" });
      else if (r < 0.84) cria("poder", "🐑", { poder: "lento", tam: 40 });
      else cria("poder", "🧸", { poder: "vida", tam: 40 });
    }
  }

  function particulas(x, y, cor, n, emoji) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rnd(60, 220);
      j.particulas.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: rnd(0.4, 0.9), max: 0.9, cor, r: rnd(2, 4.5), emoji });
    }
  }
  function textoFlutuante(x, y, t, cor) { j.textos.push({ x, y, t, cor, vida: 0.9 }); }

  function apanha(e) {
    const s = j.sonhador;
    if (e.tipo === "bom") {
      j.combo++;
      const mult = Math.min(5, 1 + Math.floor(j.combo / 5));
      j.comboMax = Math.max(j.comboMax, mult);
      const pts = e.pontos * mult;
      j.pontos += pts;
      j.estrelas++;
      j.lucidez = Math.min(100, j.lucidez + 3);
      textoFlutuante(e.x, e.y, "+" + pts, "#ffe08a");
      particulas(e.x, e.y, "#ffe08a", 10);
      Som.efeito(e.pontos >= 25 ? "lua" : "estrela", j.combo);
    } else if (e.tipo === "poder") {
      if (e.poder === "lucidez") {
        j.lucidez = Math.min(100, j.lucidez + 22);
        textoFlutuante(e.x, e.y, "+Lucidez", "#7fe7ff");
        particulas(e.x, e.y, "#7fe7ff", 14);
        Som.efeito("lucidez");
      } else if (e.poder === "lento") {
        j.lentoAte = j.tempo + DURACAO_LENTO;
        textoFlutuante(e.x, e.y, "1 ovelha... 2 ovelhas...", "#ffffff");
        particulas(e.x, e.y, "#ffffff", 16);
        Som.efeito("poder");
      } else if (e.poder === "vida") {
        if (j.vidas < VIDAS_MAX) { j.vidas++; textoFlutuante(e.x, e.y, "+1 💤", "#ff8fd1"); }
        else { j.pontos += 100; textoFlutuante(e.x, e.y, "+100", "#ff8fd1"); }
        particulas(e.x, e.y, "#ff8fd1", 16);
        Som.efeito("poder");
      }
    } else if (e.tipo === "mau") {
      if (j.lucidoAte > j.tempo) {
        // No sonho lúcido, os pesadelos transformam-se em pontos
        j.pontos += 30;
        j.estrelas++;
        textoFlutuante(e.x, e.y, "+30 ✨", "#ff8fd1");
        particulas(e.x, e.y, "#ff8fd1", 14, "⭐");
        Som.efeito("converte");
        return;
      }
      if (j.invulAte > j.tempo) return false;
      j.vidas--;
      j.combo = 0;
      j.invulAte = j.tempo + INVULNERAVEL;
      j.abanar = 0.35;
      s.cara = "😵";
      setTimeout(() => { if (j) j.sonhador.cara = "😴"; }, 700);
      particulas(s.x, s.y, "#ff4d6d", 18);
      Som.efeito("dano");
      const f = document.createElement("div"); f.className = "flash"; document.body.appendChild(f); setTimeout(() => f.remove(), 500);
      if (navigator.vibrate) navigator.vibrate(120);
      if (j.vidas <= 0) { termina(false); }
    }
    return true;
  }

  function atualiza(dt) {
    j.tempo += dt;
    const s = j.sonhador;
    const lucido = j.lucidoAte > j.tempo;

    // Mudança de mundo
    const m = mundoAtual();
    if (m !== j.mundo) {
      j.mundo = m;
      faixa(m === 0 ? "Noite " + j.noite : "Fase " + (m + 1), MUNDOS[m].nome);
    }
    if (j.tempo >= DURACAO_NOITE * 0.88 && !j.avisoAmanhecer) {
      j.avisoAmanhecer = true;
      faixa("Está quase a amanhecer", "Cuidado com os despertadores!");
    }
    if (j.tempo >= DURACAO_NOITE) { termina(true); return; }

    // Movimento do sonhador (segue o alvo com suavidade)
    const k = 1 - Math.pow(0.0008, dt);
    s.x = lerp(s.x, j.alvo.x, k);
    s.y = lerp(s.y, j.alvo.y, k);

    geraEntidades(dt);

    for (const e of j.entidades) {
      const fator = j.lentoAte > j.tempo ? 0.45 : 1;
      e.y += e.vy * fator * dt;
      if (e.mov === "onda") e.x += Math.sin(j.tempo * 2.4 + e.fase) * 70 * dt;
      if (e.mov === "ziguezague") e.x += Math.sign(Math.sin(j.tempo * 3 + e.fase)) * 120 * dt * fator;
      if (e.mov === "persegue" && e.y < s.y) e.x += Math.max(-55, Math.min(55, (s.x - e.x) * 1.2)) * dt * fator;
      if (e.mov === "diagonal") { e.x += e.vx * dt * fator; e.rot += dt * 2; }
      if (e.mov === "abana") e.rot = Math.sin(j.tempo * 30) * 0.25;
      e.x = Math.max(e.tam / 2, Math.min(W - e.tam / 2, e.x));

      // Íman no sonho lúcido
      if (lucido && e.tipo !== "mau") {
        const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy);
        if (d < 170) { e.x += dx / d * 260 * dt; e.y += dy / d * 260 * dt; }
      }

      // Colisão
      const raio = 26 + e.tam * 0.36;
      if (!e.morto && Math.hypot(e.x - s.x, e.y - s.y) < raio) {
        const res = apanha(e);
        if (res !== false) e.morto = true;
        if (modo !== "jogar") return;
      }
      if (e.y > H + 60) e.morto = true;
    }
    j.entidades = j.entidades.filter((e) => !e.morto);

    for (const p of j.particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.vida -= dt; }
    j.particulas = j.particulas.filter((p) => p.vida > 0);
    for (const t of j.textos) { t.y -= 50 * dt; t.vida -= dt; }
    j.textos = j.textos.filter((t) => t.vida > 0);

    // Zzz do sonhador
    j.spawn.zzz -= dt;
    if (j.spawn.zzz <= 0) {
      j.spawn.zzz = 0.5;
      j.particulas.push({ x: s.x + 16, y: s.y - 20, vx: rnd(10, 30), vy: -40, vida: 1.4, max: 1.4, cor: "#ffffff", r: 0, z: Math.random() < 0.5 ? "z" : "Z" });
    }
    if (j.abanar > 0) j.abanar -= dt;

    atualizaHud();
  }

  // =====================================================================
  // Desenho
  // =====================================================================
  function desenhaCeu() {
    let cores;
    if (!j) cores = MUNDOS[0].ceu;
    else {
      const frac = j.tempo / DURACAO_NOITE;
      const pos = frac * 4;
      const i = Math.min(3, Math.floor(pos));
      const prox = Math.min(3, i + 1);
      const t = Math.max(0, (pos - i - 0.85) / 0.15); // transição no fim de cada fase
      cores = MUNDOS[i].ceu.map((c, k) => misturaCor(c, MUNDOS[prox].ceu[k], i === prox ? 0 : t));
      if (frac > 0.8) {
        const a = (frac - 0.8) / 0.2;
        cores = cores.map((c, k) => { const m = c.match(/\d+/g).map(Number); const d = hexRgb(AMANHECER[k]); return "rgb(" + m.map((v, n) => Math.round(lerp(v, d[n], a))).join(",") + ")"; });
      }
    }
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, cores[0]);
    g.addColorStop(0.55, cores[1]);
    g.addColorStop(1, cores[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sonho lúcido: véu arco-íris
    if (j && j.lucidoAte > j.tempo) {
      const h = (tGlobal * 80) % 360;
      ctx.fillStyle = "hsla(" + h + ",90%,65%,.16)";
      ctx.fillRect(0, 0, W, H);
    }

    // Estrelas cintilantes
    const vel = j && modo === "jogar" ? velocidade() / 150 : 0.3;
    for (const e of estrelasFundo) {
      if (modo !== "pausa") e.y += e.v * vel * 0.0016;
      if (e.y > 1) e.y -= 1;
      const a = 0.35 + 0.35 * Math.sin(tGlobal * 2 + e.f);
      ctx.fillStyle = "rgba(255,255,255," + a + ")";
      ctx.beginPath(); ctx.arc(e.x * W, e.y * H, e.r, 0, Math.PI * 2); ctx.fill();
    }

    // Decoração do mundo (parallax suave)
    const mundo = MUNDOS[j ? Math.max(0, j.mundo) : 0];
    for (const d of decoFundo) {
      if (modo !== "pausa") d.y += d.v * vel / H * 0.016 * 60;
      if (d.y > 1.1) { d.y = -0.1; d.x = Math.random(); }
      desenhaEmoji(mundo.deco[d.i % mundo.deco.length], d.x * W, d.y * H, d.s, null, 0.22);
    }
  }

  function desenha() {
    ctx.save();
    if (j && j.abanar > 0) ctx.translate(rnd(-6, 6), rnd(-6, 6));
    desenhaCeu();

    if (j && modo !== "menu") {
      const lucido = j.lucidoAte > j.tempo;
      for (const e of j.entidades) {
        let brilho = e.tipo === "mau" ? "#ff2a5f" : e.tipo === "poder" ? "#7fe7ff" : "#ffd36b";
        let emoji = e.emoji;
        if (e.tipo === "mau" && lucido) { brilho = "#ff8fd1"; emoji = "⭐"; }
        const pulso = 1 + Math.sin(tGlobal * 5 + e.fase) * 0.06;
        desenhaEmoji(emoji, e.x, e.y, e.tam * pulso, brilho, 1, e.rot);
      }

      // Partículas
      for (const p of j.particulas) {
        const a = Math.max(0, p.vida / p.max);
        if (p.z) {
          ctx.globalAlpha = a * 0.8; ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif";
          ctx.fillText(p.z, p.x, p.y); ctx.globalAlpha = 1;
        } else if (p.emoji) {
          desenhaEmoji(p.emoji, p.x, p.y, 16, null, a);
        } else {
          ctx.globalAlpha = a; ctx.fillStyle = p.cor;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Sonhador
      const s = j.sonhador;
      const pisca = j.invulAte > j.tempo && Math.floor(tGlobal * 12) % 2 === 0;
      if (lucido) {
        const g = ctx.createRadialGradient(s.x, s.y, 10, s.x, s.y, 80);
        g.addColorStop(0, "hsla(" + ((tGlobal * 200) % 360) + ",100%,70%,.55)");
        g.addColorStop(1, "hsla(" + ((tGlobal * 200 + 120) % 360) + ",100%,70%,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, 80, 0, Math.PI * 2); ctx.fill();
      }
      // Almofada de nuvem
      desenhaEmoji("☁️", s.x, s.y + 22, 62, "rgba(255,255,255,.6)", 0.95);
      if (!pisca) desenhaEmoji(lucido ? "😎" : s.cara, s.x, s.y - 4 + Math.sin(tGlobal * 3) * 3, 50, lucido ? "#ffffff" : "rgba(180,200,255,.8)");

      // Textos flutuantes
      ctx.textAlign = "center";
      for (const t of j.textos) {
        ctx.globalAlpha = Math.min(1, t.vida * 1.5);
        ctx.font = "900 18px system-ui, sans-serif";
        ctx.lineWidth = 4; ctx.strokeStyle = "rgba(20,8,50,.7)";
        ctx.strokeText(t.t, t.x, t.y); ctx.fillStyle = t.cor; ctx.fillText(t.t, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    } else {
      // Menu: sonhador a flutuar
      desenhaEmoji("☁️", W / 2, H * 0.84 + 22, 70, "rgba(255,255,255,.6)");
      desenhaEmoji("😴", W / 2, H * 0.84 - 4 + Math.sin(tGlobal * 2) * 5, 56, "rgba(180,200,255,.8)");
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(tGlobal * 2);
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.fillText("z", W / 2 + 30, H * 0.84 - 40 - (tGlobal * 10) % 20);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // =====================================================================
  // HUD e ecrãs
  // =====================================================================
  function horaTexto(tempo) {
    const minutos = 23 * 60 + Math.floor(tempo / DURACAO_NOITE * 8 * 60);
    const h = Math.floor(minutos / 60) % 24, m = minutos % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  let hudCache = {};
  function hudSet(id, prop, valor) {
    if (hudCache[id + prop] === valor) return;
    hudCache[id + prop] = valor;
    if (prop === "text") $(id).textContent = valor; else $(id).style[prop] = valor;
  }
  function atualizaHud() {
    if (hudCache.vidas !== j.vidas) {
      hudCache.vidas = j.vidas;
      $("hVidas").innerHTML = Array.from({ length: VIDAS_MAX }, (_, i) => '<span style="opacity:' + (i < j.vidas ? 1 : 0.2) + '">💤</span>').join("");
    }
    hudSet("hRelogio", "text", (j.lentoAte > j.tempo ? "🐑 " : "") + horaTexto(j.tempo));
    hudSet("hPontos", "text", String(j.pontos));
    hudSet("hLucidez", "width", (j.lucidoAte > j.tempo ? (j.lucidoAte - j.tempo) / DURACAO_LUCIDO * 100 : j.lucidez) + "%");
    const mult = Math.min(5, 1 + Math.floor(j.combo / 5));
    hudSet("hCombo", "text", mult > 1 ? "x" + mult : "");
    const pronto = j.lucidez >= 100 && !(j.lucidoAte > j.tempo);
    $("hLucidezCaixa").classList.toggle("cheia", pronto);
    $("btnLucido").classList.toggle("escondido", !pronto || modo !== "jogar");
  }

  function faixa(pequeno, grande) {
    document.querySelectorAll(".faixa").forEach((f) => f.remove());
    const f = document.createElement("div");
    f.className = "faixa";
    f.innerHTML = "<small></small><b></b>";
    f.querySelector("small").textContent = pequeno;
    f.querySelector("b").textContent = grande;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 2500);
  }

  function mostra(id) {
    ["menu", "ajuda", "pausa", "fim"].forEach((e) => $(e).classList.toggle("escondido", e !== id));
    $("hud").classList.toggle("escondido", !(id === null || id === "pausa"));
    $("btnSom").classList.toggle("escondido", !(id === "menu" || id === "pausa"));
    if (id !== null) $("btnLucido").classList.add("escondido");
  }

  function atualizaMenu() {
    $("mRecorde").textContent = guardado.recorde;
    $("mNoite").textContent = guardado.melhorNoite;
    $("btnJogar").textContent = guardado.noite > 1 ? "Jogar: Noite " + guardado.noite : "Jogar";
    $("btnSom").textContent = guardado.som ? "🔊" : "🔇";
  }

  function comecar() {
    Som.comecar();
    redimensiona();
    novaPartida(guardado.noite);
    hudCache = {};
    modo = "jogar";
    mostra(null);
    atualizaHud();
  }

  function pausar() {
    if (modo !== "jogar") return;
    modo = "pausa";
    mostra("pausa");
  }
  function continuar() {
    if (modo !== "pausa") return;
    modo = "jogar";
    Som.retoma();
    mostra(null);
    ultimoFrame = performance.now();
  }
  function irMenu() {
    modo = "menu";
    j = null;
    document.querySelectorAll(".faixa").forEach((f) => f.remove());
    atualizaMenu();
    mostra("menu");
  }

  const FRASES_VITORIA = [
    "Dormiste que nem um anjo. O teu sonhador acorda cheio de energia!",
    "Que sonho incrível! Até o despertador ficou com inveja.",
    "Oito horas de sono de qualidade. Os médicos aprovam.",
    "Acordaste com o cabelo num estado lendário, mas muito descansado(a)."
  ];
  const FRASES_DERROTA = [
    "Um pesadelo assustou o sonhador. Hoje vai precisar de muito café.",
    "Acordaste sobressaltado(a). Respira fundo e volta a tentar.",
    "Os pesadelos ganharam esta ronda. Mas a noite volta sempre!",
    "O sonhador caiu da cama. Literalmente."
  ];

  function termina(venceu) {
    if (modo !== "jogar") return;
    modo = "fim";
    const recordeAntes = guardado.recorde;
    if (venceu) {
      j.pontos += j.vidas * 150; // bónus de sono
      guardado.noite = j.noite + 1;
      guardado.melhorNoite = Math.max(guardado.melhorNoite, j.noite + 1);
      Som.efeito("vitoria");
    } else {
      Som.efeito("derrota");
    }
    const novoRecorde = j.pontos > recordeAntes;
    if (novoRecorde) guardado.recorde = j.pontos;
    grava();
    $("fIcone").textContent = venceu ? "☀️" : "😱";
    $("fTitulo").textContent = venceu ? "Acordaste descansado(a)!" : "Acordaste com um pesadelo!";
    $("fHora").textContent = venceu ? "Noite " + j.noite + " concluída às 07:00 · bónus de sono +" + j.vidas * 150
      : "Noite " + j.noite + " · acordaste às " + horaTexto(j.tempo);
    $("fRecorde").classList.toggle("escondido", !novoRecorde);
    $("fPontos").textContent = j.pontos;
    $("fMelhor").textContent = guardado.recorde;
    $("fEstrelas").textContent = j.estrelas;
    $("fCombo").textContent = "x" + j.comboMax;
    $("fFrase").textContent = escolhe(venceu ? FRASES_VITORIA : FRASES_DERROTA);
    $("btnFimPrincipal").textContent = venceu ? "Noite " + (j.noite + 1) + " →" : "Tentar outra vez";
    setTimeout(() => mostra("fim"), venceu ? 300 : 600);
  }

  // =====================================================================
  // Controlo por toque (arrasto relativo, o dedo não tapa o sonhador)
  // =====================================================================
  let toque = null;
  tela.addEventListener("pointerdown", (ev) => {
    if (modo !== "jogar") return;
    toque = { id: ev.pointerId, dx: j.alvo.x - ev.clientX, dy: j.alvo.y - ev.clientY };
  });
  window.addEventListener("pointermove", (ev) => {
    if (!toque || ev.pointerId !== toque.id || modo !== "jogar") return;
    j.alvo.x = Math.max(28, Math.min(W - 28, ev.clientX + toque.dx));
    j.alvo.y = Math.max(LIMITE_CIMA(), Math.min(H - 50, ev.clientY + toque.dy));
  });
  window.addEventListener("pointerup", (ev) => { if (toque && ev.pointerId === toque.id) toque = null; });
  window.addEventListener("pointercancel", () => { toque = null; });

  // Teclado (para testar no computador)
  const teclas = {};
  window.addEventListener("keydown", (ev) => { teclas[ev.key] = true; if (ev.key === " " && modo === "jogar") ativaLucido(); if (ev.key === "Escape") window.handleBack(); });
  window.addEventListener("keyup", (ev) => { teclas[ev.key] = false; });
  function teclado(dt) {
    const v = 420 * dt;
    if (teclas.ArrowLeft || teclas.a) j.alvo.x -= v;
    if (teclas.ArrowRight || teclas.d) j.alvo.x += v;
    if (teclas.ArrowUp || teclas.w) j.alvo.y -= v;
    if (teclas.ArrowDown || teclas.s) j.alvo.y += v;
    j.alvo.x = Math.max(28, Math.min(W - 28, j.alvo.x));
    j.alvo.y = Math.max(LIMITE_CIMA(), Math.min(H - 50, j.alvo.y));
  }

  function ativaLucido() {
    if (modo !== "jogar" || j.lucidez < 100 || j.lucidoAte > j.tempo) return;
    j.lucidez = 0;
    j.lucidoAte = j.tempo + DURACAO_LUCIDO;
    faixa("Agora controlas tu", "Sonho Lúcido!");
    Som.efeito("lucido");
    particulas(j.sonhador.x, j.sonhador.y, "#ff8fd1", 30, "✨");
    atualizaHud();
  }

  // =====================================================================
  // Ciclo principal
  // =====================================================================
  function ciclo(agora) {
    const dt = Math.min(1 / 30, (agora - ultimoFrame) / 1000 || 0);
    ultimoFrame = agora;
    if (modo !== "pausa") tGlobal += dt;
    if (modo === "jogar") { teclado(dt); atualiza(dt); }
    else if (modo === "fim" && j) {
      for (const p of j.particulas) { p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= dt; }
      j.particulas = j.particulas.filter((p) => p.vida > 0);
    }
    desenha();
    requestAnimationFrame(ciclo);
  }

  // =====================================================================
  // Botões
  // =====================================================================
  $("btnJogar").addEventListener("click", comecar);
  $("btnAjuda").addEventListener("click", () => mostra("ajuda"));
  $("btnAjudaOk").addEventListener("click", () => mostra("menu"));
  $("btnPausa").addEventListener("click", pausar);
  $("btnContinuar").addEventListener("click", continuar);
  $("btnSair").addEventListener("click", irMenu);
  $("btnLucido").addEventListener("click", ativaLucido);
  $("btnFimPrincipal").addEventListener("click", comecar);
  $("btnFimMenu").addEventListener("click", irMenu);
  $("btnSom").addEventListener("click", () => {
    guardado.som = !guardado.som; grava();
    Som.comecar(); Som.ligado(guardado.som);
    atualizaMenu();
  });
  document.addEventListener("pointerdown", () => { if (guardado.som) Som.comecar(); }, { once: true });

  // Integração com o Android
  window.handleBack = function () {
    if (modo === "jogar") { pausar(); return true; }
    if (modo === "pausa") { continuar(); return true; }
    if (modo === "fim" || !$("ajuda").classList.contains("escondido")) { irMenu(); return true; }
    return false;
  };
  window.appPausa = function () { pausar(); Som.pausa(); };
  window.appRetoma = function () { if (modo !== "pausa") Som.retoma(); };
  document.addEventListener("visibilitychange", () => { if (document.hidden) pausar(); });

  // Só para testes automáticos
  window.__sonhos = { estado: () => j, modo: () => modo, termina, avanca: (s) => { if (j) j.tempo += s; } };

  redimensiona();
  atualizaMenu();
  mostra("menu");
  requestAnimationFrame((t) => { ultimoFrame = t; ciclo(t); });
})();
