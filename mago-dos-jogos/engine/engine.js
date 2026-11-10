/* Mago dos Jogos — motor dos jogos gerados.
   Um só ficheiro, sem dependências: corre dentro da app e dentro de cada APK exportado.
   MDJ.run(canvas, config, opções) arranca um jogo; MDJ.thumb(canvas, config) desenha uma miniatura. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sem armazenamento */ } }

  // ---------- emoji como sprites (desenhados uma vez e guardados) ----------
  const spriteCache = new Map();
  function sprite(ch, size) {
    const s = Math.max(8, Math.round(size / 4) * 4);
    const k = ch + '|' + s;
    let c = spriteCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = Math.ceil(s * 1.3);
      const x = c.getContext('2d');
      x.font = s + 'px ' + EMOJI_FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, c.width / 2, c.height / 2 + s * 0.06);
      spriteCache.set(k, c);
    }
    return c;
  }
  function emoji(ctx, ch, x, y, size, rot, alpha) {
    const c = sprite(ch, size), d = size * 1.3;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(c, -d / 2, -d / 2, d, d); ctx.restore();
  }

  // ---------- som sintetizado ----------
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
  function Audio(cfg) {
    let ac = null, master = null, musicOn = cfg.music !== false, soundOn = cfg.sound !== false, musicT = 0, step = 0;
    const r = rng(cfg.seed || 7), root = 48 + Math.floor(r() * 7);
    const bass = [0, 0, 5, 3].map((v) => v + Math.floor(r() * 2) * 7), arp = [0, 4, 7, 12, 7, 4, 9, 12].map((v, i) => (r() < 0.25 ? PENTA[(i * 3) % 8] : v));
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = 0.8;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    }
    function tone(f, dur, type, vol, slide, when) {
      if (!ac || !soundOn) return;
      const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, vol, f) {
      if (!ac || !soundOn) return;
      const n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      fl.type = 'lowpass'; fl.frequency.value = f || 1200; g.gain.value = vol || 0.2;
      s.buffer = b; s.connect(fl); fl.connect(g); g.connect(master); s.start();
    }
    return {
      init,
      set sound(v) { soundOn = v; }, set music(v) { musicOn = v; },
      coin(combo) { const n = root + 24 + PENTA[Math.min(combo || 0, PENTA.length - 1)]; tone(hz(n), 0.16, 'triangle', 0.09); tone(hz(n + 12), 0.12, 'sine', 0.04, 0, 0.04); },
      pop(combo) { noise(0.06, 0.25, 3000); tone(hz(root + 24 + PENTA[Math.min(combo || 0, 13)]), 0.12, 'sine', 0.08); },
      jump() { tone(hz(root + 19), 0.14, 'square', 0.035, hz(root + 31)); },
      shoot() { tone(hz(root + 36), 0.06, 'square', 0.02, hz(root + 24)); },
      slice(combo) { noise(0.12, 0.18, 5000); tone(hz(root + 28 + (combo || 0) * 2), 0.1, 'sawtooth', 0.025, hz(root + 16)); },
      boom() { noise(0.5, 0.45, 700); tone(80, 0.5, 'sawtooth', 0.06, 30); },
      hit() { noise(0.2, 0.3, 900); tone(160, 0.25, 'square', 0.05, 60); },
      perfect(n) { [0, 4, 7, 12].forEach((v, i) => tone(hz(root + 24 + v + Math.min(n, 8)), 0.18, 'triangle', 0.06, 0, i * 0.05)); },
      win() { [0, 4, 7, 12, 16, 19].forEach((v, i) => tone(hz(root + 24 + v), 0.3, 'triangle', 0.07, 0, i * 0.08)); },
      over() { [12, 7, 3, 0].forEach((v, i) => tone(hz(root + 12 + v), 0.3, 'triangle', 0.07, 0, i * 0.13)); },
      // música gerada a partir da "semente" do jogo
      music(dt, playing, speed) {
        if (!ac || !musicOn || !soundOn || !playing) return;
        musicT -= dt;
        if (musicT > 0) return;
        const beat = 0.2 / (0.85 + (speed - 1) * 0.5);
        musicT += beat;
        const b = bass[Math.floor(step / 8) % 4];
        if (step % 4 === 0) tone(hz(root - 12 + b), beat * 3.5, 'triangle', 0.05);
        tone(hz(root + 12 + b + arp[step % 8]), beat * 0.9, 'sine', 0.025);
        if (step % 8 === 4) noise(0.04, 0.05, 6000);
        step++;
      }
    };
  }

  // ---------- partículas e textos ----------
  function FX() {
    const parts = [], texts = [], rings = [];
    return {
      parts, texts, rings,
      burst(x, y, color, n, speed, size, emojiCh) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = (0.3 + Math.random()) * speed;
          parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0, max: 0.5 + Math.random() * 0.6, color, r: size * (0.4 + Math.random() * 0.8), e: emojiCh, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 });
        }
      },
      ring(x, y, color, r) { rings.push({ x, y, color, r, life: 0 }); },
      text(x, y, s, color, size) { texts.push({ x, y, s, color, size, life: 0 }); },
      update(dt, g) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
          p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.rot += p.vr * dt;
        }
        for (let i = texts.length - 1; i >= 0; i--) { texts[i].life += dt; if (texts[i].life > 0.9) texts.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life += dt; if (rings[i].life > 0.5) rings.splice(i, 1); }
      },
      draw(ctx) {
        for (const r of rings) { ctx.globalAlpha = 1 - r.life / 0.5; ctx.strokeStyle = r.color; ctx.lineWidth = 4 * (1 - r.life / 0.5) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.4 + r.life * 3), 0, TAU); ctx.stroke(); }
        for (const p of parts) {
          const a = 1 - p.life / p.max;
          if (p.e) emoji(ctx, p.e, p.x, p.y, p.r * 2.4, p.rot, a);
          else { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
        for (const t of texts) {
          ctx.globalAlpha = 1 - t.life / 0.9; ctx.fillStyle = t.color; ctx.font = '900 ' + t.size + 'px system-ui,-apple-system,Roboto,sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4; ctx.strokeText(t.s, t.x, t.y - t.life * 50); ctx.fillText(t.s, t.x, t.y - t.life * 50);
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  // ---------- ajudas de desenho ----------
  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function hsl(h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a == null ? 1 : a) + ')'; }

  // ---------- os 7 tipos de jogo ----------
  // Cada tipo: init(G), update(G, dt), draw(G, ctx), e entradas: tap(G,x,y), swipe(G,dx,dy), drag(G,x,y), release(G), slash(G,x0,y0,x1,y1)
  const TEMPLATES = {};

  // 1. Plataformas: corre sozinho, toca para saltar (salto duplo), apanha moedas, salta em cima dos inimigos
  TEMPLATES.plataforma = {
    label: 'Plataformas', help: 'Toca para saltar (duas vezes no ar)',
    init(G) {
      const S = G.S;
      G.h = { x: G.W * 0.24, y: G.H * 0.6, vy: 0, jumps: 0, ground: false, rot: 0 };
      G.plats = [{ x: -10, y: G.H * 0.72, w: G.W * 1.1 }]; G.coins = []; G.foes = []; G.dist = 0;
      G.v = 30 * S * G.cfg.speed;
      while (G.plats[G.plats.length - 1].x < G.W * 2) this.more(G);
    },
    more(G) {
      const S = G.S, last = G.plats[G.plats.length - 1], d = G.cfg.difficulty;
      const gap = (8 + G.rnd() * (6 + d * 4)) * S * (0.8 + G.cfg.speed * 0.3);
      const w = (18 + G.rnd() * 28 - d * 3) * S;
      const y = clamp(last.y + (G.rnd() - 0.5) * 26 * S, G.H * 0.45, G.H * 0.82);
      const p = { x: last.x + last.w + gap, y, w, deco: G.rnd() < 0.4 ? G.pick(G.theme.deco) : null };
      G.plats.push(p);
      const n = Math.floor(w / (7 * S));
      if (G.rnd() < 0.75) for (let i = 0; i < n; i++) G.coins.push({ x: p.x + (i + 0.5) * 7 * S, y: y - 9 * S - Math.sin(i / Math.max(1, n - 1) * Math.PI) * 9 * S, t: G.rnd() * 6 });
      if (G.rnd() < 0.18 + d * 0.1 && G.dist > 40) G.foes.push({ x: p.x + w * 0.5, y: y - 22 * S, base: y - 22 * S, t: G.rnd() * 6 });
    },
    tap(G) {
      const h = G.h;
      if (h.ground || h.jumps < 2) { h.vy = -(h.jumps ? 82 : 95) * G.S; h.jumps++; h.ground = false; G.sfx.jump(); G.fx.burst(h.x, h.y + 4 * G.S, G.theme.accent, 6, 30 * G.S, 1.2 * G.S); }
    },
    update(G, dt) {
      const S = G.S, h = G.h;
      G.v = (30 + Math.min(G.time, 90) * 0.25) * S * G.cfg.speed; G.dist += G.v * dt / S / 6;
      for (const arr of [G.plats, G.coins, G.foes]) for (const o of arr) o.x -= G.v * dt;
      while (G.plats[0].x + G.plats[0].w < -20) G.plats.shift();
      while (G.plats[G.plats.length - 1].x < G.W * 2) this.more(G);
      const prevY = h.y;
      h.vy += 240 * S * dt; h.y += h.vy * dt; h.ground = false;
      const R = 4.5 * S;
      for (const p of G.plats) {
        if (h.x + R * 0.6 > p.x && h.x - R * 0.6 < p.x + p.w && prevY + R <= p.y + 2 && h.y + R >= p.y && h.vy >= 0) {
          h.y = p.y - R; if (h.vy > 60 * S) G.fx.burst(h.x, p.y, G.theme.ground, 5, 20 * S, S); h.vy = 0; h.ground = true; h.jumps = 0;
        }
      }
      h.rot = h.ground ? 0 : h.rot + dt * 8;
      for (let i = G.coins.length - 1; i >= 0; i--) {
        const c = G.coins[i]; c.t += dt;
        if (c.x < -20) { G.coins.splice(i, 1); continue; }
        if (Math.hypot(c.x - h.x, c.y - h.y) < 7 * S) { G.coins.splice(i, 1); G.collect(c.x, c.y, 1); }
      }
      for (let i = G.foes.length - 1; i >= 0; i--) {
        const f = G.foes[i]; f.t += dt; f.y = f.base + Math.sin(f.t * 3) * 6 * S;
        if (f.x < -30) { G.foes.splice(i, 1); continue; }
        if (Math.hypot(f.x - h.x, f.y - h.y) < 8 * S) {
          if (h.vy > 0 && h.y < f.y - 2 * S) { G.foes.splice(i, 1); h.vy = -80 * S; h.jumps = 1; G.add(5, f.x, f.y); G.sfx.pop(4); G.fx.burst(f.x, f.y, G.theme.accent, 18, 50 * S, 1.6 * S); G.shake(4); }
          else { G.die(); return; }
        }
      }
      if (h.y > G.H + 20 * S) G.die();
      G.distScore = Math.floor(G.dist);
    },
    draw(G, ctx) {
      const S = G.S;
      for (const p of G.plats) {
        ctx.fillStyle = G.theme.ground; rrect(ctx, p.x, p.y, p.w, G.H - p.y + 20, 3 * S); ctx.fill();
        ctx.fillStyle = G.theme.top; rrect(ctx, p.x, p.y, p.w, 3 * S, 2 * S); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 1; k < 4; k++) ctx.fillRect(p.x, p.y + k * 7 * S, p.w, 1.2 * S);
        if (p.deco) emoji(ctx, p.deco, p.x + p.w * 0.75, p.y - 6 * S, 11 * S);
      }
      for (const c of G.coins) emoji(ctx, G.theme.coin, c.x, c.y + Math.sin(c.t * 4) * S, 7 * S);
      for (const f of G.foes) emoji(ctx, G.theme.enemy, f.x, f.y, 11 * S, Math.sin(f.t * 3) * 0.2);
      const h = G.h;
      if (G.state !== 'over') emoji(ctx, G.cfg.hero, h.x, h.y, 10 * S, h.rot * 0.15);
    }
  };

  // 2. Corrida: três faixas, desvia do trânsito e apanha moedas
  TEMPLATES.corrida = {
    label: 'Corrida', help: 'Toca à esquerda ou à direita (ou desliza) para mudar de faixa',
    init(G) { G.lane = 1; G.cx = this.lx(G, 1); G.objs = []; G.road = 0; G.spawn = 1; G.v = 0; },
    lx(G, l) { const rw = Math.min(G.W * 0.8, G.H * 0.62); return G.W / 2 + (l - 1) * rw / 3; },
    tap(G, x) { this.move(G, x < G.W / 2 ? -1 : 1); },
    swipe(G, dx) { if (Math.abs(dx) > 10) this.move(G, Math.sign(dx)); },
    move(G, d) { const n = clamp(G.lane + d, 0, 2); if (n !== G.lane) { G.lane = n; G.sfx.jump(); } },
    update(G, dt) {
      const S = G.S;
      G.v = (55 + Math.min(G.time, 120) * 0.45) * S * G.cfg.speed; G.road = (G.road + G.v * dt) % (24 * S);
      G.cx = lerp(G.cx, this.lx(G, G.lane), 1 - Math.pow(0.0005, dt));
      G.spawn -= dt * (1 + G.time / 60) * (0.7 + G.cfg.difficulty * 0.25);
      if (G.spawn <= 0) {
        G.spawn = 0.75 + G.rnd() * 0.5;
        const l = Math.floor(G.rnd() * 3);
        G.objs.push({ l, y: -12 * S, kind: 'car', e: G.pick(G.theme.traffic) });
        if (G.rnd() < 0.7) { const c = (l + 1 + Math.floor(G.rnd() * 2)) % 3; for (let k = 0; k < 4; k++) G.objs.push({ l: c, y: -12 * S - k * 9 * S, kind: 'coin' }); }
        if (G.rnd() < 0.2) G.objs.push({ side: G.rnd() < 0.5 ? -1 : 1, y: -15 * S, kind: 'deco', e: G.pick(G.theme.deco) });
      }
      const py = G.H * 0.82;
      for (let i = G.objs.length - 1; i >= 0; i--) {
        const o = G.objs[i]; o.y += (o.kind === 'car' ? G.v * 0.55 : G.v) * dt;
        if (o.y > G.H + 20 * S) { G.objs.splice(i, 1); continue; }
        if (o.kind === 'deco') continue;
        const ox = this.lx(G, o.l);
        if (Math.abs(ox - G.cx) < 6 * S && Math.abs(o.y - py) < (o.kind === 'car' ? 10 : 7) * S) {
          if (o.kind === 'coin') { G.objs.splice(i, 1); G.collect(ox, o.y, 1); }
          else { G.fx.burst(G.cx, py, '#ff8a3a', 30, 70 * S, 2 * S); G.die(); return; }
        }
      }
      G.distScore = Math.floor(G.time * G.cfg.speed * 3);
    },
    draw(G, ctx) {
      const S = G.S, rw = Math.min(G.W * 0.8, G.H * 0.62), x0 = G.W / 2 - rw / 2;
      ctx.fillStyle = G.theme.ground; ctx.fillRect(x0 - 3 * S, 0, rw + 6 * S, G.H);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x0, 0, rw, G.H);
      ctx.fillStyle = G.theme.top;
      for (let k = 1; k < 3; k++) for (let y = -24 * S + G.road; y < G.H; y += 24 * S) ctx.fillRect(x0 + k * rw / 3 - 0.6 * S, y, 1.2 * S, 12 * S);
      ctx.fillRect(x0, 0, 1 * S, G.H); ctx.fillRect(x0 + rw - S, 0, S, G.H);
      for (const o of G.objs) {
        if (o.kind === 'deco') emoji(ctx, o.e, o.side < 0 ? x0 / 2 : x0 + rw + (G.W - x0 - rw) / 2, o.y, 12 * S);
        else if (o.kind === 'coin') emoji(ctx, G.theme.coin, this.lx(G, o.l), o.y, 7 * S);
        else emoji(ctx, o.e, this.lx(G, o.l), o.y, 15 * S);
      }
      if (G.state !== 'over') emoji(ctx, G.cfg.hero, G.cx, G.H * 0.82, 15 * S, (this.lx(G, G.lane) - G.cx) / (40 * S));
    }
  };

  // 3. Espaço: arrasta a nave, ela dispara sozinha
  TEMPLATES.espaco = {
    label: 'Nave', help: 'Arrasta para mover a nave; ela dispara sozinha',
    init(G) { G.sx = G.W / 2; G.tx = G.W / 2; G.shots = []; G.foes = []; G.fire = 0; G.spawn = 1.2; G.lives = 3; G.triple = 0; G.stars = []; for (let i = 0; i < 70; i++) G.stars.push({ x: G.rnd() * G.W, y: G.rnd() * G.H, z: 0.3 + G.rnd() }); G.inv = 0; },
    drag(G, x) { G.tx = x; }, tap(G, x) { G.tx = x; },
    update(G, dt) {
      const S = G.S, sy = G.H * 0.84;
      G.sx = lerp(G.sx, clamp(G.tx, 6 * S, G.W - 6 * S), 1 - Math.pow(0.00002, dt));
      for (const s of G.stars) { s.y += s.z * 40 * S * dt * G.cfg.speed; if (s.y > G.H) { s.y = 0; s.x = G.rnd() * G.W; } }
      G.fire -= dt; if (G.fire <= 0) { G.fire = 0.22; G.sfx.shoot(); const ang = G.triple > 0 ? [-0.25, 0, 0.25] : [0]; for (const a of ang) G.shots.push({ x: G.sx, y: sy - 8 * S, vx: Math.sin(a) * 160 * S, vy: -Math.cos(a) * 160 * S }); }
      if (G.triple > 0) G.triple -= dt; if (G.inv > 0) G.inv -= dt;
      for (let i = G.shots.length - 1; i >= 0; i--) { const b = G.shots[i]; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y < -10) G.shots.splice(i, 1); }
      G.spawn -= dt * (1 + G.time / 45) * (0.6 + G.cfg.difficulty * 0.3) * G.cfg.speed;
      if (G.spawn <= 0) {
        G.spawn = 0.9 + G.rnd() * 0.6;
        const rock = G.rnd() < 0.35, pw = G.rnd() < 0.07;
        G.foes.push({ x: (0.1 + G.rnd() * 0.8) * G.W, y: -10 * S, vy: (18 + G.rnd() * 14) * S * G.cfg.speed, vx: (G.rnd() - 0.5) * 12 * S, t: 0, hp: rock ? 3 : 1, e: pw ? G.theme.coin : rock ? G.pick(G.theme.deco) : G.theme.enemy, pw, size: rock ? 13 : 10 });
      }
      for (let i = G.foes.length - 1; i >= 0; i--) {
        const f = G.foes[i]; f.t += dt; f.y += f.vy * dt; f.x += f.vx * dt + Math.sin(f.t * 2) * 8 * S * dt;
        if (f.y > G.H + 15 * S) { G.foes.splice(i, 1); continue; }
        for (let j = G.shots.length - 1; j >= 0; j--) {
          const b = G.shots[j];
          if (Math.hypot(b.x - f.x, b.y - f.y) < f.size * 0.55 * S) {
            G.shots.splice(j, 1); f.hp--; G.fx.burst(b.x, b.y, G.theme.accent, 4, 30 * S, S);
            if (f.hp <= 0) {
              G.foes.splice(i, 1);
              if (f.pw) { G.triple = 6; G.sfx.perfect(2); G.fx.text(f.x, f.y, '×3', G.theme.accent, 7 * S); }
              else { G.add(10, f.x, f.y); G.sfx.pop(Math.min(G.combo, 10)); }
              G.fx.burst(f.x, f.y, G.theme.accent, 22, 60 * S, 1.8 * S); G.fx.ring(f.x, f.y, G.theme.accent, 8 * S); G.shake(3);
            }
            break;
          }
        }
        if (G.foes[i] === f && G.inv <= 0 && Math.hypot(f.x - G.sx, f.y - sy) < (f.size * 0.45 + 5) * S) {
          G.foes.splice(i, 1);
          if (f.pw) { G.triple = 6; continue; }
          G.lives--; G.inv = 1.5; G.sfx.hit(); G.shake(10); G.fx.burst(G.sx, sy, '#ff6b4a', 25, 60 * S, 2 * S);
          if (G.lives <= 0) { G.die(); return; }
        }
      }
    },
    draw(G, ctx) {
      const S = G.S, sy = G.H * 0.84;
      ctx.fillStyle = '#fff'; for (const s of G.stars) { ctx.globalAlpha = s.z * 0.7; ctx.fillRect(s.x, s.y, s.z * 1.6, s.z * 1.6); } ctx.globalAlpha = 1;
      ctx.fillStyle = G.theme.accent; for (const b of G.shots) { ctx.beginPath(); ctx.arc(b.x, b.y, 1.3 * S, 0, TAU); ctx.fill(); }
      for (const f of G.foes) emoji(ctx, f.e, f.x, f.y, f.size * S, f.hp > 1 ? f.t : Math.sin(f.t * 3) * 0.2);
      if (G.state !== 'over' && !(G.inv > 0 && Math.sin(G.time * 30) > 0)) {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = G.triple > 0 ? G.theme.accent : '#ff9a3a';
        ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(G.sx, sy + 7 * S, (2 + Math.random() * 1.5) * S, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        emoji(ctx, G.cfg.hero, G.sx, sy, 12 * S, -Math.PI / 4 * (G.cfg.heroRot || 0));
      }
      for (let i = 0; i < G.lives; i++) emoji(ctx, '❤️', G.W - (6 + i * 7) * S, G.top + 16 * S, 5 * S);
    }
  };

  // 4. Masmorra: labirinto; desliza para mudar de direção, apanha as gemas e foge dos inimigos
  TEMPLATES.masmorra = {
    label: 'Labirinto', help: 'Desliza para mudar de direção; apanha todas as gemas',
    init(G) { G.level = 0; G.lives = 3; this.level(G); },
    level(G) {
      const cols = 7 + Math.min(G.level, 2), rows = Math.round(cols * Math.max(1.2, G.H / G.W) * 0.95) | 1, W = cols * 2 + 1, H = rows * 2 + 1;
      const m = []; for (let y = 0; y < H; y++) { m.push([]); for (let x = 0; x < W; x++) m[y].push(1); }
      const st = [[0, 0]], seen = new Set(['0,0']); m[1][1] = 0;
      while (st.length) {
        const [cx, cy] = st[st.length - 1];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [cx + a, cy + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && !seen.has(a + ',' + b));
        if (!nb.length) { st.pop(); continue; }
        const [nx, ny] = nb[Math.floor(G.rnd() * nb.length)]; seen.add(nx + ',' + ny);
        m[ny * 2 + 1][nx * 2 + 1] = 0; m[cy + ny + 1][cx + nx + 1] = 0; st.push([nx, ny]);
      }
      for (let k = 0; k < cols * rows * 0.18; k++) { const x = 1 + Math.floor(G.rnd() * (W - 2)), y = 1 + Math.floor(G.rnd() * (H - 2)); if ((x + y) % 2 === 1) m[y][x] = 0; }
      G.m = m; G.mw = W; G.mh = H;
      G.cell = Math.min(G.W / W, (G.H - G.top - 26 * G.S) / H); G.ox = (G.W - W * G.cell) / 2; G.oy = G.top + 20 * G.S + (G.H - G.top - 26 * G.S - H * G.cell) / 2;
      G.p = { x: 1, y: 1, fx: 1, fy: 1, dir: null, want: null };
      G.gems = []; G.exit = { x: W - 2, y: H - 2 }; G.open = false;
      for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) if (!(x === 1 && y === 1) && !(x === W - 2 && y === H - 2) && G.rnd() < 0.3) G.gems.push({ x, y, t: G.rnd() * 6 });
      G.foes = []; const nf = 1 + G.level + (G.cfg.difficulty - 1);
      for (let i = 0; i < nf; i++) G.foes.push({ x: W - 2 - 2 * Math.floor(G.rnd() * 3), y: 1 + 2 * Math.floor(G.rnd() * ((H - 1) / 2)), fx: 0, fy: 0, dir: [1, 0], t: 0 });
      G.foes.forEach((f) => { f.fx = f.x; f.fy = f.y; });
      G.inv = 1.5;
    },
    free(G, x, y) { return y >= 0 && x >= 0 && y < G.mh && x < G.mw && G.m[y][x] === 0; },
    swipe(G, dx, dy) { G.p.want = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; },
    tap(G, x, y) { const px = G.ox + (G.p.fx + 0.5) * G.cell, py = G.oy + (G.p.fy + 0.5) * G.cell; this.swipe(G, x - px, y - py); },
    update(G, dt) {
      const p = G.p, sp = (6.5 + G.level * 0.3) * G.cfg.speed;
      if (G.inv > 0) G.inv -= dt;
      // move-se de casa em casa; nas casas decide a direção (como num arcade clássico)
      const at = Math.abs(p.fx - p.x) < 0.001 && Math.abs(p.fy - p.y) < 0.001;
      if (at) {
        if (p.want && this.free(G, p.x + p.want[0], p.y + p.want[1])) { p.dir = p.want; }
        if (p.dir && this.free(G, p.x + p.dir[0], p.y + p.dir[1])) { p.x += p.dir[0]; p.y += p.dir[1]; } else p.dir = null;
      }
      p.fx += clamp(p.x - p.fx, -sp * dt, sp * dt); p.fy += clamp(p.y - p.fy, -sp * dt, sp * dt);
      for (let i = G.gems.length - 1; i >= 0; i--) { const g = G.gems[i]; g.t += dt; if (Math.hypot(g.x - p.fx, g.y - p.fy) < 0.6) { G.gems.splice(i, 1); G.collect(G.ox + (g.x + 0.5) * G.cell, G.oy + (g.y + 0.5) * G.cell, 1); } }
      if (!G.open && !G.gems.length) { G.open = true; G.sfx.win(); G.fx.text(G.W / 2, G.H / 2, 'SAÍDA ABERTA!', G.theme.accent, 7 * G.S); }
      if (G.open && Math.hypot(G.exit.x - p.fx, G.exit.y - p.fy) < 0.5) { G.level++; G.add(50, G.W / 2, G.H / 2); G.sfx.perfect(G.level); this.level(G); return; }
      const fs = (2.6 + G.level * 0.4 + G.cfg.difficulty * 0.4) * G.cfg.speed;
      for (const f of G.foes) {
        if (Math.abs(f.fx - f.x) < 0.001 && Math.abs(f.fy - f.y) < 0.001) {
          const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => this.free(G, f.x + a, f.y + b) && !(a === -f.dir[0] && b === -f.dir[1]));
          let d = opts.length ? opts[Math.floor(G.rnd() * opts.length)] : [-f.dir[0], -f.dir[1]];
          if (G.rnd() < 0.5) { const toward = opts.find(([a, b]) => Math.sign(p.x - f.x) === a && a !== 0 || Math.sign(p.y - f.y) === b && b !== 0); if (toward) d = toward; }
          f.dir = d; f.x += d[0]; f.y += d[1];
        }
        f.fx += clamp(f.x - f.fx, -fs * dt, fs * dt); f.fy += clamp(f.y - f.fy, -fs * dt, fs * dt); f.t += dt;
        if (G.inv <= 0 && Math.hypot(f.fx - p.fx, f.fy - p.fy) < 0.7) {
          G.lives--; G.inv = 2; G.sfx.hit(); G.shake(8); G.fx.burst(G.ox + (p.fx + 0.5) * G.cell, G.oy + (p.fy + 0.5) * G.cell, '#ff6b4a', 20, 40 * G.S, 1.5 * G.S);
          if (G.lives <= 0) { G.die(); return; }
          p.x = p.fx = 1; p.y = p.fy = 1; p.dir = null;
        }
      }
    },
    draw(G, ctx) {
      const c = G.cell, S = G.S;
      for (let y = 0; y < G.mh; y++) for (let x = 0; x < G.mw; x++) {
        const px = G.ox + x * c, py = G.oy + y * c;
        if (G.m[y][x]) { ctx.fillStyle = G.theme.ground; ctx.fillRect(px, py, c + 0.5, c + 0.5); ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(px, py, c, c * 0.18); }
        else { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px, py, c + 0.5, c + 0.5); }
      }
      const ex = G.ox + (G.exit.x + 0.5) * c, ey = G.oy + (G.exit.y + 0.5) * c;
      if (G.open) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, c * 1.6); g.addColorStop(0, G.theme.accent); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(ex - c * 2, ey - c * 2, c * 4, c * 4); ctx.globalCompositeOperation = 'source-over'; }
      emoji(ctx, G.open ? '🚪' : '🔒', ex, ey, c * 0.85);
      for (const g of G.gems) emoji(ctx, G.theme.coin, G.ox + (g.x + 0.5) * c, G.oy + (g.y + 0.5) * c + Math.sin(g.t * 4) * c * 0.06, c * 0.7);
      for (const f of G.foes) emoji(ctx, G.theme.enemy, G.ox + (f.fx + 0.5) * c, G.oy + (f.fy + 0.5) * c, c * 0.9, Math.sin(f.t * 5) * 0.15);
      if (G.state !== 'over' && !(G.inv > 0 && Math.sin(G.time * 25) > 0)) emoji(ctx, G.cfg.hero, G.ox + (G.p.fx + 0.5) * c, G.oy + (G.p.fy + 0.5) * c, c * 0.95);
      for (let i = 0; i < G.lives; i++) emoji(ctx, '❤️', G.W - (6 + i * 7) * S, G.top + 16 * S, 5 * S);
    }
  };

  // 5. Torre: empilha blocos; acertar em cheio dá bónus
  TEMPLATES.torre = {
    label: 'Torre', help: 'Toca para largar o bloco em cima da torre',
    init(G) {
      const S = G.S, w = Math.min(G.W * 0.55, 60 * S);
      G.bh = 7 * S; G.blocks = [{ x: G.W / 2 - w / 2, w, y: G.H * 0.8 }]; G.cam = 0; G.camT = 0; G.falling = []; G.perfects = 0;
      this.next(G);
    },
    next(G) {
      const top = G.blocks[G.blocks.length - 1], n = G.blocks.length;
      G.mov = { x: n % 2 ? -top.w : G.W, w: top.w, y: top.y - G.bh, dir: n % 2 ? 1 : -1, hue: (G.theme.hue + n * 9) % 360 };
    },
    tap(G) {
      const m = G.mov, top = G.blocks[G.blocks.length - 1], S = G.S;
      const l = Math.max(m.x, top.x), r = Math.min(m.x + m.w, top.x + top.w);
      if (r - l <= 0) { G.falling.push({ x: m.x, y: m.y, w: m.w, vy: 0, vr: 0.5, rot: 0, hue: m.hue }); G.die(); return; }
      if (Math.abs(m.x - top.x) < 2.2 * S) {
        G.perfects++; m.x = top.x; const grow = Math.min(top.w * 1.04, G.blocks[0].w);
        const b = { x: top.x - (grow - top.w) / 2, w: grow, y: m.y, hue: m.hue }; G.blocks.push(b);
        G.sfx.perfect(G.perfects); G.fx.ring(b.x + b.w / 2, b.y, '#fff', b.w * 0.4); G.add(2, b.x + b.w / 2, b.y - 6 * S, 'PERFEITO!');
      } else {
        G.perfects = 0;
        const cut = m.x < l ? { x: m.x, w: l - m.x } : { x: r, w: m.x + m.w - r };
        G.falling.push({ x: cut.x, y: m.y, w: cut.w, vy: 0, vr: (m.x < l ? -1 : 1) * 2, rot: 0, hue: m.hue });
        G.blocks.push({ x: l, w: r - l, y: m.y, hue: m.hue }); G.add(1, l + (r - l) / 2, m.y - 6 * S); G.sfx.coin(Math.min(G.blocks.length % 14, 13));
      }
      G.fx.burst(m.x + m.w / 2, m.y + G.bh / 2, hsl(m.hue, 80, 65), 12, 40 * S, 1.2 * S);
      G.camT = Math.max(0, (G.H * 0.8 - m.y) - G.H * 0.45);
      this.next(G);
    },
    update(G, dt) {
      const m = G.mov, sp = (45 + G.blocks.length * 1.6) * G.S * G.cfg.speed * (0.8 + G.cfg.difficulty * 0.15);
      if (m && G.state === 'play') { m.x += m.dir * sp * dt; if (m.x > G.W - m.w * 0.2) m.dir = -1; if (m.x < -m.w * 0.8) m.dir = 1; }
      G.cam = lerp(G.cam, G.camT, 1 - Math.pow(0.02, dt));
      for (let i = G.falling.length - 1; i >= 0; i--) { const f = G.falling[i]; f.vy += 200 * G.S * dt; f.y += f.vy * dt; f.rot += f.vr * dt; if (f.y > G.H + G.cam + 100) G.falling.splice(i, 1); }
      G.distScore = 0;
    },
    block(G, ctx, x, y, w, hue, rot) {
      const h = G.bh;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); if (rot) ctx.rotate(rot);
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, hsl(hue, 85, 68)); g.addColorStop(1, hsl(hue, 75, 48));
      ctx.fillStyle = g; rrect(ctx, -w / 2, -h / 2, w, h, h * 0.25); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-w / 2 + h * 0.2, -h / 2 + 2, w - h * 0.4, h * 0.18);
      ctx.restore();
    },
    draw(G, ctx) {
      ctx.save(); ctx.translate(0, G.cam);
      const b0 = G.blocks[0]; ctx.fillStyle = G.theme.ground; ctx.fillRect(b0.x - 10 * G.S, b0.y + G.bh, b0.w + 20 * G.S, G.H);
      G.blocks.forEach((b, i) => this.block(G, ctx, b.x, b.y, b.w, b.hue != null ? b.hue : G.theme.hue, 0, i));
      for (const f of G.falling) this.block(G, ctx, f.x, f.y, f.w, f.hue, f.rot);
      if (G.mov && G.state !== 'over') this.block(G, ctx, G.mov.x, G.mov.y, G.mov.w, G.mov.hue, 0);
      const top = G.blocks[G.blocks.length - 1];
      if (G.blocks.length > 1) emoji(ctx, G.cfg.hero, top.x + top.w / 2, top.y - 5 * G.S, 8 * G.S);
      ctx.restore();
    }
  };

  // 6. Cortar: desliza o dedo para cortar o que voa; não cortes as bombas
  TEMPLATES.cortar = {
    label: 'Cortar', help: 'Desliza o dedo para cortar; evita as bombas',
    init(G) { G.items = []; G.halves = []; G.trail = []; G.spawn = 0.6; G.lives = 3; },
    slash(G, x0, y0, x1, y1) {
      G.trail.push({ x: x1, y: y1, t: 0 });
      let cut = 0;
      for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i], R = it.size * 0.5 * G.S;
        const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1, t = clamp(((it.x - x0) * dx + (it.y - y0) * dy) / l2, 0, 1);
        if (Math.hypot(x0 + dx * t - it.x, y0 + dy * t - it.y) < R) {
          G.items.splice(i, 1);
          if (it.bomb) { G.fx.burst(it.x, it.y, '#ffb03a', 40, 90 * G.S, 2.2 * G.S); G.sfx.boom(); G.shake(14); G.die(); return; }
          cut++; G.sliceCombo = (G.sliceCombo || 0) + 1;
          const ang = Math.atan2(dy, dx);
          for (const side of [-1, 1]) G.halves.push({ e: it.e, x: it.x, y: it.y, vx: it.vx + Math.cos(ang + side * Math.PI / 2) * 30 * G.S, vy: it.vy * 0.4 - 20 * G.S, rot: it.rot, vr: side * 6, side, ang, size: it.size, life: 0 });
          G.fx.burst(it.x, it.y, it.juice, 16, 55 * G.S, 1.6 * G.S); G.sfx.slice(Math.min(G.sliceCombo, 8)); G.add(1, it.x, it.y);
        }
      }
      if (cut >= 3) { G.add(cut, x1, y1 - 8 * G.S, 'COMBO ×' + cut); G.sfx.perfect(cut); }
    },
    release(G) { G.sliceCombo = 0; },
    update(G, dt) {
      const S = G.S, grav = 70 * S;
      G.spawn -= dt * (0.8 + G.time / 70) * (0.7 + G.cfg.difficulty * 0.2);
      if (G.spawn <= 0) {
        G.spawn = 0.8 + G.rnd() * 0.7;
        const n = 1 + Math.floor(G.rnd() * Math.min(4, 1 + G.time / 15));
        for (let k = 0; k < n; k++) {
          const bomb = G.rnd() < 0.08 + G.cfg.difficulty * 0.04 && G.time > 3, x = (0.2 + G.rnd() * 0.6) * G.W;
          const f = G.pick(G.theme.fruit);
          G.items.push({ x, y: G.H + 8 * S, vx: (G.W / 2 - x) * (0.2 + G.rnd() * 0.3), vy: -Math.sqrt(2 * grav * G.H * (0.5 + G.rnd() * 0.3)), rot: 0, vr: (G.rnd() - 0.5) * 4, e: bomb ? '💣' : f, bomb, size: bomb ? 12 : 13, juice: bomb ? '#333' : G.theme.juice });
        }
      }
      for (let i = G.items.length - 1; i >= 0; i--) {
        const it = G.items[i]; it.vy += grav * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
        if (it.y > G.H + 15 * S && it.vy > 0) { G.items.splice(i, 1); if (!it.bomb) { G.lives--; G.sfx.hit(); G.shake(4); if (G.lives <= 0) { G.die(); return; } } }
      }
      for (let i = G.halves.length - 1; i >= 0; i--) { const h = G.halves[i]; h.life += dt; h.vy += grav * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.rot += h.vr * dt; if (h.y > G.H + 20 * S) G.halves.splice(i, 1); }
      for (let i = G.trail.length - 1; i >= 0; i--) { G.trail[i].t += dt; if (G.trail[i].t > 0.18) G.trail.splice(i, 1); }
    },
    draw(G, ctx) {
      const S = G.S;
      for (const it of G.items) emoji(ctx, it.e, it.x, it.y, it.size * S, it.rot);
      for (const h of G.halves) {
        const c = sprite(h.e, h.size * S), d = h.size * S * 1.3;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.beginPath();
        ctx.rect(h.side < 0 ? -d : 0, -d, d, d * 2); ctx.clip(); ctx.globalAlpha = Math.max(0, 1 - h.life); ctx.drawImage(c, -d / 2, -d / 2, d, d); ctx.restore();
      }
      if (G.trail.length > 1) {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const [w, col] of [[5 * S, G.theme.accent], [2 * S, '#fff']]) {
          ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = 0.85; ctx.beginPath();
          G.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < G.lives; i++) emoji(ctx, '❤️', G.W - (6 + i * 7) * S, G.top + 16 * S, 5 * S);
    }
  };

  // 7. Bolhas: rebenta bolhas depressa para fazer combos; não toques nas bolhas escuras
  TEMPLATES.bolhas = {
    label: 'Bolhas', help: 'Toca nas bolhas para as rebentar; evita as escuras',
    init(G) { G.bubbles = []; G.spawn = 0; G.clock = 45; G.lastPop = -9; G.chain = 0; },
    tap(G, x, y) {
      for (let i = G.bubbles.length - 1; i >= 0; i--) {
        const b = G.bubbles[i];
        if (Math.hypot(b.x - x, b.y - y) < b.r * 1.15) {
          G.bubbles.splice(i, 1);
          if (b.bad) { G.clock -= 5; G.sfx.hit(); G.shake(6); G.fx.text(b.x, b.y, '−5 s', '#ff6b6b', 6 * G.S); G.chain = 0; return; }
          G.chain = G.time - G.lastPop < 0.9 ? G.chain + 1 : 0; G.lastPop = G.time;
          const pts = (b.gold ? 5 : 1) * (1 + Math.floor(G.chain / 3));
          G.add(pts, b.x, b.y, G.chain >= 3 ? 'COMBO ×' + (1 + Math.floor(G.chain / 3)) : null); G.sfx.pop(G.chain);
          G.fx.burst(b.x, b.y, b.gold ? '#ffd23a' : hsl(b.hue, 90, 75), 14, 45 * G.S, 1.3 * G.S); G.fx.ring(b.x, b.y, '#fff', b.r);
          if (b.gold) { G.clock += 3; G.fx.burst(b.x, b.y, null, 6, 40 * G.S, 2.5 * G.S, G.theme.coin); }
          return;
        }
      }
      G.chain = 0;
    },
    update(G, dt) {
      const S = G.S;
      G.clock -= dt; if (G.clock <= 0) { G.clock = 0; G.die(true); return; }
      G.spawn -= dt * (1.4 + G.time / 25) * G.cfg.speed;
      if (G.spawn <= 0) {
        G.spawn = 0.35 + G.rnd() * 0.3;
        const bad = G.rnd() < 0.06 + G.cfg.difficulty * 0.05, gold = !bad && G.rnd() < 0.08, r = (7 + G.rnd() * 5) * S;
        G.bubbles.push({ x: r + G.rnd() * (G.W - 2 * r), y: G.H + r, r, vy: -(14 + G.rnd() * 14 + G.time * 0.2) * S * G.cfg.speed, t: G.rnd() * 6, hue: (G.theme.hue + (G.rnd() - 0.5) * 120 + 360) % 360, bad, gold, e: bad ? G.theme.enemy : gold ? G.theme.coin : G.pick(G.theme.fruit) });
      }
      for (let i = G.bubbles.length - 1; i >= 0; i--) { const b = G.bubbles[i]; b.t += dt; b.y += b.vy * dt; b.x += Math.sin(b.t * 2) * 6 * S * dt; if (b.y < -b.r * 2) G.bubbles.splice(i, 1); }
      G.distScore = 0;
    },
    draw(G, ctx) {
      for (const b of G.bubbles) {
        const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
        if (b.bad) { g.addColorStop(0, 'rgba(90,90,110,.5)'); g.addColorStop(1, 'rgba(20,20,30,.85)'); }
        else if (b.gold) { g.addColorStop(0, 'rgba(255,255,220,.6)'); g.addColorStop(1, 'rgba(255,190,40,.55)'); }
        else { g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(0.7, hsl(b.hue, 90, 70, 0.25)); g.addColorStop(1, hsl(b.hue, 90, 75, 0.6)); }
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
        emoji(ctx, b.e, b.x, b.y, b.r * 1.05, Math.sin(b.t) * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.4, b.y - b.r * 0.45, b.r * 0.2, b.r * 0.11, -0.6, 0, TAU); ctx.fill();
      }
      const S = G.S, frac = G.clock / 45;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; rrect(ctx, G.W * 0.2, G.top + 24 * S, G.W * 0.6, 2.4 * S, 1.2 * S); ctx.fill();
      ctx.fillStyle = G.clock < 10 ? '#ff6b6b' : G.theme.accent; rrect(ctx, G.W * 0.2, G.top + 24 * S, G.W * 0.6 * clamp(frac, 0, 1), 2.4 * S, 1.2 * S); ctx.fill();
    }
  };

  // ---------- execução ----------
  function run(canvas, cfg, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const T = TEMPLATES[cfg.template] || TEMPLATES.plataforma;
    const th = cfg.theme;
    const sfx = Audio(cfg);
    const bestKey = 'mdj_best_' + (cfg.id || cfg.name);
    const G = { cfg, theme: th, sfx, fx: FX(), state: opts.autostart ? 'play' : 'title', score: 0, best: parseInt(load(bestKey) || '0', 10) || 0, time: 0, combo: 0, comboT: 0, shakeV: 0, top: 0, t: 0 };
    let raf = 0, last = 0, stopped = false, DPR = 1;
    const deco = [];
    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect(); G.W = Math.max(50, r.width); G.H = Math.max(50, r.height);
      canvas.width = Math.round(G.W * DPR); canvas.height = Math.round(G.H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      G.S = Math.min(G.W, G.H * 0.62) / 100; G.top = opts.top || 0;
      deco.length = 0; const r2 = rng((cfg.seed || 1) + 99);
      for (let i = 0; i < 10; i++) deco.push({ x: r2() * G.W, y: r2() * G.H * 0.8, s: 6 + r2() * 10, e: th.deco[Math.floor(r2() * th.deco.length)], v: 0.2 + r2() * 0.6, ph: r2() * 6 });
    }
    function reset() {
      G.rnd = rng((cfg.seed || 1) + Math.floor(Math.random() * 1e6)); G.pick = (a) => a[Math.floor(G.rnd() * a.length)];
      G.score = 0; G.time = 0; G.combo = 0; G.comboT = 0; G.distScore = 0; G.fx = FX(); T.init(G);
    }
    G.add = (n, x, y, label) => { G.score += n; G.fx.text(x, y, label || '+' + n, label ? th.accent : '#fff', (label ? 6 : 5) * G.S); };
    G.collect = (x, y, n) => {
      G.combo = G.comboT > 0 ? G.combo + 1 : 0; G.comboT = 1.2;
      G.add(n, x, y); sfx.coin(G.combo); G.fx.burst(x, y, th.accent, 8, 35 * G.S, 1.1 * G.S); G.fx.ring(x, y, th.accent, 5 * G.S);
    };
    G.shake = (v) => { G.shakeV = Math.max(G.shakeV, v); };
    G.die = (timeUp) => {
      if (G.state !== 'play') return;
      G.state = 'over'; G.overT = 0; G.timeUp = !!timeUp;
      const total = G.score + (G.distScore || 0);
      G.final = total; G.newBest = total > G.best; if (G.newBest) { G.best = total; save(bestKey, total); }
      if (timeUp) sfx.win(); else { sfx.over(); G.shake(10); }
      if (opts.onOver) opts.onOver(total);
    };
    resize(); reset();

    // entradas
    let down = null;
    function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function onDown(e) {
      if (opts.preview) return;
      e.preventDefault(); sfx.init();
      const [x, y] = pos(e);
      if (G.state === 'title') { G.state = 'play'; reset(); return; }
      if (G.state === 'over') { if (G.overT > 0.6) { G.state = 'play'; reset(); } return; }
      down = { x, y, x0: x, y0: y, t: performance.now(), moved: false };
      if (T.drag) T.drag(G, x, y);
      if (!T.slash) { if (T.tap && !T.swipe) T.tap(G, x, y); }
    }
    function onMove(e) {
      if (!down || G.state !== 'play') return;
      const [x, y] = pos(e);
      if (T.drag) T.drag(G, x, y);
      if (T.slash) T.slash(G, down.x, down.y, x, y);
      if (T.swipe && !down.moved && Math.hypot(x - down.x0, y - down.y0) > 18) { down.moved = true; T.swipe(G, x - down.x0, y - down.y0); }
      down.x = x; down.y = y;
    }
    function onUp() {
      if (!down) return;
      if (G.state === 'play') {
        if (T.swipe && !down.moved && T.tap) T.tap(G, down.x0, down.y0);
        if (T.release) T.release(G);
      }
      down = null;
    }
    canvas.addEventListener('pointerdown', onDown, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const onKey = (e) => {
      if (opts.preview) return;
      const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); const fake = { preventDefault() {}, clientX: canvas.getBoundingClientRect().left + G.W / 2, clientY: canvas.getBoundingClientRect().top + G.H / 2 }; onDown(fake); onUp(); }
      else if (map[e.code] && G.state === 'play') {
        e.preventDefault();
        if (T.swipe) T.swipe(G, map[e.code][0] * 40, map[e.code][1] * 40);
        else if (T.drag) { G.tx = clamp((G.tx || G.W / 2) + map[e.code][0] * 12 * G.S, 0, G.W); }
      }
    };
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(() => { resize(); if (G.state !== 'play') reset(); });
    ro.observe(canvas);

    function drawBg() {
      const g = ctx.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, th.bg1); g.addColorStop(1, th.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
      for (const d of deco) { const y = (d.y + G.t * d.v * 6 * G.S) % (G.H * 0.9); emoji(ctx, d.e, d.x, y, d.s * G.S, Math.sin(G.t * 0.5 + d.ph) * 0.2, 0.18); }
    }
    function text(s, x, y, size, color, weight) {
      ctx.font = (weight || 800) + ' ' + size + 'px system-ui,-apple-system,Roboto,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y, G.W - 20);
    }
    function frame(now) {
      if (stopped) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; G.t += dt;
      if (G.state === 'play') {
        G.time += dt; if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
        T.update(G, dt);
      } else if (G.state === 'over') { G.overT += dt; if (T.update && cfg.template === 'torre') T.update(G, dt); }
      G.fx.update(dt, 60 * G.S);
      sfx.music(dt, G.state === 'play', cfg.speed);
      G.shakeV = Math.max(0, G.shakeV - dt * 40);
      ctx.save();
      if (G.shakeV > 0) ctx.translate((Math.random() - 0.5) * G.shakeV, (Math.random() - 0.5) * G.shakeV);
      drawBg();
      if (G.state !== 'title') T.draw(G, ctx);
      G.fx.draw(ctx);
      ctx.restore();
      const S = G.S;
      if (G.state === 'play') {
        text(String(G.score + (G.distScore || 0)), G.W / 2, G.top + 12 * S, 11 * S, '#fff', 900);
        if (G.combo >= 2) text('combo ×' + (G.combo + 1), G.W / 2, G.top + 22 * S, 4.5 * S, th.accent, 800);
        if (cfg.template === 'bolhas') text(Math.ceil(G.clock) + ' s', G.W / 2, G.top + 30 * S, 4 * S, '#fff', 700);
        if (G.time < 2.5 && !opts.preview) { ctx.globalAlpha = 1 - G.time / 2.5; text(T.help, G.W / 2, G.H * 0.62, 4.2 * S, '#fff', 700); ctx.globalAlpha = 1; }
      } else if (G.state === 'title') {
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, G.W, G.H);
        emoji(ctx, cfg.hero, G.W / 2, G.H * 0.38 + Math.sin(G.t * 3) * 3 * S, 28 * S, Math.sin(G.t * 2) * 0.1);
        text(cfg.name, G.W / 2, G.H * 0.16 + G.top, Math.min(11 * S, G.W / Math.max(8, cfg.name.length) * 1.6), '#fff', 900);
        text(T.label.toUpperCase(), G.W / 2, G.H * 0.16 + G.top + 9 * S, 3.6 * S, th.accent, 800);
        if (!opts.preview) {
          ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.t * 4); text(opts.startText || 'TOCA PARA JOGAR', G.W / 2, G.H * 0.66, 5.5 * S, '#fff', 900); ctx.globalAlpha = 1;
          text(T.help, G.W / 2, G.H * 0.74, 3.6 * S, 'rgba(255,255,255,.85)', 600);
          if (G.best) text('Recorde: ' + G.best, G.W / 2, G.H * 0.82, 4 * S, th.accent, 800);
        }
      } else if (G.state === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, G.overT) + ')'; ctx.fillRect(0, 0, G.W, G.H);
        text(G.timeUp ? 'TEMPO!' : 'FIM DE JOGO', G.W / 2, G.H * 0.3, 9 * S, '#fff', 900);
        text(String(G.final), G.W / 2, G.H * 0.44, 18 * S, th.accent, 900);
        text(G.newBest ? 'NOVO RECORDE!' : 'Recorde: ' + G.best, G.W / 2, G.H * 0.56, 5 * S, '#fff', 800);
        if (G.overT > 0.6) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(G.t * 4); text('TOCA PARA JOGAR OUTRA VEZ', G.W / 2, G.H * 0.72, 4.6 * S, '#fff', 900); ctx.globalAlpha = 1; }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame((t) => { last = t; frame(t); });
    return {
      G,
      stop() { stopped = true; cancelAnimationFrame(raf); ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); window.removeEventListener('keydown', onKey); sfx.music = false; },
      pause() { stopped = true; cancelAnimationFrame(raf); },
      resume() { if (!stopped) return; stopped = false; raf = requestAnimationFrame((t) => { last = t; frame(t); }); }
    };
  }

  // miniatura estática: fundo, decoração, herói e alguns elementos do tipo de jogo
  function thumb(canvas, cfg) {
    const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, th = cfg.theme, S = Math.min(W, H * 0.62) / 100;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.bg1); g.addColorStop(1, th.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = rng(cfg.seed || 3);
    for (let i = 0; i < 6; i++) emoji(ctx, th.deco[i % th.deco.length], r() * W, r() * H * 0.7, (10 + r() * 10) * S, 0, 0.25);
    const t = cfg.template;
    if (t === 'plataforma' || t === 'torre') { ctx.fillStyle = th.ground; rrect(ctx, W * 0.1, H * 0.7, W * 0.5, H * 0.4, 3 * S); ctx.fill(); ctx.fillStyle = th.top; ctx.fillRect(W * 0.1, H * 0.7, W * 0.5, 3 * S); rrect(ctx, W * 0.68, H * 0.6, W * 0.4, H * 0.5, 3 * S); ctx.fillStyle = th.ground; ctx.fill(); }
    if (t === 'corrida') { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(W * 0.2, 0, W * 0.6, H); ctx.fillStyle = th.top; for (let y = 0; y < H; y += 14 * S) { ctx.fillRect(W * 0.4, y, S, 7 * S); ctx.fillRect(W * 0.6, y, S, 7 * S); } emoji(ctx, th.traffic[0], W * 0.3, H * 0.3, 16 * S); }
    if (t === 'masmorra') { ctx.fillStyle = th.ground; for (let i = 0; i < 8; i++) ctx.fillRect(r() * W, r() * H, 8 * S + r() * 30 * S, 6 * S); }
    if (t === 'bolhas' || t === 'cortar') for (let i = 0; i < 4; i++) emoji(ctx, th.fruit[i % th.fruit.length], (0.2 + r() * 0.6) * W, (0.2 + r() * 0.5) * H, 14 * S, r());
    if (t === 'espaco' || t === 'plataforma' || t === 'masmorra') emoji(ctx, th.enemy, W * 0.72, H * 0.3, 14 * S);
    emoji(ctx, th.coin, W * 0.5, H * 0.45, 9 * S);
    emoji(ctx, cfg.hero, W * 0.32, H * 0.6, 22 * S);
  }

  root.MDJ = { run, thumb, TEMPLATES, emoji, rng };
})(typeof window !== 'undefined' ? window : this);
