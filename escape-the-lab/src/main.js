import * as THREE from 'three';

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sem armazenamento */ } }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fmtTime(s) { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

// ---------- Som (sintetizado, sem ficheiros) ----------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
}
function tone(freq, dur, type, vol, slide, delay) {
  if (!actx) return;
  const t0 = actx.currentTime + (delay || 0);
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(vol || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol, freq) {
  if (!actx) return;
  const len = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  f.type = 'lowpass'; f.frequency.value = freq || 600; g.gain.value = vol || 0.2;
  src.buffer = buf; src.connect(f); f.connect(g); g.connect(actx.destination); src.start();
}
const sfx = {
  pick() { tone(660, 0.12, 'sine', 0.12); tone(990, 0.2, 'sine', 0.1, 0, 0.08); },
  door() { noise(0.9, 0.25, 500); tone(110, 0.8, 'sawtooth', 0.03, 70); },
  deny() { tone(180, 0.15, 'square', 0.06); tone(140, 0.25, 'square', 0.06, 0, 0.12); },
  key() { tone(900, 0.06, 'square', 0.04); },
  ok() { [523, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, 0, i * 0.08)); },
  click() { noise(0.05, 0.3, 2500); tone(240, 0.05, 'square', 0.04); },
  power() { tone(60, 1.5, 'sawtooth', 0.06, 120); noise(0.4, 0.3, 300); [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, 'sine', 0.07, 0, 0.6 + i * 0.1)); },
  win() { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.45, 'triangle', 0.08, 0, i * 0.11)); }
};

// ---------- Mapa (cada casa = 2,5 m) ----------
// # parede · chão · G porta verde · B porta azul · D porta automática · X saída
const S = 2.5, WH = 3, EYE = 1.6, RAD = 0.3;
const MAP = [
  '###################',
  '#.....#.....#.....#',
  '#.....#.....#.....#',
  '#.....#.....#.....#',
  '###G#####D#####B###',
  '#.................X',
  '#########D#########',
  '      #.....#      ',
  '      #.....#      ',
  '      #.....#      ',
  '      #######      '
];
function cell(c, r) { return r < 0 || r >= MAP.length || c < 0 || c >= MAP[r].length ? ' ' : MAP[r][c]; }
const DOORS = {
  G: { key: 'green', name: 'verde', color: '#2ecc71', label: 'ACESSO VERDE' },
  B: { key: 'blue', name: 'azul', color: '#3b82f6', label: 'ACESSO AZUL' },
  X: { key: 'red', name: 'vermelho', color: '#ef4444', label: 'SAÍDA' },
  D: { key: null, color: '#8f9aa6', label: 'LAB-7' }
};
const CARD_COLORS = { green: 0x2ecc71, blue: 0x3b82f6, red: 0xef4444 };

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 90);
camera.rotation.order = 'YXZ';
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ---------- Texturas desenhadas em canvas ----------
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function speckle(x, w, h, n, a) {
  for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}
const TEX = {};
function makeTextures() {
  TEX.wall = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c3c8cf'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#a3aab4'; x.lineWidth = 3;
    x.strokeRect(8, 10, w / 2 - 14, h * 0.62); x.strokeRect(w / 2 + 6, 10, w / 2 - 14, h * 0.62);
    x.fillStyle = '#41a88c'; x.fillRect(0, h * 0.74, w, h * 0.035);
    x.fillStyle = '#7c848f'; x.fillRect(0, h * 0.8, w, h * 0.2);
    x.fillStyle = '#6a727c'; for (let i = 0; i < w; i += 32) x.fillRect(i, h * 0.8, 2, h * 0.2);
    speckle(x, w, h, 900, 0.06);
  });
  TEX.floor = canvasTex(256, 256, (x, w, h) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 58 + Math.floor(Math.random() * 10);
      x.fillStyle = `rgb(${v},${v + 4},${v + 8})`; x.fillRect(i * 64, j * 64, 64, 64);
    }
    x.strokeStyle = '#2a2f35'; x.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
    speckle(x, w, h, 1500, 0.08);
  });
  TEX.ceil = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#d5d9de'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#aeb4bb'; x.lineWidth = 2;
    for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
    speckle(x, w, h, 400, 0.05);
  });
  TEX.rack = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#1d232a'; x.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 18) {
      x.fillStyle = '#2b333c'; x.fillRect(8, y, w - 16, 14);
      for (let k = 0; k < 4; k++) { x.fillStyle = Math.random() < 0.6 ? '#3dff9a' : (Math.random() < 0.5 ? '#ffb02e' : '#1b5e3b'); x.fillRect(14 + k * 8, y + 5, 4, 4); }
      x.fillStyle = '#111'; x.fillRect(60, y + 4, 52, 6);
    }
  });
}
function doorTex(info) {
  return canvasTex(256, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#77808b'); g.addColorStop(0.5, '#9aa3ad'); g.addColorStop(1, '#6f7883');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5b636d'; x.fillRect(w / 2 - 2, 0, 4, h);
    x.fillStyle = info.color; x.fillRect(0, h * 0.42, w, h * 0.12);
    x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(info.label, w / 2, h * 0.48);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6;
    for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(-20 + i * 60, h * 0.95); x.lineTo(20 + i * 60, h * 0.82); x.stroke(); }
    x.fillStyle = 'rgba(255,214,0,.8)';
    for (let i = 0; i < 9; i++) { x.save(); x.translate(i * 32, h * 0.88); x.rotate(-0.6); x.fillRect(0, -6, 18, 40); x.restore(); }
    speckle(x, w, h, 500, 0.08);
  });
}
function textTex(w, h, bg, draw) { return canvasTex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); draw(x, w, h); }); }

// ---------- Mundo ----------
let scene, G;
const matCache = {};
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!matCache[k]) matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  return matCache[k];
}

function box(w, h, d, material, x, y, z, collide, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  (parent || scene).add(m);
  if (collide) G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  return m;
}
function plane(w, h, material, x, y, z, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z); m.rotation.y = rotY || 0; scene.add(m);
  return m;
}
// Caixa aberta num dos lados (cofre, cacifo): side = '+z' ou '+x'
function hollowBox(w, h, d, color, x, y, z, side) {
  const t = 0.04, m = mat(color);
  box(w, t, d, m, x, y + h / 2 - t / 2, z); box(w, t, d, m, x, y - h / 2 + t / 2, z);
  if (side === '+z') {
    box(w, h, t, m, x, y, z - d / 2 + t / 2); box(t, h, d, m, x - w / 2 + t / 2, y, z); box(t, h, d, m, x + w / 2 - t / 2, y, z);
  } else {
    box(t, h, d, m, x - w / 2 + t / 2, y, z); box(w, h, t, m, x, y, z - d / 2 + t / 2); box(w, h, t, m, x, y, z + d / 2 - t / 2);
  }
  G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
}
function interact(obj, prompt, use) { obj.userData.inter = { prompt, use }; return obj; }
function hitbox(parent, w, h, d) {
  const hb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  parent.add(hb); return hb;
}

function newGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.Fog(0x05070a, 8, 34);

  const colors = [
    { name: 'vermelho', css: '#e53935', hex: 0xe53935 }, { name: 'azul', css: '#1e88e5', hex: 0x1e88e5 },
    { name: 'verde', css: '#43a047', hex: 0x43a047 }, { name: 'amarelo', css: '#fdd835', hex: 0xfdd835 }
  ];
  const digits = colors.map(() => 1 + Math.floor(Math.random() * 9));
  const order = shuffle([0, 1, 2, 3]);
  const odd = Math.random() < 0.5;
  const target = odd ? [true, false, true, false] : [false, true, false, true];
  let breakers;
  do { breakers = [0, 1, 2, 3].map(() => Math.random() < 0.5); } while (breakers.join() === target.join());

  G = {
    colliders: [], doors: [], lights: [], emergency: [], anim: [],
    inv: { green: false, blue: false, red: false }, power: false, safeOpen: false, lockerOpen: false, exitOpen: false,
    colors, digits, order, code: order.map((i) => digits[i]).join(''), odd, target, breakers,
    x: 3.5 * S, z: 2.5 * S, yaw: Math.PI, pitch: -0.05, bob: 0, time: 0, won: false
  };

  scene.add(new THREE.HemisphereLight(0xc8d8ff, 0x262a30, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  buildStructure();
  buildQuarantine();
  buildOffice();
  buildLab();
  buildServers();
  buildCorridor();
}

function buildStructure() {
  const walls = [], floors = [];
  MAP.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '#') walls.push([c, r]);
    else if (ch !== ' ') floors.push([c, r]);
  }));
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WH, S), new THREE.MeshLambertMaterial({ map: TEX.wall }), walls.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([c, r], i) => { m4.makeTranslation((c + 0.5) * S, WH / 2, (r + 0.5) * S); wallMesh.setMatrixAt(i, m4); });
  scene.add(wallMesh);
  const fg = new THREE.PlaneGeometry(S, S); fg.rotateX(-Math.PI / 2);
  const cg = new THREE.PlaneGeometry(S, S); cg.rotateX(Math.PI / 2);
  const floor = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ map: TEX.floor }), floors.length);
  const ceil = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ map: TEX.ceil }), floors.length);
  floors.forEach(([c, r], i) => {
    m4.makeTranslation((c + 0.5) * S, 0, (r + 0.5) * S); floor.setMatrixAt(i, m4);
    m4.makeTranslation((c + 0.5) * S, WH, (r + 0.5) * S); ceil.setMatrixAt(i, m4);
  });
  scene.add(floor, ceil);

  // Portas
  MAP.forEach((row, r) => [...row].forEach((ch, c) => {
    const info = DOORS[ch]; if (!info) return;
    const spansX = cell(c, r - 1) !== '#' && cell(c, r + 1) !== '#';
    const x = (c + 0.5) * S, z = (r + 0.5) * S;
    const m = box(spansX ? S : 0.2, WH, spansX ? 0.2 : S, new THREE.MeshLambertMaterial({ map: doorTex(info) }), x, WH / 2, z);
    const door = { c, r, ch, info, mesh: m, open: false, t: 0, x, z };
    G.doors.push(door);
    if (info.key) interact(m, () => doorPrompt(door), () => useDoor(door));
  }));
}

function addLight(x, z, color, intensity, room) {
  const l = new THREE.PointLight(color, intensity, 15, 1.2);
  l.position.set(x, WH - 0.25, z); scene.add(l);
  const panel = box(1.2, 0.05, 0.6, new THREE.MeshBasicMaterial({ color: 0xffffff }), x, WH - 0.03, z);
  const item = { light: l, panel, base: intensity, room };
  G.lights.push(item);
  return item;
}

// ----- Sala 1: quarentena (início) -----
function buildQuarantine() {
  addLight(3.5 * S, 2.5 * S, 0xdfe8ff, 2.2, 'q');
  // cama
  box(1.1, 0.45, 2.1, 0x8a96a3, 1.9 * S, 0.3, 1.9 * S, true);
  box(1.0, 0.12, 2.0, 0xe6ebef, 1.9 * S, 0.58, 1.9 * S);
  box(0.8, 0.12, 0.4, 0xffffff, 1.9 * S, 0.68, 1.9 * S - 0.75);
  // secretária e diário
  box(1.6, 0.06, 0.8, 0x6d5844, 5.1 * S, 0.76, 1.45 * S, true);
  [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]].forEach(([a, b]) => box(0.06, 0.74, 0.06, 0x3d3229, 5.1 * S + a, 0.37, 1.45 * S + b));
  const note = box(0.32, 0.01, 0.42, 0xf4efe1, 5.1 * S - 0.2, 0.8, 1.45 * S);
  note.rotation.y = 0.3;
  interact(note, () => 'Ler o diário', () => showNote(
    'DIÁRIO — DIA 12\n\nDepois do acidente selaram o laboratório inteiro. Ninguém responde.\n\n' +
    'O Dr. Vasco passou por aqui ontem e esqueceu-se do cartão verde no carrinho médico. ' +
    'Com ele consigo abrir a porta da quarentena.\n\nTenho de sair daqui.'));
  // carrinho médico com o cartão verde
  box(0.7, 0.06, 1.0, 0xd0d6dc, 5.4 * S, 0.9, 3.3 * S, true);
  box(0.7, 0.06, 1.0, 0xd0d6dc, 5.4 * S, 0.35, 3.3 * S);
  [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]].forEach(([a, b]) => box(0.04, 0.9, 0.04, 0x9aa3ad, 5.4 * S + a, 0.45, 3.3 * S + b));
  box(0.2, 0.25, 0.2, 0xffffff, 5.4 * S + 0.15, 1.05, 3.3 * S - 0.3);
  addCard('green', 5.4 * S - 0.1, 0.95, 3.3 * S + 0.15);
  // armário de parede e símbolo de risco
  box(1.6, 1.0, 0.4, 0xb8c0c8, 3.5 * S, 1.9, 1 * S + 0.2);
  const hz = textTex(128, 128, '#ffd600', (x, w, h) => {
    x.fillStyle = '#111'; x.beginPath(); x.moveTo(w / 2, 14); x.lineTo(w - 12, h - 16); x.lineTo(12, h - 16); x.closePath(); x.fill();
    x.fillStyle = '#ffd600'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.fillText('!', w / 2, h - 30);
  });
  plane(0.6, 0.6, new THREE.MeshLambertMaterial({ map: hz }), 1 * S + 0.02, 1.6, 2.5 * S, Math.PI / 2);
}

// ----- Sala 2: escritório (cofre com teclado) -----
function buildOffice() {
  addLight(9.5 * S, 2.5 * S, 0xfff1dc, 2.0, 'o');
  const cx = 9.5 * S;
  box(2.2, 0.06, 0.9, 0x7a6450, cx, 0.76, 1.55 * S, true);
  box(0.06, 0.74, 0.86, 0x4a3d31, cx - 1.05, 0.37, 1.55 * S); box(0.06, 0.74, 0.86, 0x4a3d31, cx + 1.05, 0.37, 1.55 * S);
  box(0.5, 0.05, 0.5, 0x222831, cx, 0.5, 1.55 * S + 0.8, true); box(0.5, 0.6, 0.06, 0x222831, cx, 0.8, 1.55 * S + 1.05);
  // monitor com email
  const screen = textTex(256, 160, '#06231a', (x) => {
    x.fillStyle = '#7dffcf'; x.font = 'bold 18px monospace'; x.fillText('LAB-OS v3.1', 12, 26);
    x.font = '15px monospace'; x.fillText('! ENERGIA PRINCIPAL OFF', 12, 60); x.fillText('> 1 email por ler', 12, 86);
    x.fillText('> toque para abrir', 12, 112);
  });
  box(0.7, 0.45, 0.05, 0x111418, cx, 1.08, 1.55 * S - 0.2);
  const scr = plane(0.64, 0.4, new THREE.MeshBasicMaterial({ map: screen }), cx, 1.08, 1.55 * S - 0.17, 0);
  box(0.08, 0.25, 0.08, 0x111418, cx, 0.9, 1.55 * S - 0.22);
  interact(scr, () => 'Ler o email no computador', () => showNote(
    'DE: Dra. Inês Moura\nPARA: Equipa LAB-7\nASSUNTO: Cofre do escritório\n\n' +
    'Por segurança, o código do cofre já não está escrito em lado nenhum.\n\n' +
    'Sigam o protocolo de cores do quadro no laboratório. Cada cor corresponde ao número no rótulo do frasco da mesma cor.\n\n' +
    'O cartão azul (sala dos servidores) fica dentro do cofre.', true));
  // cofre
  const safeX = 11.35 * S, safeZ = 1.6 * S;
  hollowBox(0.9, 1.0, 0.8, 0x3a4048, safeX, 0.5, safeZ, '+z');
  const pivot = new THREE.Group(); pivot.position.set(safeX - 0.45, 0.5, safeZ + 0.41); scene.add(pivot);
  const sdoor = box(0.9, 0.96, 0.05, 0x4b535d, 0.45, 0, 0, false, pivot);
  box(0.25, 0.32, 0.02, 0x0f1418, 0.62, 0.15, 0.03, false, pivot);
  box(0.06, 0.2, 0.06, 0xb0b8c0, 0.2, 0, 0.05, false, pivot);
  G.safe = { pivot, x: safeX, z: safeZ };
  interact(sdoor, () => G.safeOpen ? 'Cofre aberto' : 'Usar o teclado do cofre', () => { if (!G.safeOpen) openKeypad(); });
  // estante
  box(0.45, 2.1, 2.2, 0x5a4a3c, 7 * S + 0.25, 1.05, 3 * S, true);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) {
    if (Math.random() < 0.25) continue;
    box(0.25, 0.32, 0.06 + Math.random() * 0.06, [0x8e3b3b, 0x2f5f8a, 0x4f7a3a, 0xc9a227, 0x6b4c8a][Math.floor(Math.random() * 5)],
      7 * S + 0.3, 0.3 + i * 0.5, 3 * S - 0.9 + k * 0.28);
  }
}

// ----- Sala 3: laboratório (quadro e frascos) -----
function buildLab() {
  addLight(9.5 * S, 8.5 * S, 0xe8fff6, 2.3, 'l');
  const tz = 8.3 * S;
  [8.3 * S, 10.7 * S].forEach((x) => {
    box(2.4, 0.08, 1.0, 0xf2f4f6, x, 0.92, tz, true);
    box(2.3, 0.86, 0.9, 0x5f6b77, x, 0.44, tz);
  });
  // frascos coloridos com rótulos
  G.colors.forEach((col, i) => {
    const x = 8.3 * S - 0.75 + i * 0.5;
    const flask = new THREE.Group(); flask.position.set(x, 0.96, tz);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.28, 16),
      new THREE.MeshLambertMaterial({ color: col.hex, emissive: col.hex, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }));
    glass.position.y = 0.14; flask.add(glass);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xdde6ee, transparent: true, opacity: 0.6 }));
    neck.position.y = 0.34; flask.add(neck);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), new THREE.MeshBasicMaterial({
      map: textTex(64, 48, '#ffffff', (c) => { c.fillStyle = '#111'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText(String(G.digits[i]), 32, 38); })
    }));
    label.position.set(0, 0.12, 0.13); flask.add(label);
    const back = label.clone(); back.position.z = -0.13; back.rotation.y = Math.PI; flask.add(back);
    scene.add(flask);
    hitbox(flask, 0.3, 0.5, 0.3).position.y = 0.2;
    interact(flask, () => 'Examinar o frasco ' + col.name, () => toast('Frasco ' + col.name + '. O rótulo diz: <b>' + G.digits[i] + '</b>'));
  });
  // quadro branco com a ordem das cores
  const board = textTex(512, 256, '#f7f9fb', (x, w, h) => {
    x.fillStyle = '#1b2733'; x.font = 'bold 30px sans-serif'; x.fillText('PROTOCOLO DO COFRE', 24, 46);
    x.font = '20px sans-serif'; x.fillStyle = '#516070'; x.fillText('Ler da esquerda para a direita', 24, 76);
    G.order.forEach((ci, k) => {
      x.fillStyle = G.colors[ci].css; x.beginPath(); x.arc(80 + k * 115, 150, 38, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#1b2733'; x.lineWidth = 3; x.stroke();
      if (k < 3) { x.fillStyle = '#1b2733'; x.font = 'bold 34px sans-serif'; x.fillText('→', 128 + k * 115, 162); }
    });
    x.fillStyle = '#7a8896'; x.font = 'italic 18px sans-serif'; x.fillText('cor = n.º do frasco  ·  ΔT = 4,2 K  ·  pH 7?', 24, 226);
  });
  box(3.2, 1.7, 0.06, 0x9aa3ad, 9.5 * S, 1.65, 10 * S - 0.04);
  const wb = plane(3.0, 1.5, new THREE.MeshLambertMaterial({ map: board }), 9.5 * S, 1.65, 10 * S - 0.08, Math.PI);
  interact(wb, () => 'Ver o quadro', () => toast('Quatro cores por ordem: ' + G.order.map((i) => G.colors[i].name).join(', ') + '.'));
  // nota da manutenção
  const sticky = box(0.22, 0.01, 0.22, 0xffeb7a, 10.7 * S + 0.6, 0.97, tz + 0.1);
  sticky.rotation.y = -0.4;
  interact(sticky, () => 'Ler a nota da manutenção', () => showNote(
    'MANUTENÇÃO\n\nSe a energia falhar, na sala dos servidores ligar APENAS os disjuntores ' +
    (G.odd ? 'ÍMPARES (1 e 3).' : 'PARES (2 e 4).') + '\n\nOs outros ficam desligados, senão o quadro volta a disparar!\n\n— Rui'));
  // armário e hotte decorativos
  box(1.8, 2.2, 0.6, 0xd7dde3, 7 * S + 0.9, 1.1, 7 * S + 0.35, true);
  box(1.7, 0.9, 0.04, 0x9fd3ff, 7 * S + 0.9, 1.6, 7 * S + 0.66).material = mat(0x9fd3ff, { transparent: true, opacity: 0.35 });
  box(0.6, 1.8, 0.6, 0xeceff1, 12 * S - 0.35, 0.9, 9.4 * S, true);
}

// ----- Sala 4: servidores (disjuntores e cacifo) -----
function buildServers() {
  G.serverLight = addLight(15.5 * S, 2.5 * S, 0x7fb2ff, 0.6, 's');
  const rackMat = new THREE.MeshLambertMaterial({ map: TEX.rack, emissive: 0xffffff, emissiveMap: TEX.rack, emissiveIntensity: 0.25 });
  [13.6, 14.3, 16.7, 17.4].forEach((c) => box(0.75, 2.2, 0.9, rackMat, c * S, 1.1, 1 * S + 0.5, true));
  // quadro elétrico na parede este
  const px = 18 * S - 0.06, pz = 2.5 * S;
  box(0.1, 1.1, 1.8, 0x5d6670, px, 1.5, pz);
  const lbl = textTex(256, 64, '#ffd600', (x) => { x.fillStyle = '#111'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('⚡ DISJUNTORES', 128, 42); });
  plane(1.2, 0.3, new THREE.MeshLambertMaterial({ map: lbl }), px - 0.06, 2.25, pz, -Math.PI / 2);
  G.levers = G.breakers.map((on, i) => {
    const z = pz - 0.6 + i * 0.4;
    const g = new THREE.Group(); g.position.set(px - 0.08, 1.45, z); scene.add(g);
    const handle = box(0.2, 0.06, 0.07, 0xdedede, -0.1, 0, 0, false, g);
    const led = box(0.04, 0.06, 0.06, 0x111111, -0.02, 0.3, 0, false, g);
    led.material = new THREE.MeshBasicMaterial({ color: 0x330000 });
    const num = textTex(64, 64, '#5d6670', (x) => { x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText(String(i + 1), 32, 46); });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: num }));
    n.position.set(-0.01, -0.28, 0); n.rotation.y = -Math.PI / 2; g.add(n);
    hitbox(g, 0.3, 0.5, 0.3).position.x = -0.12;
    const lever = { g, handle, led, i };
    interact(g, () => 'Disjuntor ' + (i + 1) + (G.breakers[i] ? ' (ligado)' : ' (desligado)'), () => toggleBreaker(i));
    return lever;
  });
  G.levers.forEach(updateLever);
  // cacifo eletrónico com o cartão vermelho
  const lx = 13 * S + 0.35, lz = 3 * S;
  hollowBox(0.7, 2.0, 0.9, 0x6f7b88, lx, 1.0, lz, '+x');
  box(0.62, 0.03, 0.82, 0x6f7b88, lx, 0.95, lz);
  const pivot = new THREE.Group(); pivot.position.set(lx + 0.36, 1.0, lz - 0.45); scene.add(pivot);
  const ldoor = box(0.04, 1.96, 0.9, 0x7f8c99, 0, 0, 0.45, false, pivot);
  for (let i = 0; i < 5; i++) box(0.02, 0.03, 0.5, 0x4a545e, 0.03, 0.6 + i * 0.07, 0.45, false, pivot);
  G.lockerLed = box(0.02, 0.08, 0.08, 0x111111, 0.03, 0.1, 0.8, false, pivot);
  G.lockerLed.material = new THREE.MeshBasicMaterial({ color: 0x441111 });
  G.locker = { pivot, x: lx, z: lz };
  interact(ldoor, () => G.lockerOpen ? 'Cacifo aberto' : 'Abrir o cacifo eletrónico', () => {
    if (G.lockerOpen) return;
    if (!G.power) { sfx.deny(); toast('O cacifo eletrónico não tem energia.'); return; }
    G.lockerOpen = true; sfx.door();
    G.anim.push({ obj: pivot, prop: 'y', to: Math.PI * 0.6 });
    addCard('red', lx, 0.92, lz);
    toast('O cacifo abriu. Há um cartão lá dentro!');
  });
}

// ----- Corredor -----
function buildCorridor() {
  [3, 9, 15].forEach((c) => {
    const l = addLight(c * S, 5.5 * S, 0xff2a1a, 1.6, 'c');
    l.panel.material = new THREE.MeshBasicMaterial({ color: 0xff3b2a });
    G.emergency.push(l);
  });
  // sinal de saída e luz exterior
  const sign = textTex(256, 96, '#0c7a3e', (x) => { x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.fillText('SAÍDA ➜', 128, 66); });
  plane(1.0, 0.38, new THREE.MeshBasicMaterial({ map: sign }), 17.5 * S, 2.6, 5 * S + 0.03, 0);
  plane(S, WH, new THREE.MeshBasicMaterial({ color: 0xffffff }), 19 * S - 0.01, WH / 2, 5.5 * S, -Math.PI / 2);
  G.exitLed = box(0.05, 0.2, 0.3, new THREE.MeshBasicMaterial({ color: 0x222222 }), 18.5 * S - 0.14, 2.75, 5.5 * S);
  // caixotes e placas
  box(0.9, 0.9, 0.9, 0x8a6e4b, 1.5 * S, 0.45, 5.25 * S, true);
  box(0.7, 0.7, 0.7, 0x8a6e4b, 1.5 * S + 0.1, 1.25, 5.25 * S).rotation.y = 0.4;
  const names = [[3, 'QUARENTENA'], [9, 'ESCRITÓRIO'], [15, 'SERVIDORES']];
  names.forEach(([c, n]) => {
    const t = textTex(256, 64, '#1c2630', (x) => { x.fillStyle = '#cfe3f3'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(n, 128, 42); });
    plane(1.2, 0.3, new THREE.MeshBasicMaterial({ map: t }), (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0);
  });
  const t = textTex(256, 64, '#1c2630', (x) => { x.fillStyle = '#cfe3f3'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('LABORATÓRIO', 128, 42); });
  plane(1.2, 0.3, new THREE.MeshBasicMaterial({ map: t }), 10 * S + 0.4, 2.2, 6 * S - 0.02, Math.PI);
}

function addCard(kind, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const c = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.17),
    new THREE.MeshLambertMaterial({ color: CARD_COLORS[kind], emissive: CARD_COLORS[kind], emissiveIntensity: 0.6 }));
  g.add(c);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), mat(0xffd27a)); chip.position.set(-0.07, 0.005, 0); g.add(chip);
  hitbox(g, 0.5, 0.35, 0.5);
  scene.add(g);
  const names = { green: 'verde', blue: 'azul', red: 'vermelho' };
  interact(g, () => 'Apanhar o cartão ' + names[kind], () => {
    G.inv[kind] = true; scene.remove(g); sfx.pick();
    toast('Apanhaste o <b>cartão ' + names[kind] + '</b>.');
  });
  G.anim.push({ card: g, y0: y });
}

// ---------- Lógica dos puzzles ----------
function doorPrompt(d) {
  if (d.open) return null;
  if (d.ch === 'X') return 'Porta de saída';
  return G.inv[d.info.key] ? 'Passar o cartão ' + d.info.name : 'Porta trancada (cartão ' + d.info.name + ')';
}
function useDoor(d) {
  if (d.open) return;
  if (d.ch === 'X') {
    if (!G.power) { sfx.deny(); toast('O painel da saída não tem energia.'); return; }
    if (!G.inv.red) { sfx.deny(); toast('A saída só abre com o <b>cartão vermelho</b>.'); return; }
    G.exitOpen = true; G.exitLed.material.color.set(0x22ff77);
  } else if (!G.inv[d.info.key]) { sfx.deny(); toast('Precisas do <b>cartão ' + d.info.name + '</b>.'); return; }
  d.open = true; sfx.door();
}

function updateLever(l) {
  const on = G.breakers[l.i];
  l.handle.rotation.z = on ? 0.7 : -0.7;
  l.led.material.color.set(on ? 0x33ff88 : 0x551111);
}
function toggleBreaker(i) {
  if (G.power) { toast('A energia já está ligada.'); return; }
  G.breakers[i] = !G.breakers[i]; sfx.click(); updateLever(G.levers[i]);
  if (G.breakers.join() === G.target.join()) powerOn();
}
function powerOn() {
  G.power = true; sfx.power();
  G.lights.forEach((l) => {
    l.light.color.set(l.room === 'c' ? 0xf2f6ff : l.light.color.getHex());
    l.base = l.room === 's' ? 2.2 : Math.max(l.base, 2.4);
    if (l.room === 'c') l.panel.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  });
  G.serverLight.light.color.set(0xdfe8ff);
  G.emergency = [];
  G.lockerLed.material.color.set(0x33ff88);
  G.exitLed.material.color.set(0xff3333);
  toast('⚡ Energia restabelecida!');
}

// ---------- Teclado numérico ----------
let kbuf = '';
function openKeypad() { kbuf = ''; drawKeypad(); $('keypad').classList.remove('hidden'); }
function closeKeypad() { $('keypad').classList.add('hidden'); }
function drawKeypad(err) {
  const d = $('kdisp'); d.textContent = (kbuf + '____').slice(0, 4); d.classList.toggle('err', !!err);
}
document.querySelectorAll('.keys button').forEach((b) => b.addEventListener('click', () => {
  audio(); const k = b.textContent;
  if (k === 'C') { kbuf = ''; sfx.key(); drawKeypad(); return; }
  if (k === 'OK') {
    if (kbuf === G.code) {
      sfx.ok(); closeKeypad(); G.safeOpen = true;
      G.anim.push({ obj: G.safe.pivot, prop: 'y', to: -Math.PI * 0.55 });
      addCard('blue', G.safe.x, 0.06, G.safe.z + 0.05);
      toast('O cofre abriu!');
    } else { sfx.deny(); $('kdisp').textContent = 'ERRO'; $('kdisp').classList.add('err'); kbuf = ''; }
    return;
  }
  if (kbuf.length < 4) { kbuf += k; sfx.key(); drawKeypad(); }
}));
$('kclose').addEventListener('click', closeKeypad);

// ---------- Interface ----------
let toastT = 0;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.style.opacity = 1; toastT = 3.2; }
function showNote(text, screenish) {
  $('modalText').textContent = text; $('paper').classList.toggle('screenish', !!screenish);
  $('modal').classList.remove('hidden');
}
$('modalOk').addEventListener('click', () => $('modal').classList.add('hidden'));
function modalOpen() { return !$('modal').classList.contains('hidden') || !$('keypad').classList.contains('hidden'); }

function objective() {
  const d = (ch) => G.doors.find((x) => x.ch === ch);
  if (!d('G').open) return G.inv.green ? 'Usa o cartão verde na porta da quarentena.' : 'Encontra uma forma de sair da sala de quarentena.';
  if (!G.inv.blue) return 'Explora o escritório e o laboratório. A sala dos servidores precisa do cartão azul.';
  if (!d('B').open) return 'Abre a sala dos servidores com o cartão azul.';
  if (!G.power) return 'Repõe a energia no quadro de disjuntores.';
  if (!G.inv.red) return 'Com energia, o cacifo eletrónico já abre.';
  return 'Foge pela SAÍDA ao fundo do corredor!';
}

let state = 'menu';
function setState(s) {
  state = s;
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('win').classList.toggle('hidden', s !== 'win');
  $('hud').classList.toggle('hidden', s !== 'play');
  if (s !== 'play') { resetInput(); if (document.pointerLockElement) document.exitPointerLock(); }
}
function showBest() { const b = parseFloat(load('etl_best')); $('bestTxt').textContent = b ? 'Melhor tempo: ' + fmtTime(b) : ''; }
$('playBtn').addEventListener('click', () => { audio(); newGame(); setState('play'); toast('Arrasta à esquerda para andar e à direita para olhar.'); });
$('againBtn').addEventListener('click', () => { audio(); newGame(); setState('play'); });
$('pauseBtn').addEventListener('click', () => setState('pause'));
$('resumeBtn').addEventListener('click', () => setState('play'));
$('quitBtn').addEventListener('click', () => { showBest(); setState('menu'); });
$('use').addEventListener('click', () => doInteract());
showBest();

// Ganchos chamados pela app Android
window.olPause = () => { if (state === 'play') setState('pause'); };
window.olBack = () => {
  if (!$('keypad').classList.contains('hidden')) { closeKeypad(); return true; }
  if (!$('modal').classList.contains('hidden')) { $('modal').classList.add('hidden'); return true; }
  if (state === 'play') { setState('pause'); return true; }
  if (state === 'pause' || state === 'win') { showBest(); setState('menu'); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => { if (document.hidden) window.olPause(); });

// ---------- Controlos ----------
const keys = {};
const joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
const look = { id: null, x: 0, y: 0 };
function resetInput() { joy.id = null; joy.x = joy.y = 0; look.id = null; $('joy').classList.add('hidden'); for (const k in keys) keys[k] = false; }
const touchEl = $('touch');
touchEl.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || modalOpen()) return;
  audio();
  if (e.pointerType === 'mouse') {
    if (!document.pointerLockElement && touchEl.requestPointerLock) { try { touchEl.requestPointerLock(); } catch (err) { /* sem pointer lock */ } }
    else if (document.pointerLockElement) { doInteract(); return; }
  }
  touchEl.setPointerCapture(e.pointerId);
  if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY;
    const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.classList.remove('hidden');
    $('knob').style.transform = '';
  } else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
});
touchEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = (e.clientX - joy.x0) / 50, dy = (e.clientY - joy.y0) / 50;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    joy.x = dx; joy.y = dy; $('knob').style.transform = `translate(${dx * 32}px,${dy * 32}px)`;
  } else if (e.pointerId === look.id && !document.pointerLockElement) {
    const k = e.pointerType === 'mouse' ? 0.004 : 0.006;
    turn((e.clientX - look.x) * k, (e.clientY - look.y) * k);
    look.x = e.clientX; look.y = e.clientY;
  }
});
function endPointer(e) {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').classList.add('hidden'); }
  if (e.pointerId === look.id) look.id = null;
}
touchEl.addEventListener('pointerup', endPointer);
touchEl.addEventListener('pointercancel', endPointer);
document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === touchEl && state === 'play') turn(e.movementX * 0.0025, e.movementY * 0.0025); });
function turn(dx, dy) { G.yaw -= dx; G.pitch = Math.max(-1.3, Math.min(1.3, G.pitch - dy)); }
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (state !== 'play') return;
  if (e.code === 'KeyE' || e.code === 'Enter') { if (!modalOpen()) doInteract(); }
  if (e.code === 'Escape' && modalOpen()) window.olBack();
  if (e.code === 'KeyP') setState('pause');
  if (!$('keypad').classList.contains('hidden') && /^Digit\d$/.test(e.code) && kbuf.length < 4) { kbuf += e.code.slice(5); sfx.key(); drawKeypad(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ---------- Interação por mira ----------
const ray = new THREE.Raycaster(); ray.far = 2.6;
let target = null;
function findTarget() {
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const hits = ray.intersectObjects(scene.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.inter) o = o.parent;
    if (o) { const p = o.userData.inter.prompt(); return p ? { o, p } : null; }
    return null; // o primeiro objeto atingido tapa os outros
  }
  return null;
}
function doInteract() { if (target && state === 'play' && !modalOpen()) target.o.userData.inter.use(); }

// ---------- Física simples ----------
function solidCell(c, r) {
  const ch = cell(c, r);
  if (ch === '#' || ch === ' ') return !(ch === ' ' && G.exitOpen && c === 19 && r === 5);
  const d = G.doors.find((x) => x.c === c && x.r === r);
  return d ? d.t < 0.85 : false;
}
function blocked(x, z) {
  const c0 = Math.floor((x - RAD) / S), c1 = Math.floor((x + RAD) / S), r0 = Math.floor((z - RAD) / S), r1 = Math.floor((z + RAD) / S);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!solidCell(c, r)) continue;
    const nx = Math.max(c * S, Math.min(x, (c + 1) * S)), nz = Math.max(r * S, Math.min(z, (r + 1) * S));
    if ((x - nx) ** 2 + (z - nz) ** 2 < RAD * RAD) return true;
  }
  for (const b of G.colliders) {
    const nx = Math.max(b.x0, Math.min(x, b.x1)), nz = Math.max(b.z0, Math.min(z, b.z1));
    if ((x - nx) ** 2 + (z - nz) ** 2 < RAD * RAD) return true;
  }
  return false;
}

// ---------- Ciclo principal ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G) update(dt);
  if (scene) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function update(dt) {
  const T = performance.now() / 1000;
  // animações (portas, cofre, cartões)
  for (const d of G.doors) {
    if (!d.open && !d.info.key && Math.hypot(G.x - d.x, G.z - d.z) < 3.2) { d.open = true; sfx.door(); }
    const to = d.open ? 1 : 0; d.t += (to - d.t) * Math.min(1, dt * 2.2);
    d.mesh.position.y = WH / 2 + d.t * (WH - 0.12);
  }
  for (const a of G.anim) {
    if (a.card) { a.card.position.y = a.y0 + 0.06 + Math.sin(T * 2.5) * 0.03; a.card.rotation.y += dt * 1.2; }
    else a.obj.rotation[a.prop] += (a.to - a.obj.rotation[a.prop]) * Math.min(1, dt * 3);
  }
  for (const l of G.lights) l.light.intensity = l.base;
  for (const l of G.emergency) l.light.intensity = l.base * (0.45 + 0.55 * Math.abs(Math.sin(T * 2.2)));
  if (G.serverLight && !G.power) G.serverLight.light.intensity = 0.6 * (Math.random() < 0.04 ? 0.2 : 1);

  if (state === 'play' && !modalOpen()) {
    G.time += dt;
    let f = -joy.y, s = joy.x;
    if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyD) s += 1; if (keys.KeyA) s -= 1;
    if (keys.ArrowLeft) turn(-dt * 2, 0); if (keys.ArrowRight) turn(dt * 2, 0);
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const sp = 3.2 * dt, sin = Math.sin(G.yaw), cos = Math.cos(G.yaw);
    const mx = (-sin * f + cos * s) * sp, mz = (-cos * f - sin * s) * sp;
    if (!blocked(G.x + mx, G.z)) G.x += mx;
    if (!blocked(G.x, G.z + mz)) G.z += mz;
    if (len > 0.1) G.bob += dt * 9 * Math.min(1, len);
    if (G.exitOpen && G.x > 18.3 * S && !G.won) win();
  }
  camera.position.set(G.x, EYE + Math.sin(G.bob) * 0.035, G.z);
  camera.rotation.set(G.pitch, G.yaw, 0);

  if (state === 'play') {
    target = modalOpen() ? null : findTarget();
    $('prompt').classList.toggle('hidden', !target); $('use').classList.toggle('hidden', !target);
    $('cross').classList.toggle('hot', !!target);
    if (target) $('prompt').textContent = target.p;
    $('timer').textContent = fmtTime(G.time);
    $('objText').textContent = objective();
    ['green', 'blue', 'red'].forEach((k) => $('inv-' + k).classList.toggle('on', G.inv[k]));
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  }
}
function win() {
  G.won = true; sfx.win();
  const best = parseFloat(load('etl_best'));
  const rec = !best || G.time < best;
  if (rec) save('etl_best', G.time.toFixed(1));
  $('winTxt').innerHTML = 'Saíste do laboratório em <b>' + fmtTime(G.time) + '</b>.' + (rec ? '<br>Novo recorde!' : '<br>Melhor tempo: ' + fmtTime(best));
  setState('win');
}

makeTextures();
newGame();
G.yaw = 0.6; // vista do menu
requestAnimationFrame(frame);

// Ganchos para testes automáticos
window.etl = { get G() { return G; }, get state() { return state; }, teleport(x, z, yaw, pitch) { G.x = x * S; G.z = z * S; G.yaw = yaw; G.pitch = pitch || 0; }, interact: doInteract, get target() { return target && target.p; } };
