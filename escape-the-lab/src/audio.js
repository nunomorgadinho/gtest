// Som do jogo: tudo sintetizado em tempo real com Web Audio (sem ficheiros de som).
// Som 3D (HRTF), reverberação de betão e oclusão simples: sons noutra sala ouvem-se abafados.

let ctx = null, master = null, revIn = null, muted = false, meter = null, outNode = null;
let white = null, brown = null;
let roomOf = () => null, listenerRoom = null, active = false, power = false;
const loops = [];
let tanks = [], lights = [];
let world = { alarm: [], spots: [] }, collecting = null, secLoops = [];

// ---------- Infraestrutura ----------
function noiseBuf(sec, kind) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function impulse(sec, decay) {
  const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
  }
  return b;
}
function setPos(p, x, y, z) {
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
}
function panner(x, y, z, ref) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = ref || 1.5; p.rolloffFactor = 1.4; p.maxDistance = 60;
  setPos(p, x, y, z);
  return p;
}
// Devolve o nó de entrada de uma cadeia: [posição 3D] -> mistura seca + reverberação
function out(pos, rev, ref) {
  const inp = ctx.createGain(), send = ctx.createGain();
  send.gain.value = rev == null ? 0.4 : rev;
  if (pos) {
    const muffled = listenerRoom !== null && roomOf(pos[0], pos[2]) !== listenerRoom;
    const occl = ctx.createBiquadFilter(); occl.type = 'lowpass'; occl.frequency.value = muffled ? 650 : 20000;
    const pn = panner(pos[0], pos[1], pos[2], ref);
    if (muffled) { inp.gain.value = 0.55; send.gain.value *= 0.6; }
    inp.connect(occl); occl.connect(pn); pn.connect(master); pn.connect(send);
  } else inp.connect(master), inp.connect(send);
  send.connect(revIn);
  return inp;
}
function env(g, t0, dur, vol, attack) {
  const a = attack || 0.004;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}
function osc(dest, type, f, t0, dur, vol, o) {
  o = o || {};
  const s = ctx.createOscillator(), g = ctx.createGain();
  s.type = type; s.frequency.setValueAtTime(f, t0);
  if (o.slide) s.frequency.exponentialRampToValueAtTime(o.slide, t0 + (o.slideT || dur));
  if (o.detune) s.detune.value = o.detune;
  env(g, t0, dur, vol, o.attack);
  let node = s;
  if (o.filter) { const fl = ctx.createBiquadFilter(); fl.type = o.filter; fl.frequency.value = o.f; fl.Q.value = o.q || 0.7; s.connect(fl); node = fl; }
  node.connect(g); g.connect(dest);
  s.start(t0); s.stop(t0 + dur + 0.05);
  return s;
}
function nz(dest, t0, dur, vol, type, f, o) {
  o = o || {};
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = o.brown ? brown : white;
  fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = o.q || 0.7;
  if (o.fEnd) fl.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + dur);
  env(g, t0, dur, vol, o.attack);
  s.connect(fl); fl.connect(g); g.connect(dest);
  const off = Math.random() * (s.buffer.duration - dur - 0.1);
  s.start(t0, Math.max(0, off), dur + 0.05);
}
// Rangido metálico: dente de serra com vibrato através de um filtro estreito
function creak(dest, t0, dur, f, vol) {
  const s = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t0); s.frequency.linearRampToValueAtTime(f * (0.7 + Math.random() * 0.6), t0 + dur);
  lfo.frequency.value = 9 + Math.random() * 14; lg.gain.value = f * 0.06; lfo.connect(lg); lg.connect(s.frequency);
  bp.type = 'bandpass'; bp.frequency.value = f * 5; bp.Q.value = 7;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bp); bp.connect(g); g.connect(dest);
  s.start(t0); lfo.start(t0); s.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
}
function thump(dest, t0, f, vol, dur) {
  osc(dest, 'sine', f, t0, dur || 0.25, vol, { slide: f * 0.5 });
  nz(dest, t0, (dur || 0.25) * 0.6, vol * 0.7, 'lowpass', 300);
}

// ---------- Ambiente em ciclo ----------
function loopAt(pos, room, ref, build, base) {
  const g = ctx.createGain(), occl = ctx.createBiquadFilter(), send = ctx.createGain();
  g.gain.value = 0; occl.type = 'lowpass'; occl.frequency.value = 20000; send.gain.value = 0.35;
  const prev = collecting; collecting = [];
  build(g);
  const sources = collecting; collecting = prev;
  if (pos) { const pn = panner(pos[0], pos[1], pos[2], ref); g.connect(occl); occl.connect(pn); pn.connect(master); pn.connect(send); }
  else { g.connect(occl); occl.connect(master); occl.connect(send); }
  send.connect(revIn);
  const l = { g, occl, room, base, level: 1, sources };
  loops.push(l);
  return l;
}
function noiseLoop(dest, buf, type, f, q) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter();
  s.buffer = buf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
  s.connect(fl); fl.connect(dest); s.start();
  if (collecting) collecting.push(s);
  return fl;
}
function oscLoop(dest, type, f, vol, filter) {
  const s = ctx.createOscillator(), g = ctx.createGain();
  s.type = type; s.frequency.value = f; g.gain.value = vol;
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filter; s.connect(fl); fl.connect(g); } else s.connect(g);
  g.connect(dest); s.start();
  if (collecting) collecting.push(s);
  return s;
}
let serverLoop = null;
// Ambiente comum a todo o laboratório
function startGlobal() {
  loopAt(null, null, 1, (d) => {
    oscLoop(d, 'sawtooth', 55, 0.5, 140); oscLoop(d, 'sawtooth', 55.35, 0.5, 140); oscLoop(d, 'sine', 110, 0.15);
  }, 0.05);
  loopAt(null, null, 1, (d) => {
    const fl = noiseLoop(d, brown, 'bandpass', 380, 0.6);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 120; lfo.connect(lg); lg.connect(fl.frequency); lfo.start();
  }, 0.09);
}
// Fontes de som de um setor (substituídas ao mudar de setor)
function startSector(w) {
  for (const l of secLoops) {
    l.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    const src = l.sources; setTimeout(() => { src.forEach((x) => { try { x.stop(); } catch (e) { /* já parado */ } }); l.g.disconnect(); }, 600);
    loops.splice(loops.indexOf(l), 1);
  }
  secLoops = []; tanks = []; lights = []; serverLoop = null; world = w;
  const add = (l) => { secLoops.push(l); return l; };
  // servidores: zumbido, ventoinhas e um apito agudo
  if (w.server) serverLoop = add(loopAt(w.server, w.serverRoom || 's', 2.5, (d) => {
    oscLoop(d, 'square', 120, 0.25, 320); noiseLoop(d, white, 'bandpass', 1300, 0.8); oscLoop(d, 'sine', 6800, 0.012);
  }, 0.07));
  // lâmpadas fluorescentes a zumbir
  (w.lights || []).forEach(([x, z, room, emerg]) => {
    const l = add(loopAt([x, 2.7, z], room, 1.2, (d) => { oscLoop(d, 'sawtooth', 100, 0.3, 600); oscLoop(d, 'sine', 200, 0.2); }, 0.018));
    l.emerg = emerg; lights.push(l);
  });
  // tanques: zumbido baixo das bombas (as bolhas são agendadas em tick)
  (w.tanks || []).forEach(([x, z, room]) => {
    add(loopAt([x, 1, z], room, 1.2, (d) => { oscLoop(d, 'triangle', 72 + Math.random() * 8, 0.4, 300); noiseLoop(d, brown, 'lowpass', 500); }, 0.05));
    tanks.push({ x, z, room, t: Math.random() * 0.5 });
  });
  // fugas de vapor
  (w.steam || []).forEach(([x, z, room]) => {
    add(loopAt([x, 2.4, z], room, 1.5, (d) => { noiseLoop(d, white, 'highpass', 2500); }, 0.04));
  });
  // reator do núcleo
  if (w.core) add(loopAt(w.core, 'n', 4, (d) => {
    oscLoop(d, 'sawtooth', 41, 0.6, 160); oscLoop(d, 'sine', 82.5, 0.3); noiseLoop(d, brown, 'lowpass', 220);
  }, 0.14));
}

// ---------- API ----------
export const snd = {
  init(roomFn, w, isMuted) {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    w = w || world;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    roomOf = roomFn; muted = isMuted;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination); outNode = comp;
    meter = ctx.createAnalyser(); meter.fftSize = 2048; comp.connect(meter);
    const conv = ctx.createConvolver(); conv.buffer = impulse(2.6, 3.2);
    const rg = ctx.createGain(); rg.gain.value = 0.45; conv.connect(rg); rg.connect(master); revIn = conv;
    white = noiseBuf(2, 'white'); brown = noiseBuf(4, 'brown');
    startGlobal();
    startSector(w);
  },
  get muted() { return muted; },
  // nível RMS atual da saída (usado nos testes automáticos)
  level() {
    if (!meter) return 0;
    const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
    let s = 0; for (const v of d) s += v * v; return Math.sqrt(s / d.length);
  },
  get state() { return ctx ? ctx.state : 'none'; },
  // fluxo com a saída do jogo (para gravar demonstrações)
  tap() { const d = ctx.createMediaStreamDestination(); outNode.connect(d); return d.stream; },
  setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
  setPower(p) { power = p; },
  // troca as fontes de som do setor atual
  setWorld(w) { if (ctx) startSector(w); else world = w; },

  // posição e orientação de quem ouve (a câmara)
  listener(px, py, pz, fx, fy, fz) {
    if (!ctx) return;
    const L = ctx.listener;
    if (L.positionX) {
      L.positionX.value = px; L.positionY.value = py; L.positionZ.value = pz;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(px, py, pz); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    listenerRoom = roomOf(px, pz);
  },

  // chamado em cada fotograma: níveis dos ciclos, bolhas, alarme e sons aleatórios
  tick(dt, playing) {
    if (!ctx) return;
    active = playing;
    const now = ctx.currentTime;
    for (const l of loops) {
      const muffled = l.room && listenerRoom !== null && l.room !== listenerRoom;
      let lvl = playing ? l.base * l.level : l.base * 0.25;
      if (muffled) lvl *= 0.45;
      l.g.gain.setTargetAtTime(lvl, now, 0.25);
      l.occl.frequency.setTargetAtTime(muffled ? 600 : 18000, now, 0.15);
    }
    if (serverLoop) serverLoop.level = power ? 1.4 : 0.5;
    lights.forEach((l) => { l.level = power || !l.emerg ? 1 : 0; });
    if (!playing) return;
    for (const tk of tanks) {
      tk.t -= dt;
      if (tk.t <= 0) { tk.t = 0.08 + Math.random() * 0.5; this.bubble(tk.x, tk.z); }
    }
    this._alarm = (this._alarm || 0) - dt;
    if (!power && world.alarm && world.alarm.length && this._alarm <= 0) { this._alarm = 4.5; this.alarm(); }
    this._amb = (this._amb == null ? 6 : this._amb) - dt;
    if (this._amb <= 0) { this._amb = (7 + Math.random() * 12) / (world.creepy || 1); this.randomAmbience(); }
    if (this._klaxon != null) { this._klaxon -= dt; if (this._klaxon <= 0) { this._klaxon = 1.6; this.klaxon(); } }
  },

  // ----- efeitos -----
  step() {
    if (!ctx || !active) return;
    const t = ctx.currentTime, d = out(null, 0.25), v = 0.85 + Math.random() * 0.3;
    nz(d, t, 0.09, 0.22 * v, 'lowpass', 700 + Math.random() * 600);
    osc(d, 'sine', 85 + Math.random() * 20, t, 0.09, 0.22 * v, { slide: 45 });
    nz(d, t + 0.01, 0.05, 0.04 * v, 'highpass', 3500);
  },
  bubble(x, z) {
    const t = ctx.currentTime, d = out([x, 1, z], 0.3, 0.8), f = 250 + Math.random() * 600;
    osc(d, 'sine', f, t, 0.05 + Math.random() * 0.07, 0.05, { slide: f * (1.6 + Math.random()) });
  },
  alarm() {
    const t = ctx.currentTime;
    world.alarm.forEach(([x, z], i) => {
      const dl = i * 0.2, d = out([x, 2.6, z], 0.5, 3);
      osc(d, 'square', 660, t + dl, 0.42, 0.025, { filter: 'lowpass', f: 1600, attack: 0.02 });
      osc(d, 'square', 520, t + dl + 0.5, 0.42, 0.025, { filter: 'lowpass', f: 1600, attack: 0.02 });
    });
  },
  randomAmbience() {
    const spots = world.spots && world.spots.length ? world.spots : [[0, 0]];
    const [x, z] = spots[Math.floor(Math.random() * spots.length)];
    const t = ctx.currentTime, k = Math.random();
    if (k < 0.35) { // gota de água
      const d = out([x, 2.5, z], 1.2, 1.5), f = 1400 + Math.random() * 900;
      osc(d, 'sine', f, t, 0.14, 0.08, { slide: f * 0.55 });
      if (Math.random() < 0.6) osc(d, 'sine', f * 1.1, t + 0.5 + Math.random(), 0.12, 0.05, { slide: f * 0.6 });
    } else if (k < 0.7) { // estrutura metálica a ranger
      creak(out([x, 2.5, z], 1.0, 2), t, 1.4 + Math.random() * 1.6, 70 + Math.random() * 90, 0.12);
    } else if (k < 0.85) { // pancada distante
      thump(out([x, 1, z], 1.2, 3), t, 55, 0.35, 0.6);
    } else { // metal a vibrar
      const d = out([x, 2, z], 1.0, 2), f = 380 + Math.random() * 300;
      [1, 2.76, 5.4].forEach((m, i) => osc(d, 'sine', f * m, t, 1.8 - i * 0.4, 0.03 / (i + 1)));
    }
  },
  door(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 1.5, z], 0.5, 2.5);
    nz(d, t, 0.6, 0.22, 'bandpass', 3200, { fEnd: 1100, q: 0.8 });
    osc(d, 'sawtooth', 58, t + 0.1, 1.2, 0.1, { slide: 96, filter: 'lowpass', f: 420, attack: 0.08 });
    nz(d, t + 0.1, 1.2, 0.08, 'bandpass', 900, { q: 2, attack: 0.1 });
    thump(d, t + 1.25, 75, 0.45, 0.3);
  },
  reader(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 1.3, z], 0.3);
    osc(d, 'square', 1300, t, 0.07, 0.05); osc(d, 'square', 1950, t + 0.09, 0.12, 0.05);
  },
  deny(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(x == null ? null : [x, 1.3, z], 0.3);
    osc(d, 'square', 150, t, 0.38, 0.09, { filter: 'lowpass', f: 1400 });
    osc(d, 'square', 153, t, 0.38, 0.07, { filter: 'lowpass', f: 1400 });
  },
  pick() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.5);
    osc(d, 'sine', 2400, t, 0.25, 0.06); osc(d, 'sine', 3310, t, 0.18, 0.03);
    osc(d, 'triangle', 880, t + 0.06, 0.4, 0.07); osc(d, 'triangle', 1320, t + 0.14, 0.5, 0.06);
  },
  key(k) {
    if (!ctx) return;
    const rows = [697, 770, 852, 941], cols = [1209, 1336, 1477];
    const map = { 1: [0, 0], 2: [0, 1], 3: [0, 2], 4: [1, 0], 5: [1, 1], 6: [1, 2], 7: [2, 0], 8: [2, 1], 9: [2, 2], 0: [3, 1], C: [3, 0], OK: [3, 2] };
    const [r, c] = map[k] || [3, 0], t = ctx.currentTime, d = out(null, 0.15);
    osc(d, 'sine', rows[r], t, 0.13, 0.05); osc(d, 'sine', cols[c], t, 0.13, 0.05);
  },
  safe(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 0.5, z], 0.5);
    [523, 659, 784].forEach((f, i) => osc(d, 'triangle', f, t + i * 0.08, 0.25, 0.06));
    [0.35, 0.45, 0.55].forEach((dl) => { nz(d, t + dl, 0.04, 0.25, 'highpass', 2500); thump(d, t + dl, 160, 0.15, 0.08); });
    creak(d, t + 0.7, 1.1, 110, 0.12);
  },
  breaker(x, z, on) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 1.5, z], 0.4);
    nz(d, t, 0.03, 0.35, 'highpass', 2200);
    thump(d, t + 0.01, on ? 130 : 100, 0.35, 0.15);
    if (on) for (let i = 0; i < 4; i++) nz(d, t + 0.03 + Math.random() * 0.15, 0.015, 0.12, 'highpass', 5000);
  },
  powerOn() {
    if (!ctx) return;
    power = true;
    const t = ctx.currentTime, d = out(null, 0.6);
    osc(d, 'sawtooth', 40, t, 2.4, 0.12, { slide: 320, slideT: 2.2, filter: 'lowpass', f: 900, attack: 0.3 });
    nz(d, t, 2.2, 0.08, 'bandpass', 400, { fEnd: 3000, attack: 0.5 });
    [2.2, 2.45, 2.7, 2.95].forEach((dl, i) => thump(d, t + dl, 90 - i * 8, 0.35, 0.3));
    osc(d, 'sine', 523, t + 3.1, 1.2, 0.05, { attack: 0.1 }); osc(d, 'sine', 784, t + 3.2, 1.2, 0.04, { attack: 0.1 });
  },
  locker(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 1, z], 0.5);
    osc(d, 'square', 1500, t, 0.08, 0.04);
    nz(d, t + 0.1, 0.05, 0.3, 'highpass', 1800); thump(d, t + 0.1, 140, 0.2, 0.1);
    creak(d, t + 0.2, 0.9, 160, 0.1);
    nz(d, t + 0.25, 0.4, 0.08, 'bandpass', 2200, { q: 4 });
  },
  note() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.2);
    for (let i = 0; i < 4; i++) nz(d, t + i * 0.07 + Math.random() * 0.03, 0.08, 0.1, 'bandpass', 3000 + Math.random() * 2000, { q: 0.8 });
  },
  elevator(dur) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.3); dur = dur || 3;
    thump(d, t, 70, 0.4, 0.4);
    osc(d, 'sawtooth', 48, t + 0.2, dur, 0.09, { filter: 'lowpass', f: 260, attack: 0.5 });
    nz(d, t + 0.2, dur, 0.1, 'bandpass', 600, { q: 0.6, attack: 0.6 });
    for (let k = 0.6; k < dur; k += 0.45 + Math.random() * 0.5) nz(d, t + k, 0.05, 0.08, 'bandpass', 1500 + Math.random() * 1500, { q: 3 });
    thump(d, t + dur + 0.2, 60, 0.5, 0.5);
    osc(d, 'sine', 880, t + dur + 0.5, 0.6, 0.05); osc(d, 'sine', 660, t + dur + 0.75, 0.8, 0.05);
  },
  simon(i, wrong) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.25);
    if (wrong) { osc(d, 'square', 110, t, 0.6, 0.1, { filter: 'lowpass', f: 900 }); return; }
    osc(d, 'triangle', [330, 415, 494, 622][i], t, 0.35, 0.12);
  },
  valve(x, z) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out([x, 1.2, z], 0.5);
    creak(d, t, 0.6, 140 + Math.random() * 40, 0.12);
    nz(d, t + 0.1, 0.9, 0.12, 'highpass', 2000, { fEnd: 4000, attack: 0.2 });
    thump(d, t + 0.55, 110, 0.2, 0.12);
  },
  flow() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.6);
    nz(d, t, 3, 0.2, 'lowpass', 500, { brown: true, attack: 0.6 });
    for (let k = 0; k < 14; k++) osc(d, 'sine', 200 + Math.random() * 500, t + Math.random() * 2.5, 0.08, 0.04, { slide: 700 });
    thump(d, t + 2.6, 60, 0.45, 0.5);
  },
  uv(on) {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.1);
    nz(d, t, 0.03, 0.2, 'highpass', 3000); if (on) osc(d, 'sine', 9000, t + 0.02, 0.4, 0.01, { attack: 0.1 });
  },
  sting() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 1.2);
    thump(d, t, 45, 0.6, 1.2);
    [1, 1.06, 1.5].forEach((m) => osc(d, 'sawtooth', 110 * m, t, 2.5, 0.04, { filter: 'lowpass', f: 900, attack: 0.05 }));
    nz(d, t, 1.8, 0.1, 'bandpass', 3000, { fEnd: 300, q: 2 });
  },
  radio() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.6);
    nz(d, t, 0.5, 0.15, 'bandpass', 1800, { q: 1.5 });
    osc(d, 'sine', 1000, t + 0.45, 0.15, 0.05);
  },
  klaxonOn(on) { this._klaxon = on ? 0 : null; },
  klaxon() {
    const t = ctx.currentTime, d = out(null, 0.5);
    osc(d, 'sawtooth', 300, t, 0.9, 0.06, { slide: 520, slideT: 0.8, filter: 'lowpass', f: 1800, attack: 0.05 });
  },
  win() {
    if (!ctx) return;
    const t = ctx.currentTime, d = out(null, 0.8);
    nz(d, t, 4, 0.18, 'lowpass', 500, { brown: true, attack: 1.2 });
    [261.6, 329.6, 392, 587.3].forEach((f, i) => osc(d, 'triangle', f, t + 0.3 + i * 0.15, 3.2, 0.05, { attack: 0.6 }));
  }
};
