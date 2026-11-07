/*
 * Música e efeitos sonoros gerados em tempo real com a Web Audio API.
 * Loop original estilo chiptune (Dó maior, I-V-vi-IV, 126 BPM), sem ficheiros de áudio.
 */
(function () {
  "use strict";

  const BPM = 126;
  const PASSO = 60 / BPM / 2; // colcheia
  const PASSOS_POR_COMPASSO = 8;

  // Acordes: Dó, Sol, Lá menor, Fá
  const BAIXO = [36, 43, 45, 41];
  const ACORDES = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]];

  // Duas melodias de 4 compassos (null = pausa)
  const MELODIA_A = [
    [76, 79, 84, 79, 76, 79, 81, 79],
    [74, 79, 83, 79, 74, 79, 81, 83],
    [84, 83, 81, 76, 81, 83, 84, 88],
    [81, 84, 81, 77, 79, 81, 79, null]
  ];
  const MELODIA_B = [
    [84, null, 84, 83, 84, null, 79, null],
    [83, null, 83, 81, 83, null, 79, null],
    [81, null, 84, 88, 86, 84, 83, 81],
    [77, 79, 81, 84, 83, null, 79, null]
  ];

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function criaRuido(ctx) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function nota(ctx, dest, m, t, dur, tipo, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq(m), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function bombo(ctx, dest, t) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.18);
  }

  function ruido(ctx, dest, buf, t, dur, vol, filtroFreq, filtroTipo) {
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filtroTipo;
    f.frequency.value = filtroFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  /** Agenda tudo o que toca num passo (colcheia) da música. */
  function agendaPasso(ctx, dest, buf, passo, t) {
    const compasso = Math.floor(passo / PASSOS_POR_COMPASSO) % 4;
    const p = passo % PASSOS_POR_COMPASSO;
    const frase = Math.floor(passo / (PASSOS_POR_COMPASSO * 4)) % 4; // 0..3
    const introducao = passo < PASSOS_POR_COMPASSO * 4; // primeira volta mais leve

    // Bateria
    if (p % 2 === 0) bombo(ctx, dest, t);
    if (!introducao && (p === 2 || p === 6)) ruido(ctx, dest, buf, t, 0.13, 0.32, 1800, "bandpass");
    if (p % 2 === 1) ruido(ctx, dest, buf, t, 0.04, 0.1, 7000, "highpass");

    // Baixo saltitante (oitavas)
    nota(ctx, dest, BAIXO[compasso] + (p % 2 ? 12 : 0), t, PASSO * 0.85, "square", 0.11);

    // Acordes nos contratempos
    if (p % 2 === 1) {
      ACORDES[compasso].forEach((m) => nota(ctx, dest, m, t, PASSO * 0.6, "triangle", 0.07));
    }

    // Melodia: A, A, B, A
    if (!introducao) {
      const mel = frase === 2 ? MELODIA_B : MELODIA_A;
      const m = mel[compasso][p];
      if (m) nota(ctx, dest, m, t, PASSO * 0.8, "square", 0.06);
    }
  }

  // ---------- Leitor ----------
  let ctx = null;
  let musicaBus = null;
  let sfxBus = null;
  let ruidoBuf = null;
  let ligado = true;
  let aTocar = false;
  let proximo = 0;
  let passo = 0;
  let pausadoPelaApp = false;

  try {
    ligado = localStorage.getItem("som") !== "off";
  } catch (e) { /* sem storage, fica ligado */ }

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicaBus = ctx.createGain();
    musicaBus.gain.value = 0.55;
    musicaBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    ruidoBuf = criaRuido(ctx);
    setInterval(agendador, 25);
    return true;
  }

  function agendador() {
    if (!aTocar || ctx.state !== "running") return;
    if (proximo < ctx.currentTime) proximo = ctx.currentTime + 0.05; // recupera após pausa
    while (proximo < ctx.currentTime + 0.15) {
      agendaPasso(ctx, musicaBus, ruidoBuf, passo, proximo);
      proximo += PASSO;
      passo++;
    }
  }

  function tocar() {
    if (!ligado || !init()) return;
    if (!aTocar) {
      aTocar = true;
      passo = 0;
      proximo = ctx.currentTime + 0.05;
    }
    if (!pausadoPelaApp && ctx.state !== "running") ctx.resume();
  }

  function alterna() {
    ligado = !ligado;
    try { localStorage.setItem("som", ligado ? "on" : "off"); } catch (e) { /* ignora */ }
    if (ligado) {
      tocar();
    } else if (ctx) {
      ctx.suspend();
    }
    return ligado;
  }

  function efeito(nome) {
    if (!ligado || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.01;
    if (nome === "clique") {
      nota(ctx, sfxBus, 84, t, 0.08, "square", 0.12);
      nota(ctx, sfxBus, 91, t + 0.05, 0.1, "square", 0.1);
    } else if (nome === "fanfarra") {
      [72, 76, 79, 84].forEach((m, i) => nota(ctx, sfxBus, m, t + i * 0.1, 0.18, "square", 0.12));
      [84, 88, 91].forEach((m) => nota(ctx, sfxBus, m, t + 0.45, 0.6, "triangle", 0.12));
    }
  }

  window.Musica = {
    tocar: tocar,
    alterna: alterna,
    efeito: efeito,
    ligado: () => ligado,
    // Chamados pelo Android quando a app vai para segundo plano / volta
    pausa: () => { pausadoPelaApp = true; if (ctx) ctx.suspend(); },
    retoma: () => { pausadoPelaApp = false; if (ctx && ligado && aTocar) ctx.resume(); },
    // Usado só para gerar uma pré-visualização offline
    _agendaPasso: agendaPasso,
    _criaRuido: criaRuido,
    _PASSO: PASSO
  };
})();
