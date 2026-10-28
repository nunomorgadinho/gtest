import * as THREE from 'three';
import { snd } from './audio.js';
import { SECTORS } from './sectors.js';
import { SECTORS2 } from './sectors2.js';

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) { /* sem armazenamento */ } }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function fmtTime(s) { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }


// ---------- Mundo (cada casa = 2,5 m) ----------
const S = 2.5, WH = 3, EYE = 1.6, RAD = 0.3;

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 90);
camera.rotation.order = 'YXZ';
// Lanterna presa à câmara
const flash = new THREE.SpotLight(0xffe9c8, 9, 18, 0.5, 0.55, 1.4);
flash.position.set(0.15, -0.1, 0); flash.target.position.set(0, -0.05, -1);
camera.add(flash, flash.target);

// Pós-processamento: tone mapping, aberração cromática, vinheta e grão
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const post = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      float ca = 0.012 * r2;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d * ca * 2.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * ca * 2.0).b);
      c = aces(c * 1.6);
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 0.88) * vec3(0.97, 1.02, 1.0);
      c = pow(c, vec3(1.0 / 2.2));
      c *= mix(1.0, smoothstep(0.95, 0.25, length(d * vec2(1.15, 1.0))), 0.85);
      c += (hash(vUv * res + fract(time) * 91.7) - 0.5) * 0.07;
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const pr = renderer.getPixelRatio();
  rt.setSize(Math.floor(window.innerWidth * pr), Math.floor(window.innerHeight * pr));
  post.uniforms.res.value.set(window.innerWidth * pr, window.innerHeight * pr);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// Qualidade gráfica: 'alta' (pós-processamento) ou 'leve' (render direto, menos píxeis)
let quality = load('etl_q') === 'leve' ? 'leve' : 'alta';
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(quality === 'alta' ? Math.min(dpr, 1.25) : Math.min(dpr, 0.85));
  renderer.toneMapping = quality === 'alta' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  if (scene) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  $('qBtn').textContent = 'GRÁFICOS: ' + (quality === 'alta' ? 'ALTA' : 'LEVE');
  resize();
}
function drawSnd() { const t = 'SOM: ' + (load('etl_mute') === '1' ? 'DESLIGADO' : 'LIGADO'); $('sndBtn').textContent = t; $('sndBtn2').textContent = t; }
function toggleSnd() { const m = load('etl_mute') !== '1'; save('etl_mute', m ? '1' : '0'); snd.setMuted(m); drawSnd(); }
$('sndBtn').addEventListener('click', toggleSnd); $('sndBtn2').addEventListener('click', toggleSnd);
drawSnd();
$('qBtn').addEventListener('click', () => { quality = quality === 'alta' ? 'leve' : 'alta'; save('etl_q', quality); applyQuality(); });
applyQuality();

// ---------- Texturas procedimentais (ruído + mapas de relevo) ----------
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// Ruído de valor tileável e fBm
function valueNoise(p) {
  const g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = Math.random();
  return (x, y) => {
    const fx = x * p, fy = y * p, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const xa = ((x0 % p) + p) % p, xb = (xa + 1) % p, ya = ((y0 % p) + p) % p, yb = (ya + 1) % p;
    const a = g[ya * p + xa], b = g[ya * p + xb], c = g[yb * p + xa], d = g[yb * p + xb];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function fbm(base, oct) {
  const ns = []; for (let o = 0; o < oct; o++) ns.push(valueNoise(base << o));
  return (x, y) => { let s = 0, amp = 0.5, tot = 0; for (const n of ns) { s += n(x, y) * amp; tot += amp; amp *= 0.5; } return s / tot; };
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const frac = (v) => v - Math.floor(v);
// Gera cor + relevo por píxel; devolve { map, normalMap, cv }
function genTex(size, fn, strength, post) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), hgt = new Float32Array(size * size);
  const o = [0, 0, 0, 0];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    fn(x / size, y / size, o);
    const i = y * size + x;
    img.data[i * 4] = o[0]; img.data[i * 4 + 1] = o[1]; img.data[i * 4 + 2] = o[2]; img.data[i * 4 + 3] = 255;
    hgt[i] = o[3];
  }
  ctx.putImageData(img, 0, 0);
  if (post) post(ctx, size);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  const ncv = document.createElement('canvas'); ncv.width = ncv.height = size;
  const nctx = ncv.getContext('2d'), nimg = nctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (xx, yy) => hgt[((yy + size) % size) * size + ((xx + size) % size)];
    let nx = (h(x - 1, y) - h(x + 1, y)) * strength, ny = (h(x, y - 1) - h(x, y + 1)) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (-ny * 0.5 + 0.5) * 255; nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const normalMap = new THREE.CanvasTexture(ncv);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  return { map, normalMap, cv };
}
function radiation(x, cx, cy, r, color) {
  x.save(); x.translate(cx, cy); x.fillStyle = color;
  for (let k = 0; k < 3; k++) {
    x.beginPath(); x.moveTo(0, 0);
    x.arc(0, 0, r, -Math.PI / 2 + k * 2 * Math.PI / 3 - Math.PI / 6, -Math.PI / 2 + k * 2 * Math.PI / 3 + Math.PI / 6);
    x.closePath(); x.fill();
  }
  x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill();
  x.globalCompositeOperation = 'source-over'; x.beginPath(); x.arc(0, 0, r * 0.18, 0, 7); x.fill();
  x.restore();
}
function hazardStripes(x, w, h, step) {
  x.fillStyle = '#d9a514'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#16140f';
  for (let i = -h; i < w + h; i += step * 2) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + step, h); x.lineTo(i + step + h, 0); x.lineTo(i + h, 0); x.closePath(); x.fill(); }
}
const TEX = {};
let GRIME = null;
function makeTextures() {
  const n1 = fbm(4, 6), n2 = fbm(2, 4), n3 = fbm(16, 3), streak = fbm(8, 4), n4 = fbm(3, 5);
  // Chão de betão gasto com juntas, manchas e fissuras
  TEX.floor = genTex(512, (u, v, o) => {
    const n = n1(u, v), st = n2(u, v), fine = n3(u, v);
    let c = 34 + 52 * n + 14 * fine;
    if (st > 0.58) c *= 1 - (st - 0.58) * 1.6;
    const crack = Math.abs(n1(u * 0.5 + 0.3, v * 0.5) - 0.5) < 0.006 ? 1 : 0;
    const seam = frac(u * 2) < 0.006 || frac(v * 2) < 0.006 ? 1 : 0;
    if (crack || seam) c *= 0.45;
    o[0] = c * 0.86; o[1] = c * 0.97; o[2] = c * 0.93; o[3] = n * 0.8 + fine * 0.3 - crack - seam * 0.8;
  }, 2.2);
  // Paredes: painéis de metal escuros com rebites, ferrugem a escorrer e sujidade em baixo
  TEX.wall = genTex(512, (u, v, o) => {
    const n = n1(u, v), fine = n3(u, v), px = frac(u * 2), py = frac(v * 1.6);
    const seam = px < 0.012 || px > 0.988 || py < 0.015 || py > 0.985;
    const rx = Math.min(px, 1 - px), ry = Math.min(py, 1 - py);
    const rivet = (Math.hypot(rx - 0.05, ry - 0.06) < 0.018) || (Math.hypot(rx - 0.05, ry - 0.5) < 0.018 && rx < 0.1);
    let r = 52 + 30 * n + 10 * fine, g = 60 + 30 * n + 10 * fine, b = 66 + 28 * n + 10 * fine;
    const rust = clamp01((streak(u * 1, v * 0.12) - 0.55) * 4) * clamp01(1 - v * 0.9) + clamp01((n2(u, v) - 0.62) * 3);
    r += rust * 45; g += rust * 8; b -= rust * 20;
    const grime = clamp01((v - 0.72) * 3.5);
    r *= 1 - grime * 0.55; g *= 1 - grime * 0.5; b *= 1 - grime * 0.5;
    let h = n * 0.4 + fine * 0.2;
    if (seam) { r *= 0.35; g *= 0.35; b *= 0.35; h -= 1; }
    if (rivet) { r += 40; g += 40; b += 40; h += 1.2; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = h;
  }, 2.5);
  // Teto enferrujado
  TEX.ceil = genTex(256, (u, v, o) => {
    const n = n1(u, v), f = n3(u, v), sp = n2(u * 2, v * 2);
    let r = 70 + 70 * n + 20 * f, g = 44 + 40 * n + 10 * f, b = 30 + 24 * n;
    if (sp > 0.6) { r *= 0.6; g *= 0.6; b *= 0.6; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = n + f * 0.5;
  }, 3);
  // Barril amarelo com o símbolo de radiação
  TEX.barrel = genTex(512, (u, v, o) => {
    const n = n1(u, v), f = n3(u, v);
    const rib = Math.abs(v - 0.3) < 0.012 || Math.abs(v - 0.7) < 0.012;
    let r = 190 + 40 * n, g = 150 + 30 * n, b = 30 + 20 * n;
    const wear = clamp01((n2(u * 2, v) - 0.6) * 3) + clamp01((Math.abs(v - 0.5) - 0.42) * 12);
    r = r * (1 - wear) + 70 * wear; g = g * (1 - wear) + 52 * wear; b = b * (1 - wear) + 40 * wear;
    r *= 0.8 + f * 0.25; g *= 0.8 + f * 0.25;
    o[0] = rib ? r * 0.6 : r; o[1] = rib ? g * 0.6 : g; o[2] = b; o[3] = (rib ? 1 : 0) + n * 0.4;
  }, 2, (x, s) => {
    x.globalAlpha = 0.85; radiation(x, s * 0.25, s * 0.5, s * 0.1, '#191510'); radiation(x, s * 0.75, s * 0.5, s * 0.1, '#191510');
    x.globalAlpha = 1;
  });
  // Caixote metálico amarelo
  TEX.crate = genTex(256, (u, v, o) => {
    const n = n1(u, v), edge = Math.min(u, v, 1 - u, 1 - v) < 0.07;
    let r = 175 + 50 * n, g = 135 + 40 * n, b = 30 + 20 * n;
    const dirt = clamp01((n2(u, v) - 0.5) * 2.5);
    r *= 1 - dirt * 0.6; g *= 1 - dirt * 0.6;
    if (edge) { r *= 0.55; g *= 0.55; b *= 0.6; }
    o[0] = r; o[1] = g; o[2] = b; o[3] = (edge ? 1 : 0) + n * 0.3;
  }, 2, (x, s) => { x.globalAlpha = 0.8; radiation(x, s / 2, s / 2, s * 0.22, '#1d1810'); x.globalAlpha = 1; });
  // Tubos de metal
  TEX.pipe = genTex(256, (u, v, o) => {
    const n = n1(u, v), ring = frac(u * 4) < 0.03;
    let c = 40 + 40 * n;
    const rust = clamp01((n2(u, v) - 0.55) * 3);
    o[0] = c + rust * 40; o[1] = c * 1.05; o[2] = c * 1.1 - rust * 15; o[3] = n * 0.5 + (ring ? 1 : 0);
  }, 2);
  // Líquido luminoso dos tanques (animado deslocando a textura)
  TEX.liquid = genTex(256, (u, v, o) => {
    const n = n4(u, v);
    const c = 90 + 165 * Math.pow(n, 1.6);
    o[0] = c; o[1] = c; o[2] = c; o[3] = 0;
  }, 0);
  // Faixa de perigo e grelha das luzes
  TEX.hazard = canvasTex(256, 32, (x, w, h) => { hazardStripes(x, w, h, 16); });
  TEX.hazard.wrapS = THREE.RepeatWrapping;
  TEX.grate = canvasTex(128, 64, (x, w, h) => {
    x.fillStyle = '#fff6dc'; x.fillRect(0, 0, w, h); x.fillStyle = '#222';
    for (let i = 0; i < w; i += 16) x.fillRect(i, 0, 5, h);
    x.fillRect(0, 0, w, 6); x.fillRect(0, h - 6, w, 6);
  });
  TEX.rack = canvasTex(128, 256, (x, w, h) => {
    x.fillStyle = '#15191e'; x.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 18) {
      x.fillStyle = '#232a31'; x.fillRect(8, y, w - 16, 14);
      for (let k = 0; k < 4; k++) { x.fillStyle = Math.random() < 0.6 ? '#3dff9a' : (Math.random() < 0.5 ? '#ffb02e' : '#1b5e3b'); x.fillRect(14 + k * 8, y + 5, 4, 4); }
      x.fillStyle = '#0a0a0a'; x.fillRect(60, y + 4, 52, 6);
    }
  });
  TEX.asphalt = genTex(256, (u, v, o) => { const n = n3(u, v), m = n1(u, v); const c = 22 + 22 * n + 12 * m; o[0] = c; o[1] = c; o[2] = c * 1.05; o[3] = n; }, 1.5);
  TEX.glow = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,.35)'); g.addColorStop(0.55, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  GRIME = genTex(256, (u, v, o) => { const n = n1(u, v), f = n3(u, v); const c = 150 + 105 * clamp01(n * 0.7 + f * 0.5 - 0.1); o[0] = c; o[1] = c * 0.97; o[2] = c * 0.92; o[3] = 0; }, 0).cv;
}
function doorTex(info) {
  return canvasTex(256, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#4a525b'); g.addColorStop(0.5, '#69727c'); g.addColorStop(1, '#454d56');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#2b3036'; x.lineWidth = 6; x.strokeRect(14, 14, w / 2 - 20, h - 28); x.strokeRect(w / 2 + 6, 14, w / 2 - 20, h - 28);
    x.fillStyle = '#23272c'; x.fillRect(w / 2 - 3, 0, 6, h);
    x.fillStyle = '#3a4048'; x.beginPath(); x.arc(w / 2, h * 0.3, 34, 0, 7); x.fill();
    x.strokeStyle = '#2b3036'; x.lineWidth = 6; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(w / 2, h * 0.3); x.lineTo(w / 2 + Math.cos(k * 1.57 + 0.78) * 34, h * 0.3 + Math.sin(k * 1.57 + 0.78) * 34); x.stroke(); }
    x.fillStyle = info.color; x.globalAlpha = 0.85; x.fillRect(0, h * 0.48, w, h * 0.1); x.globalAlpha = 1;
    x.fillStyle = '#fff'; x.font = 'bold 24px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(info.label, w / 2, h * 0.53);
    x.save(); x.translate(0, h * 0.84); hazardStripes(x, w, h * 0.12, 18); x.restore();
    x.globalCompositeOperation = 'multiply'; x.drawImage(GRIME, 0, 0, w, h); x.globalCompositeOperation = 'source-over';
  });
}
function textTex(w, h, bg, draw) { return canvasTex(w, h, (x) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); draw(x, w, h); }); }

// ---------- Mundo ----------
let scene, G;
const matCache = {};
function mat(color, extra) {
  const k = color + JSON.stringify(extra || {});
  if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.15 }, extra || {}));
  return matCache[k];
}

function box(w, h, d, material, x, y, z, collide, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'number' ? mat(material) : material);
  m.position.set(x, y, z);
  (parent || scene).add(m);
  if (collide) G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: y + h / 2 });
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
  G.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: y + h / 2 });
}
function interact(obj, prompt, use) { obj.userData.inter = { prompt, use }; return obj; }
function hitbox(parent, w, h, d) {
  const hb = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  parent.add(hb); return hb;
}

// ---------- Pormenores industriais ----------
function glowSprite(x, y, z, color, size, opacity) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  sp.position.set(x, y, z); sp.scale.set(size, size, 1); scene.add(sp);
  return sp;
}
let pipeMat = null;
function pipe(axis, a0, a1, y, c, r) {
  if (!pipeMat) pipeMat = new THREE.MeshStandardMaterial({ map: TEX.pipe.map, normalMap: TEX.pipe.normalMap, roughness: 0.45, metalness: 0.7 });
  const len = a1 - a0, m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14, 1, true), pipeMat);
  m.rotation.z = Math.PI / 2;
  if (axis === 'x') m.position.set((a0 + a1) / 2, y, c);
  else { m.rotation.set(Math.PI / 2, 0, 0); m.position.set(c, y, (a0 + a1) / 2); }
  scene.add(m);
  for (let p = a0 + 1; p < a1; p += 2.5) {
    const bx = axis === 'x' ? p : c, bz = axis === 'x' ? c : p;
    box(axis === 'x' ? 0.08 : r * 2.6, 0.05, axis === 'x' ? r * 2.6 : 0.08, mat(0x2a2e33, { metalness: 0.6 }), bx, y + r + 0.02, bz);
    box(0.05, WH - y - r, 0.05, mat(0x2a2e33, { metalness: 0.6 }), bx, (WH + y + r) / 2, bz);
  }
}
function barrel(x, z, rot) {
  const side = new THREE.MeshStandardMaterial({ map: TEX.barrel.map, normalMap: TEX.barrel.normalMap, roughness: 0.55, metalness: 0.35 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 24), [side, mat(0x6b5418, { metalness: 0.4 }), mat(0x3a2e10)]);
  m.position.set(x, 0.45, z); m.rotation.y = rot || 0; scene.add(m);
  G.colliders.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3 });
}
function tank(x, z, color, h, r, light) {
  const metal = mat(0x2b3036, { metalness: 0.75, roughness: 0.4 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.08, r + 0.12, 0.25, 20), metal); base.position.set(x, 0.125, z);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.12, r + 0.08, 0.3, 20), metal); top.position.set(x, h + 0.1, z);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.94, h - 0.3, 20, 1, true), new THREE.MeshBasicMaterial({ map: TEX.liquid.map, color: new THREE.Color(color).multiplyScalar(0.7) }));
  liquid.position.set(x, 0.25 + (h - 0.3) / 2, z);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h - 0.25, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18 }));
  glass.position.copy(liquid.position);
  scene.add(base, top, liquid, glass);
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + 0.4;
    box(0.05, h - 0.25, 0.05, metal, x + Math.cos(a) * (r + 0.03), liquid.position.y, z + Math.sin(a) * (r + 0.03));
  }
  glowSprite(x, liquid.position.y, z, color, r * 6, 0.35);
  G.colliders.push({ x0: x - r - 0.1, x1: x + r + 0.1, z0: z - r - 0.1, z1: z + r + 0.1, h: h });
  soundWorld.tanks.push([x, z, roomOf(x, z)]);
  if (light) {
    const l = new THREE.PointLight(color, light * 2.5, 10, 1.3); l.position.set(x, h * 0.6, z); scene.add(l);
    G.tanks.push({ light: l, base: light * 2.5, ph: Math.random() * 6 });
  }
}
function hazardBand(w, d, x, y, z) {
  const m = new THREE.MeshStandardMaterial({ map: TEX.hazard.clone(), roughness: 0.7 });
  m.map.repeat.set(w * 2, 1); m.map.needsUpdate = true;
  box(w + 0.02, 0.16, d + 0.02, m, x, y, z);
}

// ---------- Itens ----------
const ITEMS = {
  green: { name: 'cartão verde', short: 'Verde', color: 0x2ecc71, css: '#2ecc71', kind: 'card' },
  blue: { name: 'cartão azul', short: 'Azul', color: 0x3b82f6, css: '#3b82f6', kind: 'card' },
  red: { name: 'cartão vermelho', short: 'Verm.', color: 0xef4444, css: '#ef4444', kind: 'card' },
  fuse: { name: 'fusível', short: 'Fusível', color: 0xf5a623, css: '#f5a623', kind: 'fuse' },
  uv: { name: 'lâmpada UV', short: 'UV', color: 0x8a5cff, css: '#8a5cff', kind: 'uv' },
  key: { name: 'chave de manutenção', short: 'Chave', color: 0xc0c6cc, css: '#c0c6cc', kind: 'key' },
  valve: { name: 'manípulo da válvula', short: 'Válvula', color: 0x4fc3f7, css: '#4fc3f7', kind: 'valve' },
  contrast: { name: 'frasco de contraste', short: 'Contraste', color: 0xffd27a, css: '#ffd27a', kind: 'fuse' }
};
function itemMesh(kind, color) {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6 });
  if (kind === 'card') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.17), glowMat));
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), mat(0xffd27a)); chip.position.set(-0.07, 0.005, 0); g.add(chip);
  } else if (kind === 'fuse') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), glowMat); body.rotation.z = Math.PI / 2; g.add(body);
    [-0.1, 0.1].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), mat(0xb8bec4, { metalness: 0.9 })); c.rotation.z = Math.PI / 2; c.position.x = x; g.add(c); });
  } else if (kind === 'uv') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 12), mat(0x2a2633, { metalness: 0.6 })); body.rotation.z = Math.PI / 2; g.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.05, 12), glowMat); lens.rotation.z = Math.PI / 2; lens.position.x = 0.13; g.add(lens);
  } else if (kind === 'key') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.04), glowMat); g.add(h);
    const head = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.015, 8, 16), glowMat); head.rotation.x = Math.PI / 2; head.position.x = 0.14; g.add(head);
  } else {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 24), glowMat); wheel.rotation.x = Math.PI / 2; g.add(wheel);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.02), glowMat); sp.rotation.y = k * Math.PI / 3; g.add(sp); }
  }
  return g;
}
function addItem(id, x, y, z, onPick) {
  const it = ITEMS[id], g = itemMesh(it.kind, it.color);
  g.position.set(x, y, z); hitbox(g, 0.5, 0.35, 0.5); scene.add(g);
  interact(g, () => 'Apanhar: ' + it.name, () => {
    G.inv[id] = true; scene.remove(g); snd.pick(); renderInv();
    toast('Apanhaste: <b>' + it.name + '</b>.');
    if (onPick) onPick();
  });
  G.anim.push({ card: g, y0: y });
  return g;
}
// Fragmentos do código Ómega (um por setor; o último setor pede os quatro)
function fragment(n, x, y, z, story) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const C = CHAP();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.3), new THREE.MeshLambertMaterial({ color: 0xf4efe1, emissive: C.fragColor, emissiveIntensity: 0.25 }));
  g.add(paper); hitbox(g, 0.5, 0.35, 0.5); scene.add(g);
  const halo = glowSprite(x, y + 0.1, z, C.fragColor, 0.8, 0.35);
  interact(g, () => 'Apanhar ' + C.fragItem, () => {
    CH.found[n - 1] = true; scene.remove(g); scene.remove(halo); snd.pick(); renderInv(); saveChapter();
    showNote(C.fragName + ' ' + n + '/' + CH.frags.length + '\n\nDígito: ' + CH.frags[n - 1] + '\n\n' + story);
  });
  G.anim.push({ card: g, y0: y });
}
function renderInv() {
  const html = Object.keys(ITEMS).filter((k) => G.inv[k]).map((k) =>
    '<div class="it" style="--c:' + ITEMS[k].css + '"><i></i>' + ITEMS[k].short + '</div>');
  CH.found.forEach((f, i) => { if (f) html.push('<div class="frag">' + CHAP().fragLabel + (i + 1) + '·' + CH.frags[i] + '</div>'); });
  $('inv').innerHTML = html.join('');
  $('uvBtn').classList.toggle('hidden', !G.inv.uv);
}

// ---------- Setores ----------
let SEC = null, secIdx = 0, CH = null;
const AUTO_DOOR = { label: 'LAB-7', color: '#8f9aa6', auto: true };
function cell(c, r) { const M = SEC.map; return r < 0 || r >= M.length || c < 0 || c >= M[r].length ? ' ' : M[r][c]; }
// Sala onde está um ponto (para abafar sons de outras salas)
function roomOf(x, z) {
  if (!SEC) return null;
  const c = Math.floor(x / S), r = Math.floor(z / S);
  for (const [id, c0, r0, c1, r1] of SEC.rooms || []) if (c >= c0 && c <= c1 && r >= r0 && r <= r1) return id;
  return 'c';
}
let soundWorld = null;
function audio() { snd.init(roomOf, soundWorld, load('etl_mute') === '1'); }

// ---------- Capítulos ----------
const CHAPTERS = {
  1: {
    sectors: SECTORS, fragLabel: 'Ω', fragName: 'FRAGMENTO ÓMEGA', fragItem: 'o documento Ω', fragColor: 0x7dffcf, frags: 4,
    endText: 'O LAB-7 ainda não acabou contigo.', next: 'CAPÍTULO 2 — JÁ DISPONÍVEL NO MENU',
    ending: [
      [0, 'O elevador começa a subir.', 'elevator'], [3500, 'Nível −6 … −5 … −4 …'], [7600, 'De repente, para.', 'sting'],
      [10200, 'As luzes apagam-se. Só se ouve o zumbido do altifalante.', 'radio'],
      [14200, '«Muito bem, Sujeito 12. Exatamente como previsto.»', 'radio'],
      [18200, '«Teste 7 concluído. Preparem a sala para o Teste 8.»', 'radio'],
      [22400, 'Sentes uma picada no pescoço. O chão foge-te dos pés…', 'sting']
    ]
  },
  2: {
    sectors: SECTORS2, fragLabel: 'M', fragName: 'MEMÓRIA', fragItem: 'a memória', fragColor: 0xffb070, frags: 6,
    endText: 'Agora sabes quem és. Falta saber o que vais fazer com isso.', next: 'CAPÍTULO 3 — EM BREVE',
    ending: [
      [0, 'A porta da sala de observação abre-se devagar.', 'door'],
      [3800, 'Dezenas de monitores. Num deles, a sala de quarentena do setor A.'],
      [7800, 'Alguém acorda na cama. Na pulseira lê-se: SUJEITO 13.', 'sting'],
      [12000, 'Na cadeira do observador há uma placa: «Dr. Tomás Reis, Investigador Principal, Projeto Ómega».'],
      [16500, 'A fotografia na placa é a tua.'],
      [20000, '«Sempre foste tu, Tomás», diz a voz da Dra. Moura. «Criaste o Ómega para apagar memórias. Começaste pela tua.»', 'radio'],
      [26000, '«O Teste 8 acabou. A partir de agora, és tu quem observa.»', 'radio'],
      [30500, 'As portas trancam-se atrás de ti. No ecrã principal pisca uma pergunta: INICIAR TESTE 9?', 'sting']
    ]
  }
};
const CHAP = () => CHAPTERS[CH.ch];
function newChapter(n) {
  const c = CHAPTERS[n || 1];
  CH = { ch: n || 1, sec: 0, frags: new Array(c.frags).fill(0).map(() => Math.floor(Math.random() * 10)), found: new Array(c.frags).fill(false), time: 0 };
}
function saveChapter() { if (CH) save('etl_save_c' + CH.ch, JSON.stringify({ ch: CH.ch, sec: secIdx, frags: CH.frags, found: CH.found, time: CH.time })); }
function loadChapter(n) {
  try {
    let raw = load('etl_save_c' + n);
    if (!raw && n === 1) raw = load('etl_save'); // gravações antigas (antes dos capítulos)
    const s = JSON.parse(raw); return s && s.frags ? Object.assign({ ch: n }, s) : null;
  } catch (e) { return null; }
}


function loadSector(i, preview) {
  secIdx = i; SEC = CHAP().sectors[i]; CH.sec = i;
  if (SEC.prepare) SEC.prepare();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020304);
  scene.fog = new THREE.FogExp2(SEC.fog || 0x06080a, SEC.fogDensity || 0.045);
  scene.add(camera);
  soundWorld = { lights: [], tanks: [], steam: [], alarm: [], spots: [], server: null, core: null, creepy: SEC.creepy || 1 };
  G = {
    colliders: [], doors: [], lights: [], emergency: [], anim: [], tanks: [], uvMarks: [], steam: [], drones: [], morse: [], s: {},
    inv: {}, power: !!SEC.power, exitDoor: null, uv: false, countdown: null,
    x: SEC.start[0] * S, z: SEC.start[1] * S, yaw: SEC.start[2], pitch: 0, bob: 0, time: 0, done: false
  };
  G.checkpoint = [G.x, G.z, G.yaw];
  scene.add(new THREE.HemisphereLight(0x7d92b3, 0x1e1710, SEC.ambient == null ? 0.6 : SEC.ambient));
  buildStructure();
  SEC.build(api);
  // pontos aleatórios para sons de ambiente
  const fl = [];
  SEC.map.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '.') fl.push([(c + 0.5) * S, (r + 0.5) * S]); }));
  for (let k = 0; k < 10; k++) soundWorld.spots.push(fl[Math.floor(Math.random() * fl.length)]);
  snd.setWorld(soundWorld); snd.setPower(G.power); snd.klaxonOn(false);
  G.drones.forEach((d) => { d.snd = snd.drone(d.x, d.z); });
  $('eye').classList.add('hidden');
  flash.color.set(0xffe9c8); flash.intensity = SEC.flash || 9;
  renderInv(); if (!preview) saveChapter();
}

function buildStructure() {
  const walls = [], floors = [];
  SEC.map.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === '#') walls.push([c, r]);
    else if (ch !== ' ') floors.push([c, r]);
  }));
  const tint = SEC.wallTint || 0xffffff;
  const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S, WH, S), new THREE.MeshStandardMaterial({ map: TEX.wall.map, normalMap: TEX.wall.normalMap, roughness: 0.62, metalness: 0.35, color: tint }), walls.length);
  const m4 = new THREE.Matrix4();
  walls.forEach(([c, r], i) => { m4.makeTranslation((c + 0.5) * S, WH / 2, (r + 0.5) * S); wallMesh.setMatrixAt(i, m4); });
  scene.add(wallMesh);
  const fg = new THREE.PlaneGeometry(S, S); fg.rotateX(-Math.PI / 2);
  const cg = new THREE.PlaneGeometry(S, S); cg.rotateX(Math.PI / 2);
  const floor = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ map: TEX.floor.map, normalMap: TEX.floor.normalMap, roughness: 0.82, metalness: 0.05 }), floors.length);
  const ceil = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ map: TEX.ceil.map, normalMap: TEX.ceil.normalMap, roughness: 0.7, metalness: 0.4 }), floors.length);
  floors.forEach(([c, r], i) => {
    m4.makeTranslation((c + 0.5) * S, 0, (r + 0.5) * S); floor.setMatrixAt(i, m4);
    m4.makeTranslation((c + 0.5) * S, WH, (r + 0.5) * S); ceil.setMatrixAt(i, m4);
  });
  scene.add(floor, ceil);

  // Portas: 'D' abre sozinha; as outras letras são definidas pelo setor
  SEC.map.forEach((row, r) => [...row].forEach((ch, c) => {
    const info = ch === 'D' ? AUTO_DOOR : (SEC.doors || {})[ch]; if (!info) return;
    const spansX = cell(c, r - 1) !== '#' && cell(c, r + 1) !== '#';
    const x = (c + 0.5) * S, z = (r + 0.5) * S;
    const m = box(spansX ? S : 0.2, WH, spansX ? 0.2 : S, new THREE.MeshStandardMaterial({ map: doorTex(info), roughness: 0.5, metalness: 0.55 }), x, WH / 2, z);
    const door = { c, r, ch, info, mesh: m, open: false, t: 0, x, z };
    G.doors.push(door);
    if (!info.auto) interact(m, () => doorPrompt(door), () => useDoor(door));
  }));
}

function addLight(x, z, color, intensity, room, opts) {
  opts = opts || {};
  const l = new THREE.PointLight(color, intensity * 3, 18, 1.2);
  l.position.set(x, WH - 0.35, z); scene.add(l);
  box(1.0, 0.14, 0.5, mat(0x1c2024, { metalness: 0.7, roughness: 0.4 }), x, WH - 0.07, z);
  const panel = box(0.9, 0.02, 0.4, new THREE.MeshBasicMaterial({ map: TEX.grate, color }), x, WH - 0.15, z);
  const halo = glowSprite(x, WH - 0.62, z, color, 1.1, 0.45);
  const item = { light: l, panel, halo, base: intensity * 3, room, emerg: !!opts.emerg, flicker: !!opts.flicker, f: 1 };
  G.lights.push(item);
  if (item.emerg && !G.power) { G.emergency.push(item); soundWorld.alarm.push([x, z]); }
  soundWorld.lights.push([x, z, room, item.emerg && !G.power]);
  return item;
}
function powerOn(msg) {
  G.power = true; snd.setPower(true); snd.powerOn();
  G.lights.forEach((l) => {
    if (l.emerg) { l.light.color.set(0xffdcb0); l.panel.material.color.set(0xffdcb0); l.halo.material.color.set(0xffdcb0); l.halo.material.opacity = 0.45; }
    l.base = Math.max(l.base, 7.2);
  });
  G.emergency = [];
  if (SEC.onPower) SEC.onPower();
  toast(msg || '⚡ Energia restabelecida!');
}
function sign(text, x, y, z, rotY, bg, fg, w) {
  const t = textTex(256, 64, bg || '#1c2630', (c) => { c.fillStyle = fg || '#cfe3f3'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.fillText(text, 128, 42); });
  return plane(w || 1.2, (w || 1.2) / 4, new THREE.MeshBasicMaterial({ map: t }), x, y, z, rotY || 0);
}
let crateMat = null;
function crate(x, z, s, rot, y) {
  if (!crateMat) crateMat = new THREE.MeshStandardMaterial({ map: TEX.crate.map, normalMap: TEX.crate.normalMap, roughness: 0.6, metalness: 0.3 });
  s = s || 0.9;
  const m = box(s, s, s, crateMat, x, (y || 0) + s / 2, z, !y);
  if (rot) m.rotation.y = rot;
  return m;
}
// Texto escrito com tinta invisível: só aparece com a lâmpada UV ligada
function uvMark(text, x, y, z, rotY, size) {
  const t = canvasTex(256, 128, (c) => {
    c.fillStyle = '#d9b8ff'; c.font = 'bold 64px "Courier New", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = '#b48cff'; c.shadowBlur = 18; c.fillText(text, 128, 64);
  });
  const m = plane(size || 1.0, (size || 1.0) / 2, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), x, y, z, rotY || 0);
  m.visible = false; G.uvMarks.push(m);
  return m;
}
function steamVent(x, z, room) {
  soundWorld.steam.push([x, z, room || roomOf(x, z)]);
  for (let k = 0; k < 3; k++) {
    const sp = glowSprite(x, 2.4, z, 0xb8c4cc, 0.9, 0.0);
    sp.material.blending = THREE.NormalBlending;
    G.steam.push({ sp, x, z, ph: k / 3 });
  }
}
function setServer(x, y, z, room) { soundWorld.server = [x, y, z]; soundWorld.serverRoom = room; }
function setCore(x, y, z) { soundWorld.core = [x, y, z]; }

// ---------- Portas ----------
function doorPrompt(d) {
  if (d.open) return null;
  const info = d.info;
  if (info.prompt) return info.prompt(d);
  if (info.lock) return G.inv[info.lock] ? 'Usar: ' + ITEMS[info.lock].name : 'Porta trancada (' + ITEMS[info.lock].name + ')';
  return 'Abrir a porta';
}
function useDoor(d) {
  if (d.open) return;
  const info = d.info;
  if (info.use) { info.use(d); return; }
  if (info.lock && !G.inv[info.lock]) { snd.deny(d.x, d.z); toast('Precisas de: <b>' + ITEMS[info.lock].name + '</b>.'); return; }
  if (info.check) { const msg = info.check(d); if (msg) { snd.deny(d.x, d.z); toast(msg); return; } }
  openDoor(d);
}
function openDoor(d) {
  if (typeof d === 'string') d = G.doors.find((x) => x.ch === d);
  if (!d || d.open) return;
  d.open = true;
  if (d.info.lock) snd.reader(d.x, d.z);
  snd.door(d.x, d.z);
  if (d.info.exit) G.exitDoor = d;
  if (d.info.onOpen) d.info.onOpen(d);
}

// ---------- Teclado numérico ----------
let kbuf = '', kpad = null;
function openKeypad(opts) { kpad = opts; kbuf = ''; drawKeypad(); $('keypad').classList.remove('hidden'); }
function closeKeypad() { $('keypad').classList.add('hidden'); }
function drawKeypad(err) {
  const n = kpad ? kpad.code.length : 4;
  const d = $('kdisp'); d.textContent = (kbuf + '______').slice(0, n); d.classList.toggle('err', !!err);
}
function keypadKey(k) {
  snd.key(k);
  if (k === 'C') { kbuf = ''; drawKeypad(); return; }
  if (k === 'OK') {
    if (kbuf === kpad.code) { closeKeypad(); kpad.onOk(); }
    else { snd.deny(); $('kdisp').textContent = 'ERRO'; $('kdisp').classList.add('err'); kbuf = ''; }
    return;
  }
  if (kbuf.length < kpad.code.length) { kbuf += k; drawKeypad(); }
}
document.querySelectorAll('.keys button').forEach((b) => b.addEventListener('click', () => { audio(); keypadKey(b.textContent); }));
$('kclose').addEventListener('click', closeKeypad);

// ---------- Terminal de escolha ----------
let term = null;
function openTerminal(opts) {
  term = opts; $('termTitle').textContent = opts.title; $('termText').textContent = opts.text; $('termMsg').textContent = '';
  const box = $('termOpts'); box.innerHTML = '';
  opts.options.forEach((o, i) => {
    const b = document.createElement('button'); b.textContent = '> ' + o;
    b.addEventListener('click', () => {
      if (term.lockUntil && performance.now() < term.lockUntil) return;
      snd.key('5');
      const r = term.onPick(i);
      $('termMsg').textContent = r.msg;
      if (r.ok) { setTimeout(closeTerminal, 1400); } else { snd.deny(); term.lockUntil = performance.now() + 6000; }
    });
    box.appendChild(b);
  });
  $('terminal').classList.remove('hidden');
}
function closeTerminal() { $('terminal').classList.add('hidden'); }
$('termClose').addEventListener('click', closeTerminal);

// ---------- Painel de memória (Simon) ----------
let simon = null;
function openSimon(opts) {
  simon = { rounds: opts.rounds, round: 0, seq: [], pos: 0, busy: true, onWin: opts.onWin };
  $('simon').classList.remove('hidden');
  simonRound();
}
function simonRound() {
  const len = simon.rounds[simon.round];
  simon.seq = []; for (let i = 0; i < len; i++) simon.seq.push(Math.floor(Math.random() * 4));
  simon.pos = 0; simon.busy = true;
  $('simonMsg').textContent = 'Ronda ' + (simon.round + 1) + ' de ' + simon.rounds.length + ': observa...';
  simon.seq.forEach((p, i) => setTimeout(() => simonFlash(p), 900 + i * 650));
  setTimeout(() => { if (simon) { simon.busy = false; $('simonMsg').textContent = 'Repete a sequência.'; } }, 900 + simon.seq.length * 650);
}
function simonFlash(p) {
  const el = document.querySelectorAll('.pad4 button')[p];
  el.classList.add('lit'); snd.simon(p);
  setTimeout(() => el.classList.remove('lit'), 380);
}
document.querySelectorAll('.pad4 button').forEach((b, i) => b.addEventListener('click', () => {
  if (!simon || simon.busy) return;
  simonFlash(i);
  if (simon.seq[simon.pos] !== i) {
    snd.simon(0, true); simon.busy = true; $('simonMsg').textContent = 'Errado! A sequência recomeça...';
    setTimeout(() => { if (simon) simonRound(); }, 1300);
    return;
  }
  simon.pos++;
  if (simon.pos === simon.seq.length) {
    simon.round++; simon.busy = true;
    if (simon.round === simon.rounds.length) {
      $('simonMsg').textContent = 'ACESSO CONCEDIDO'; const cb = simon.onWin;
      setTimeout(() => { closeSimon(); cb(); }, 900);
    } else setTimeout(() => { if (simon) simonRound(); }, 900);
  }
}));
function closeSimon() { simon = null; $('simon').classList.add('hidden'); }
$('simonClose').addEventListener('click', closeSimon);

// ---------- Painel de tubos (rodar peças até a água chegar a todo o lado) ----------
let pipes = null;
const PDX = [0, 1, 0, -1], PDY = [-1, 0, 1, 0];
const prot = (m, k) => { for (let i = 0; i < (k & 3); i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
function openPipes(opts) {
  const N = opts.n || 5, base = new Array(N * N).fill(0), seen = new Array(N * N).fill(false), src = Math.floor(N / 2) * N;
  const front = [];
  const add = (c) => { seen[c] = true; for (let d = 0; d < 4; d++) front.push([c, d]); };
  add(src);
  while (front.length) {
    const [c, d] = front.splice(Math.floor(Math.random() * front.length), 1)[0];
    const x = c % N + PDX[d], y = Math.floor(c / N) + PDY[d];
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const n = y * N + x;
    if (seen[n]) continue;
    base[c] |= 1 << d; base[n] |= 1 << ((d + 2) % 4); add(n);
  }
  const turns = base.map(() => Math.floor(Math.random() * 4));
  pipes = { N, base, turns, src, onWin: opts.onWin, done: false };
  $('pipes').querySelector('h3').textContent = opts.title || 'CIRCUITO DE REFRIGERAÇÃO';
  $('pipes').querySelector('p').textContent = opts.text || 'Toca nas peças para as rodar até o líquido chegar a todos os tubos.';
  if (pipesLit().every(Boolean)) pipes.turns[src + 1]++;
  $('pipes').classList.remove('hidden'); drawPipes();
}
function pipesLit() {
  const { N, base, turns, src } = pipes, m = base.map((b, i) => prot(b, turns[i])), lit = new Array(N * N).fill(false), q = [src];
  lit[src] = true;
  while (q.length) {
    const a = q.pop();
    for (let d = 0; d < 4; d++) {
      if (!(m[a] & (1 << d))) continue;
      const x = a % N + PDX[d], y = Math.floor(a / N) + PDY[d];
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const b = y * N + x;
      if ((m[b] & (1 << ((d + 2) % 4))) && !lit[b]) { lit[b] = true; q.push(b); }
    }
  }
  return lit;
}
function drawPipes() {
  const cv = $('pipeCv'), c = cv.getContext('2d'), { N, base, turns, src } = pipes, T = cv.width / N, lit = pipesLit();
  c.fillStyle = '#0d1418'; c.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < N * N; i++) {
    const x = (i % N + 0.5) * T, y = (Math.floor(i / N) + 0.5) * T, m = prot(base[i], turns[i]);
    c.fillStyle = '#16222a'; c.fillRect(x - T / 2 + 2, y - T / 2 + 2, T - 4, T - 4);
    c.lineCap = 'round';
    for (const [w, col] of [[T * 0.3, '#3a4650'], [T * 0.16, lit[i] ? '#4fc3f7' : '#1c262e']]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      for (let d = 0; d < 4; d++) if (m & (1 << d)) { c.moveTo(x, y); c.lineTo(x + PDX[d] * T / 2, y + PDY[d] * T / 2); }
      c.stroke();
    }
    if (i === src) { c.fillStyle = '#4fc3f7'; c.beginPath(); c.arc(x, y, T * 0.2, 0, 7); c.fill(); }
  }
  const n = lit.filter(Boolean).length;
  $('pipeMsg').textContent = pipes.done ? 'REFRIGERAÇÃO RESTABELECIDA' : 'Fluxo: ' + Math.round(n / (N * N) * 100) + '%';
}
$('pipeCv').addEventListener('click', (e) => {
  if (!pipes || pipes.done) return;
  const r = e.target.getBoundingClientRect(), N = pipes.N;
  const gx = Math.floor((e.clientX - r.left) / r.width * N), gy = Math.floor((e.clientY - r.top) / r.height * N);
  if (gx < 0 || gy < 0 || gx >= N || gy >= N) return;
  pipes.turns[gy * N + gx]++; snd.breaker(G.x, G.z, false); drawPipes();
  if (pipesLit().every(Boolean)) {
    pipes.done = true; drawPipes(); const cb = pipes.onWin;
    setTimeout(() => { closePipes(); cb(); }, 1000);
  }
});
function closePipes() { pipes = null; $('pipes').classList.add('hidden'); }
$('pipeClose').addEventListener('click', closePipes);

// ---------- Drones de vigilância ----------
const DRONE_RANGE = 7.5, DRONE_FOV = 0.48;
// linha de vista: paredes, portas fechadas e móveis altos tapam
function lineOfSight(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    if (solidCell(Math.floor(x / S), Math.floor(z / S))) return false;
    for (const b of G.colliders) if (b.h > 1.5 && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
  }
  return true;
}
function addDrone(path, speed) {
  const g = new THREE.Group(); scene.add(g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), mat(0x23272c, { metalness: 0.8, roughness: 0.3 }));
  body.scale.y = 0.6; g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 24), mat(0x3a3f45, { metalness: 0.7 })); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (let k = 0; k < 4; k++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x555b62, transparent: true, opacity: 0.5 }));
    r.position.set(Math.cos(k * Math.PI / 2 + 0.78) * 0.42, 0.06, Math.sin(k * Math.PI / 2 + 0.78) * 0.42); g.add(r);
  }
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb02e }));
  eye.position.set(0, -0.02, -0.26); g.add(eye);
  const len = DRONE_RANGE, rad = Math.tan(DRONE_FOV) * len;
  const coneGeo = new THREE.ConeGeometry(rad, len, 24, 1, true); coneGeo.translate(0, -len / 2, 0); coneGeo.rotateX(-Math.PI / 2 - 0.25);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  g.add(cone);
  const halo = glowSprite(0, 0, 0, 0xffb02e, 0.9, 0.5); scene.remove(halo); g.add(halo); halo.position.set(0, 0, -0.3);
  const d = { g, eye, cone, halo, path, speed: speed || 1.5, i: 0, x: path[0][0], z: path[0][1], yaw: 0, wait: 0, alert: 0, off: false, snd: null };
  d.yaw = Math.atan2(-(path[1][0] - d.x), -(path[1][1] - d.z));
  G.drones.push(d);
  return d;
}
function resetDrones() { for (const d of G.drones) { d.i = 0; d.x = d.path[0][0]; d.z = d.path[0][1]; d.alert = 0; d.wait = 0.8; } }
function dronesOff() {
  for (const d of G.drones) { d.off = true; d.cone.visible = false; d.halo.visible = false; d.eye.material.color.set(0x222222); if (d.snd) d.snd.stop(); }
  $('eye').classList.add('hidden');
}
function caught() {
  snd.sting(); toast('<b>Foste detetado!</b> Voltaste ao último ponto seguro.');
  $('hit').classList.add('on'); setTimeout(() => $('hit').classList.remove('on'), 500);
  const [x, z, yaw] = G.checkpoint; G.x = x; G.z = z; G.yaw = yaw; G.pitch = 0;
  resetDrones(); G.grace = 2.5;
  if (SEC.onCaught) SEC.onCaught();
}
function updateDrones(dt, T) {
  let worst = 0;
  if (G.grace > 0) G.grace -= dt;
  for (const d of G.drones) {
    if (d.off) { d.g.position.y += (0.3 - d.g.position.y) * Math.min(1, dt * 2); continue; }
    if (d.wait > 0) d.wait -= dt;
    else {
      const nx = d.path[(d.i + 1) % d.path.length];
      const dx = nx[0] - d.x, dz = nx[1] - d.z, dist = Math.hypot(dx, dz), step = d.speed * dt;
      const want = Math.atan2(-dx, -dz);
      let da = want - d.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      d.yaw += da * Math.min(1, dt * 4);
      if (Math.abs(da) < 0.5) {
        if (dist <= step) { d.x = nx[0]; d.z = nx[1]; d.i = (d.i + 1) % d.path.length; d.wait = 0.7; }
        else { d.x += dx / dist * step; d.z += dz / dist * step; }
      }
    }
    d.g.position.set(d.x, 2.15 + Math.sin(T * 2 + d.path.length) * 0.06, d.z); d.g.rotation.y = d.yaw;
    if (d.snd) d.snd.set(d.x, d.z);
    // deteção
    if (state === 'play' && !modalOpen() && !(G.grace > 0)) {
      const px = G.x - d.x, pz = G.z - d.z, dist = Math.hypot(px, pz);
      const fx = -Math.sin(d.yaw), fz = -Math.cos(d.yaw);
      const ang = Math.acos(Math.max(-1, Math.min(1, (px * fx + pz * fz) / (dist || 1))));
      const seen = dist < DRONE_RANGE && (ang < DRONE_FOV || dist < 1.3) && lineOfSight(d.x, d.z, G.x, G.z);
      const before = d.alert;
      d.alert = Math.max(0, Math.min(1, d.alert + (seen ? dt * 1.6 : -dt * 0.8)));
      if (seen && before === 0) snd.alert();
      const c = d.alert > 0 ? 0xff3b2a : 0xffb02e;
      d.eye.material.color.set(c); d.cone.material.color.set(c); d.halo.material.color.set(c);
      d.cone.material.opacity = 0.07 + d.alert * 0.12;
      worst = Math.max(worst, d.alert);
      if (d.alert >= 1) { caught(); return; }
    }
  }
  $('eye').classList.toggle('hidden', worst <= 0);
  $('eye').style.opacity = 0.4 + worst * 0.6;
}

// ---------- Luz que pisca em código Morse ----------
const MORSE = { 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
function morseLight(x, y, z, digits) {
  const u = 0.28, seq = [];
  [...digits].forEach((dg) => { [...MORSE[dg]].forEach((s) => { seq.push([1, s === '.' ? u : 3 * u, s === '-']); seq.push([0, u]); }); seq[seq.length - 1][1] = 3 * u; });
  seq[seq.length - 1][1] = 9 * u;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), new THREE.MeshBasicMaterial({ color: 0x330000 }));
  bulb.position.set(x, y, z); scene.add(bulb);
  const halo = glowSprite(x, y, z, 0xff3b2a, 2.6, 0);
  G.morse.push({ x, z, bulb, halo, seq, i: 0, t: 0 });
}
function updateMorse(dt) {
  for (const m of G.morse) {
    m.t += dt;
    if (m.t >= m.seq[m.i][1]) {
      m.t = 0; m.i = (m.i + 1) % m.seq.length;
      const [on, , dash] = m.seq[m.i];
      if (on && Math.hypot(G.x - m.x, G.z - m.z) < 10) snd.beep(m.x, m.z, dash);
    }
    const on = m.seq[m.i][0];
    m.bulb.material.color.set(on ? 0xff4a3a : 0x330000); m.halo.material.opacity = on ? 0.8 : 0;
  }
}

// ---------- Painel de portas lógicas ----------
const GATES = { AND: (a, b) => a && b, OR: (a, b) => a || b, XOR: (a, b) => a !== b, NAND: (a, b) => !(a && b) };
let logic = null;
function logicEval(L, s) {
  const x = s.map((v, i) => (L.inv[i] ? !v : v));
  const a = GATES[L.g[0]](x[0], x[1]), b = GATES[L.g[1]](x[2], x[3]);
  return { x, a, b, o1: GATES[L.g[2]](a, b), o2: GATES[L.g[3]](b, x[0]) };
}
function openLogic(opts) {
  const names = Object.keys(GATES);
  for (let tries = 0; tries < 500; tries++) {
    const L = { g: [0, 1, 2, 3].map(() => names[Math.floor(Math.random() * names.length)]), inv: [0, 1, 2, 3].map(() => Math.random() < 0.3), s: [false, false, false, false] };
    let sols = 0;
    for (let m = 0; m < 16; m++) { const r = logicEval(L, [0, 1, 2, 3].map((i) => !!(m & (1 << i)))); if (r.o1 && r.o2) sols++; }
    const r0 = logicEval(L, L.s);
    if (sols >= 1 && sols <= 3 && !(r0.o1 && r0.o2)) { logic = Object.assign(L, { onWin: opts.onWin, done: false }); break; }
  }
  $('logic').classList.remove('hidden'); drawLogic();
}
function drawLogic() {
  const cv = $('logicCv'), c = cv.getContext('2d'), L = logic, r = logicEval(L, L.s);
  c.fillStyle = '#0d1418'; c.fillRect(0, 0, cv.width, cv.height);
  const on = '#4fe3ff', off = '#26343d', sy = [50, 125, 215, 290];
  const wire = (pts, v) => { c.strokeStyle = v ? on : off; c.lineWidth = 5; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => c.lineTo(p[0], p[1])); c.stroke(); };
  wire([[60, sy[0]], [150, sy[0]], [150, 75], [230, 75]], r.x[0]); wire([[60, sy[1]], [150, sy[1]], [150, 105], [230, 105]], r.x[1]);
  wire([[60, sy[2]], [150, sy[2]], [150, 235], [230, 235]], r.x[2]); wire([[60, sy[3]], [150, sy[3]], [150, 265], [230, 265]], r.x[3]);
  wire([[310, 90], [370, 90], [370, 120], [400, 120]], r.a); wire([[310, 250], [350, 250], [350, 150], [400, 150]], r.b);
  wire([[310, 250], [400, 250]], r.b); wire([[100, sy[0]], [100, 18], [380, 18], [380, 280], [400, 280]], r.x[0]);
  wire([[480, 135], [530, 135]], r.o1); wire([[480, 265], [530, 265]], r.o2);
  const gate = (x, y, name) => { c.fillStyle = '#1b2a33'; c.strokeStyle = '#7dffcf'; c.lineWidth = 2; c.fillRect(x, y, 80, 60); c.strokeRect(x, y, 80, 60); c.fillStyle = '#7dffcf'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText(name, x + 40, y + 37); };
  gate(230, 60, L.g[0]); gate(230, 220, L.g[1]); gate(400, 105, L.g[2]); gate(400, 235, L.g[3]);
  L.inv.forEach((v, i) => { if (!v) return; c.fillStyle = '#ffb02e'; c.fillRect(110, sy[i] - 12, 30, 24); c.fillStyle = '#111'; c.font = 'bold 11px monospace'; c.textAlign = 'center'; c.fillText('NÃO', 125, sy[i] + 4); });
  L.s.forEach((v, i) => { c.fillStyle = v ? '#4fe3ff' : '#2b3036'; c.beginPath(); c.arc(38, sy[i], 22, 0, 7); c.fill(); c.fillStyle = v ? '#05202a' : '#9aa3ad'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText(v ? '1' : '0', 38, sy[i] + 6); });
  [[135, r.o1], [265, r.o2]].forEach(([y, v]) => { c.fillStyle = v ? '#ffe28a' : '#3a3020'; c.beginPath(); c.arc(548, y, 18, 0, 7); c.fill(); });
  $('logicMsg').textContent = L.done ? 'CIRCUITO FECHADO' : 'Acende as duas lâmpadas ao mesmo tempo.';
}
$('logicCv').addEventListener('click', (e) => {
  if (!logic || logic.done) return;
  const rc = e.target.getBoundingClientRect(), x = (e.clientX - rc.left) / rc.width * 570, y = (e.clientY - rc.top) / rc.height * 320;
  [50, 125, 215, 290].forEach((sy, i) => { if (Math.hypot(x - 38, y - sy) < 34) { logic.s[i] = !logic.s[i]; snd.clickTick(); } });
  const r = logicEval(logic, logic.s);
  if (r.o1 && r.o2) { logic.done = true; const cb = logic.onWin; drawLogic(); setTimeout(() => { closeLogic(); cb(); }, 1000); return; }
  drawLogic();
});
function closeLogic() { logic = null; $('logic').classList.add('hidden'); }
$('logicClose').addEventListener('click', closeLogic);

// ---------- Espelhos e laser ----------
let laser = null;
const LD = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S W N
const reflect = (t, d) => (t === 1 ? [3, 2, 1, 0][d] : [1, 0, 3, 2][d]); // 1 = '/', 2 = '\'
function openLaser(opts) {
  const N = 6;
  for (let tries = 0; tries < 2000; tries++) {
    const grid = new Array(N * N).fill(0), er = Math.floor(Math.random() * N);
    let c = 0, r = er, d = 0, ok = false, mirrors = 0, steps = 0; const seen = new Set();
    while (steps++ < 40) {
      if (c < 0 || r < 0 || r >= N) break;
      if (c >= N) { ok = d === 0; break; }
      if (seen.has(c + ',' + r)) break;
      seen.add(c + ',' + r);
      if (Math.random() < 0.38) {
        const nd = Math.random() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
        grid[r * N + c] = reflect(1, d) === nd ? 1 : 2; d = nd; mirrors++;
      }
      c += LD[d][0]; r += LD[d][1];
    }
    if (!ok || mirrors < 4 || seen.size < 9) continue;
    const rr = r, empty = [];
    for (let i = 0; i < N * N; i++) if (!grid[i] && !seen.has((i % N) + ',' + Math.floor(i / N))) empty.push(i);
    shuffle(empty).slice(0, 4).forEach((i) => { grid[i] = 1 + Math.floor(Math.random() * 2); });
    shuffle(empty).slice(4, 7).forEach((i) => { if (!grid[i]) grid[i] = 3; });
    for (let i = 0; i < N * N; i++) if (grid[i] === 1 || grid[i] === 2) grid[i] = 1 + Math.floor(Math.random() * 2);
    laser = { N, grid, er, rr, onWin: opts.onWin, done: false };
    if (laserTrace().hit) continue;
    break;
  }
  $('laser').classList.remove('hidden'); drawLaser();
}
function laserTrace() {
  const { N, grid, er, rr } = laser, pts = [[-0.5, er]];
  let c = 0, r = er, d = 0;
  for (let k = 0; k < 80; k++) {
    if (c < 0 || r < 0 || r >= N) { pts.push([c, r]); return { pts, hit: false }; }
    if (c >= N) { pts.push([N - 0.5 + 0.5, r]); return { pts, hit: r === rr && d === 0 }; }
    const t = grid[r * N + c];
    if (t === 3) { pts.push([c, r]); return { pts, hit: false }; }
    if (t === 1 || t === 2) { pts.push([c, r]); d = reflect(t, d); }
    c += LD[d][0]; r += LD[d][1];
  }
  return { pts, hit: false };
}
function drawLaser() {
  const cv = $('laserCv'), c = cv.getContext('2d'), { N, grid, er, rr } = laser, T = cv.width / (N + 2);
  c.fillStyle = '#0d1418'; c.fillRect(0, 0, cv.width, cv.height);
  const X = (col) => (col + 1.5) * T, Y = (row) => (row + 1.5) * T;
  for (let i = 0; i < N * N; i++) {
    const x = X(i % N), y = Y(Math.floor(i / N)), t = grid[i];
    c.fillStyle = '#16222a'; c.fillRect(x - T / 2 + 2, y - T / 2 + 2, T - 4, T - 4);
    if (t === 3) { c.fillStyle = '#3a3f45'; c.fillRect(x - T / 3, y - T / 3, T * 0.66, T * 0.66); }
    if (t === 1 || t === 2) {
      c.strokeStyle = '#cfe3f3'; c.lineWidth = 6; c.beginPath();
      if (t === 1) { c.moveTo(x - T / 3, y + T / 3); c.lineTo(x + T / 3, y - T / 3); } else { c.moveTo(x - T / 3, y - T / 3); c.lineTo(x + T / 3, y + T / 3); }
      c.stroke();
    }
  }
  c.fillStyle = '#ff3b2a'; c.fillRect(X(-1) - T / 3, Y(er) - T / 4, T / 1.5, T / 2);
  const tr = laserTrace();
  c.fillStyle = tr.hit ? '#7dffcf' : '#2f8f6d'; c.beginPath(); c.arc(X(N), Y(rr), T / 3, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,60,40,.9)'; c.lineWidth = 3; c.shadowColor = '#ff3b2a'; c.shadowBlur = 12; c.beginPath();
  tr.pts.forEach(([col, row], k) => { const x = X(Math.min(col, N)), y = Y(row); if (k) c.lineTo(x, y); else c.moveTo(X(-1) + T / 3, y); });
  c.stroke(); c.shadowBlur = 0;
  $('laserMsg').textContent = laser.done ? 'RECETOR ATIVADO' : 'Toca nos espelhos para os rodar e leva o laser até ao recetor verde.';
}
$('laserCv').addEventListener('click', (e) => {
  if (!laser || laser.done) return;
  const rc = e.target.getBoundingClientRect(), N = laser.N, T = rc.width / (N + 2);
  const col = Math.floor((e.clientX - rc.left) / T) - 1, row = Math.floor((e.clientY - rc.top) / T) - 1;
  if (col < 0 || row < 0 || col >= N || row >= N) return;
  const i = row * N + col, t = laser.grid[i];
  if (t !== 1 && t !== 2) return;
  laser.grid[i] = t === 1 ? 2 : 1; snd.clickTick();
  if (laserTrace().hit) { laser.done = true; const cb = laser.onWin; drawLaser(); setTimeout(() => { closeLaser(); cb(); }, 1100); return; }
  drawLaser();
});
function closeLaser() { laser = null; $('laser').classList.add('hidden'); }
$('laserClose').addEventListener('click', closeLaser);

// ---------- Peças deslizantes (3×3) ----------
let slide = null;
function openSlide(opts) {
  const img = document.createElement('canvas'); img.width = img.height = 300; opts.draw(img.getContext('2d'), 300);
  const tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8]; let blank = 8;
  for (let k = 0; k < 120; k++) {
    const bx = blank % 3, by = Math.floor(blank / 3), opt = [];
    if (bx > 0) opt.push(blank - 1); if (bx < 2) opt.push(blank + 1); if (by > 0) opt.push(blank - 3); if (by < 2) opt.push(blank + 3);
    const j = opt[Math.floor(Math.random() * opt.length)]; [tiles[blank], tiles[j]] = [tiles[j], tiles[blank]]; blank = j;
  }
  if (tiles.every((t, i) => t === i)) { [tiles[7], tiles[8]] = [tiles[8], tiles[7]]; [tiles[4], tiles[7]] = [tiles[7], tiles[4]]; }
  slide = { img, tiles, onWin: opts.onWin, done: false };
  $('slide').classList.remove('hidden'); drawSlide();
}
function drawSlide() {
  const cv = $('slideCv'), c = cv.getContext('2d'), T = cv.width / 3;
  c.fillStyle = '#0d1418'; c.fillRect(0, 0, cv.width, cv.height);
  slide.tiles.forEach((t, i) => {
    if (t === 8 && !slide.done) return;
    c.drawImage(slide.img, (t % 3) * 100, Math.floor(t / 3) * 100, 100, 100, (i % 3) * T + 2, Math.floor(i / 3) * T + 2, T - 4, T - 4);
  });
  $('slideMsg').textContent = slide.done ? 'FOTOGRAFIA RECOMPOSTA' : 'Toca numa peça ao lado do espaço vazio para a deslizar.';
}
$('slideCv').addEventListener('click', (e) => {
  if (!slide || slide.done) return;
  const rc = e.target.getBoundingClientRect(), i = Math.floor((e.clientY - rc.top) / rc.height * 3) * 3 + Math.floor((e.clientX - rc.left) / rc.width * 3);
  const b = slide.tiles.indexOf(8), adj = (Math.abs(i - b) === 3) || (Math.abs(i - b) === 1 && Math.floor(i / 3) === Math.floor(b / 3));
  if (!adj) return;
  [slide.tiles[i], slide.tiles[b]] = [slide.tiles[b], slide.tiles[i]]; snd.slide();
  if (slide.tiles.every((t, k) => t === k)) { slide.done = true; const cb = slide.onWin; drawSlide(); setTimeout(() => { closeSlide(); cb(); }, 1200); return; }
  drawSlide();
});
function closeSlide() { slide = null; $('slide').classList.add('hidden'); }
$('slideClose').addEventListener('click', closeSlide);

// ---------- Rádio ----------
let radio = null;
function openRadio(opts) {
  radio = Object.assign({ done: false }, opts);
  $('radioIn').value = radio.start || 95; $('radioMsg').textContent = ''; radioUpd(true);
  $('radio').classList.remove('hidden');
}
function radioUpd(quiet) {
  const f = parseFloat($('radioIn').value), clar = Math.max(0, 1 - Math.abs(f - radio.freq) / 2.5);
  $('radioFreq').textContent = f.toFixed(1) + ' MHz';
  $('radioBar').style.width = Math.round(clar * 100) + '%';
  if (!quiet) snd.staticBurst(clar);
  if (!radio.done && Math.abs(f - radio.freq) < 0.05) {
    radio.done = true; snd.radio(); $('radioMsg').textContent = radio.message; if (radio.onWin) radio.onWin();
  }
}
$('radioIn').addEventListener('input', () => { if (radio) radioUpd(); });
function closeRadio() { radio = null; $('radio').classList.add('hidden'); }
$('radioClose').addEventListener('click', closeRadio);

// ---------- Relógio ----------
let clock = null;
function openClock(opts) { clock = { h: 12, m: 0, target: opts.target, onWin: opts.onWin }; $('clock').classList.remove('hidden'); drawClock(); }
function drawClock() {
  const cv = $('clockCv'), c = cv.getContext('2d'), R = cv.width / 2;
  c.fillStyle = '#0d1418'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#e9e4d6'; c.beginPath(); c.arc(R, R, R - 8, 0, 7); c.fill();
  c.strokeStyle = '#2b2b2b'; c.lineWidth = 6; c.stroke();
  c.fillStyle = '#222'; c.font = 'bold 22px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let k = 1; k <= 12; k++) { const a = k / 12 * Math.PI * 2 - Math.PI / 2; c.fillText(String(k), R + Math.cos(a) * (R - 32), R + Math.sin(a) * (R - 32)); }
  const hand = (a, len, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(R, R); c.lineTo(R + Math.cos(a) * len, R + Math.sin(a) * len); c.stroke(); };
  hand(((clock.h % 12) + clock.m / 60) / 12 * Math.PI * 2 - Math.PI / 2, R * 0.5, 8, '#1b1b1b');
  hand(clock.m / 60 * Math.PI * 2 - Math.PI / 2, R * 0.75, 5, '#1b1b1b');
  c.fillStyle = '#b71c1c'; c.beginPath(); c.arc(R, R, 7, 0, 7); c.fill();
}
document.querySelectorAll('#clock [data-k]').forEach((b) => b.addEventListener('click', () => {
  if (!clock) return;
  const k = b.dataset.k;
  if (k === 'h+') clock.h = clock.h % 12 + 1; if (k === 'h-') clock.h = (clock.h + 10) % 12 + 1;
  if (k === 'm+') clock.m = (clock.m + 5) % 60; if (k === 'm-') clock.m = (clock.m + 55) % 60;
  snd.clickTick();
  if (k === 'ok') {
    if (clock.h === clock.target[0] && clock.m === clock.target[1]) { const cb = clock.onWin; closeClock(); cb(); return; }
    snd.deny(); $('clockMsg').textContent = 'Nada acontece.'; return;
  }
  $('clockMsg').textContent = ''; drawClock();
}));
function closeClock() { clock = null; $('clock').classList.add('hidden'); }
$('clockClose').addEventListener('click', closeClock);

// ---------- Mistura química ----------
const VIALS = [['vermelho', [229, 57, 53]], ['azul', [30, 136, 229]], ['amarelo', [253, 216, 53]], ['verde', [67, 160, 71]], ['branco', [240, 240, 235]], ['preto', [33, 33, 33]]];
let mix = null;
const mixColor = (sel) => [0, 1, 2].map((k) => Math.round(sel.reduce((s, i) => s + VIALS[i][1][k], 0) / sel.length));
const rgb = (c) => 'rgb(' + c.join(',') + ')';
function openMix(opts) {
  mix = { target: opts.target, sel: [], onWin: opts.onWin };
  const box = $('mixVials'); box.innerHTML = '';
  VIALS.forEach(([n, c], i) => {
    const b = document.createElement('button'); b.innerHTML = '<i style="background:' + rgb(c) + '"></i>' + n;
    b.addEventListener('click', () => {
      const k = mix.sel.indexOf(i);
      if (k >= 0) mix.sel.splice(k, 1); else if (mix.sel.length < 3) mix.sel.push(i);
      snd.clickTick(); drawMix();
    });
    box.appendChild(b);
  });
  $('mixTarget').style.background = rgb(mixColor(opts.target));
  $('mix').classList.remove('hidden'); drawMix();
}
function drawMix() {
  document.querySelectorAll('#mixVials button').forEach((b, i) => b.classList.toggle('on', mix.sel.includes(i)));
  $('mixResult').style.background = mix.sel.length ? rgb(mixColor(mix.sel)) : 'transparent';
  $('mixMsg').textContent = mix.sel.length + ' de 3 frascos escolhidos';
}
$('mixBtn').addEventListener('click', () => {
  if (!mix || mix.sel.length !== 3) { snd.deny(); return; }
  snd.mix();
  if (rgb(mixColor(mix.sel)) === rgb(mixColor(mix.target))) { const cb = mix.onWin; $('mixMsg').textContent = 'Mistura correta!'; setTimeout(() => { closeMix(); cb(); }, 1300); }
  else { $('mixMsg').textContent = 'A cor não corresponde à receita. A mistura foi para o lixo.'; mix.sel = []; setTimeout(drawMix, 1500); }
});
function closeMix() { mix = null; $('mix').classList.add('hidden'); }
$('mixClose').addEventListener('click', closeMix);

// ---------- Interface ----------
let toastT = 0;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.style.opacity = 1; toastT = 3.6; }
function showNote(text, screenish) {
  snd.note();
  $('modalText').textContent = text; $('paper').classList.toggle('screenish', !!screenish);
  $('modal').classList.remove('hidden');
}
$('modalOk').addEventListener('click', () => $('modal').classList.add('hidden'));
const OVERLAYS = ['modal', 'keypad', 'terminal', 'simon', 'pipes', 'logic', 'laser', 'slide', 'radio', 'clock', 'mix'];
function modalOpen() { return OVERLAYS.some((id) => !$(id).classList.contains('hidden')); }
function closeOverlays() { closeKeypad(); closeTerminal(); closeSimon(); closePipes(); closeLogic(); closeLaser(); closeSlide(); closeRadio(); closeClock(); closeMix(); $('modal').classList.add('hidden'); }

function toggleUV() {
  if (!G.inv.uv || state !== 'play') return;
  G.uv = !G.uv; snd.uv(G.uv);
  flash.color.set(G.uv ? 0x8a5cff : 0xffe9c8); flash.intensity = G.uv ? 6 : (SEC.flash || 9);
  $('uvBtn').classList.toggle('on', G.uv);
}
$('uvBtn').addEventListener('click', toggleUV);

// Contagem decrescente (evacuação no núcleo)
function startCountdown(sec, onFail) { G.countdown = { t: sec, onFail }; $('count').classList.remove('hidden'); snd.klaxonOn(true); }
function stopCountdown() { G.countdown = null; $('count').classList.add('hidden'); snd.klaxonOn(false); }

// ---------- Fluxo do capítulo ----------
let state = 'menu';
function setState(s) {
  state = s;
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('pause').classList.toggle('hidden', s !== 'pause');
  $('win').classList.toggle('hidden', s !== 'end');
  $('hud').classList.toggle('hidden', s !== 'play');
  if (s === 'pause') snd.suspend(); else snd.resume();
  if (s !== 'play') { resetInput(); if (document.pointerLockElement) document.exitPointerLock(); }
}
function totalTime() { return CH.time + (G ? G.time : 0); }

function showTitle(t1, t2, ms, done) {
  $('fadeT1').textContent = t1; $('fadeT2').textContent = t2;
  $('fade').classList.add('on');
  setTimeout(() => { $('fade').classList.remove('on'); if (done) done(); }, ms);
}
function enterSector(i) {
  closeOverlays(); stopCountdown();
  state = 'trans'; $('hud').classList.add('hidden'); resetInput();
  $('fadeT1').textContent = ''; $('fadeT2').textContent = '';
  $('fade').classList.add('on');
  setTimeout(() => {
    loadSector(i);
    $('fadeT1').textContent = SEC.title; $('fadeT2').textContent = SEC.subtitle;
    setTimeout(() => {
      $('fade').classList.remove('on'); setState('play');
      const msg = CH.pending || SEC.intro; CH.pending = null;
      if (msg) setTimeout(() => toast(msg), 600);
    }, 2800);
  }, 900);
}
function nextSector() {
  if (G.done) return;
  G.done = true; CH.time += G.time; G.time = 0;
  snd.elevator(2.6);
  // se o jogador não apanhou o fragmento deste setor, guarda-o na mesma
  const fn = SEC.frag || (CH.ch === 1 && secIdx < 4 ? secIdx + 1 : 0);
  if (fn && !CH.found[fn - 1]) { CH.found[fn - 1] = true; CH.pending = 'Encontraste no bolso um papel amarrotado: <b>' + CHAP().fragLabel + fn + ' · ' + CH.frags[fn - 1] + '</b>.'; }
  if (secIdx + 1 < CHAP().sectors.length) enterSector(secIdx + 1);
}
// Final do capítulo: o elevador sobe... e para.
function playEnding() {
  if (G.done) return;
  G.done = true; CH.time += G.time; G.time = 0; stopCountdown();
  state = 'story'; $('hud').classList.add('hidden'); resetInput();
  const C = CHAP(), lines = C.ending;
  const fx = { elevator: () => snd.elevator(7), sting: () => snd.sting(), radio: () => snd.radio(), door: () => snd.door(G.x, G.z) };
  $('story').classList.remove('hidden'); $('storyText').innerHTML = '';
  lines.forEach(([ms, txt, f]) => setTimeout(() => {
    const p = document.createElement('p'); p.textContent = txt; $('storyText').appendChild(p);
    while ($('storyText').children.length > 4) $('storyText').removeChild($('storyText').firstChild);
    requestAnimationFrame(() => p.classList.add('in'));
    if (fx[f]) fx[f]();
  }, ms));
  setTimeout(() => {
    $('story').classList.add('hidden');
    const best = parseFloat(load('etl_best_ch' + CH.ch)), rec = !best || CH.time < best;
    if (rec) save('etl_best_ch' + CH.ch, CH.time.toFixed(1));
    save('etl_ch' + CH.ch + '_done', '1'); save('etl_save_c' + CH.ch, ''); if (CH.ch === 1) save('etl_save', '');
    $('winTitle').innerHTML = 'FIM DO<br><span>CAPÍTULO ' + CH.ch + '</span>';
    $('winNext').textContent = C.next;
    $('winTxt').innerHTML = 'Tempo do capítulo: <b>' + fmtTime(CH.time) + '</b>' + (rec ? ' (novo recorde!)' : '<br>Melhor tempo: ' + fmtTime(best)) +
      '<br><br>' + C.endText;
    setState('end'); refreshMenu();
  }, lines[lines.length - 1][0] + 5200);
}

function refreshMenu() {
  [[1, 'contBtn', 'best1'], [2, 'cont2Btn', 'best2']].forEach(([n, btn, bt]) => {
    const sv = loadChapter(n);
    $(btn).classList.toggle('hidden', !sv);
    if (sv) $(btn).textContent = 'CONTINUAR — ' + CHAPTERS[n].sectors[sv.sec].title.split(' — ')[0];
    const b = parseFloat(load('etl_best_ch' + n));
    $(bt).textContent = b ? 'Melhor tempo: ' + fmtTime(b) : (load('etl_ch' + n + '_done') ? 'Concluído' : '');
  });
}
function startNew(n) { audio(); newChapter(n); enterSector(0); }
function continueChapter(n) {
  audio(); const sv = loadChapter(n); if (!sv) return;
  CH = { ch: n, sec: sv.sec, frags: sv.frags, found: sv.found, time: sv.time || 0 }; enterSector(sv.sec);
}
$('playBtn').addEventListener('click', () => startNew(1));
$('contBtn').addEventListener('click', () => continueChapter(1));
$('play2Btn').addEventListener('click', () => startNew(2));
$('cont2Btn').addEventListener('click', () => continueChapter(2));
$('againBtn').addEventListener('click', () => { refreshMenu(); setState('menu'); });
$('pauseBtn').addEventListener('click', () => setState('pause'));
$('resumeBtn').addEventListener('click', () => setState('play'));
$('quitBtn').addEventListener('click', () => { CH.time += G.time; G.time = 0; saveChapter(); refreshMenu(); setState('menu'); });
$('use').addEventListener('click', () => doInteract());

// Ganchos chamados pela app Android
window.olPause = () => { if (state === 'play') setState('pause'); };
window.olBack = () => {
  for (const id of OVERLAYS) if (!$(id).classList.contains('hidden')) { closeOverlays(); return true; }
  if (state === 'play') { setState('pause'); return true; }
  if (state === 'pause' || state === 'end') { if (state === 'pause') { CH.time += G.time; G.time = 0; saveChapter(); } refreshMenu(); setState('menu'); return true; }
  if (state === 'trans' || state === 'story') return true;
  return false;
};
document.addEventListener('visibilitychange', () => { if (document.hidden) window.olPause(); });

// API usada pelos setores (sectors.js)
const api = {
  THREE, S, WH, TEX, get G() { return G; }, get CH() { return CH; }, get scene() { return scene; },
  mat, box, plane, hollowBox, interact, hitbox, textTex, canvasTex, glowSprite, pipe, barrel, tank, hazardBand, crate, sign,
  addLight, addItem, fragment, uvMark, steamVent, setServer, setCore, powerOn, openDoor, renderInv,
  openKeypad, openTerminal, openSimon, openPipes, showNote, toast, snd, shuffle, roomOf,
  startCountdown, stopCountdown, nextSector, playEnding, enterSector,
  addDrone, dronesOff, resetDrones, morseLight, openLogic, openLaser, openSlide, openRadio, openClock, openMix, VIALS,
  setCheckpoint(x, z, yaw) { G.checkpoint = [x, z, yaw]; },
  anim(obj, prop, to) { G.anim.push({ obj, prop, to }); }
};


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
  if (!$('keypad').classList.contains('hidden') && /^Digit\d$/.test(e.code)) keypadKey(e.code.slice(5));
  if (e.code === 'KeyU') toggleUV();
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
  if (ch === '#' || ch === ' ') return true;
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
let last = performance.now(), frameNo = 0;
function frame(now) {
  frameNo++;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G) update(dt);
  if (scene) {
    post.uniforms.time.value = now / 1000;
    if (quality === 'alta') {
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    } else renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
function update(dt) {
  const T = performance.now() / 1000;
  // animações (portas, cofres, itens)
  for (const d of G.doors) {
    if (!d.open && d.info.auto && Math.hypot(G.x - d.x, G.z - d.z) < 3.2) { d.open = true; snd.door(d.x, d.z); }
    const to = d.open ? 1 : 0; d.t += (to - d.t) * Math.min(1, dt * 2.2);
    d.mesh.position.y = WH / 2 + d.t * (WH - 0.12);
  }
  for (const a of G.anim) {
    if (a.card) { a.card.position.y = a.y0 + 0.06 + Math.sin(T * 2.5) * 0.03; a.card.rotation.y += dt * 1.2; }
    else a.obj.rotation[a.prop] += (a.to - a.obj.rotation[a.prop]) * Math.min(1, dt * 3);
  }
  for (const l of G.lights) {
    if (l.flicker) { if (Math.random() < 0.03) l.f = Math.random() < 0.5 ? 0.05 : 0.4; l.f += (1 - l.f) * Math.min(1, dt * 6); }
    l.light.intensity = l.base * (l.flicker ? l.f : 1);
    if (l.flicker) l.halo.material.opacity = 0.45 * l.f;
  }
  for (const l of G.emergency) {
    const k = 0.35 + 0.65 * Math.abs(Math.sin(T * 2.2));
    l.light.intensity = l.base * k; l.halo.material.opacity = 0.6 * k;
  }
  TEX.liquid.map.offset.y = (TEX.liquid.map.offset.y - dt * 0.04) % 1;
  TEX.liquid.map.offset.x = Math.sin(T * 0.3) * 0.05;
  for (const tk of G.tanks) tk.light.intensity = tk.base * (0.85 + 0.15 * Math.sin(T * 3 + tk.ph));
  for (const st of G.steam) {
    const k = (T * 0.5 + st.ph) % 1;
    st.sp.position.y = 2.5 - k * 1.2; st.sp.scale.setScalar(0.5 + k * 1.4); st.sp.material.opacity = 0.18 * Math.sin(k * Math.PI);
  }
  for (const m of G.uvMarks) m.visible = G.uv && Math.hypot(m.position.x - G.x, m.position.z - G.z) < 7;
  if (SEC.update) SEC.update(dt, T);
  if (G.morse.length) updateMorse(dt);
  if (G.drones.length) updateDrones(dt, T);

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
    // saída do setor: entrar na casa da porta de saída depois de aberta
    const ed = G.exitDoor;
    if (ed && ed.t > 0.85 && Math.floor(G.x / S) === ed.c && Math.floor(G.z / S) === ed.r) {
      if (SEC.onExit) SEC.onExit(); else nextSector();
    }
    if (G.countdown) {
      G.countdown.t -= dt;
      $('count').textContent = fmtTime(Math.max(0, G.countdown.t));
      if (G.countdown.t <= 0) { const cb = G.countdown.onFail; stopCountdown(); cb(); }
    }
  }
  camera.position.set(G.x, EYE + Math.sin(G.bob) * 0.035, G.z);
  camera.rotation.set(G.pitch, G.yaw, 0);
  const ph = Math.floor(G.bob / Math.PI);
  if (ph !== G.stepPh) { G.stepPh = ph; snd.step(); }
  snd.listener(G.x, EYE, G.z, -Math.sin(G.yaw) * Math.cos(G.pitch), Math.sin(G.pitch), -Math.cos(G.yaw) * Math.cos(G.pitch));
  snd.tick(dt, state === 'play' && !modalOpen());

  if (state === 'play') {
    target = modalOpen() ? null : findTarget();
    $('prompt').classList.toggle('hidden', !target); $('use').classList.toggle('hidden', !target);
    $('cross').classList.toggle('hot', !!target);
    if (target) $('prompt').textContent = target.p;
    $('timer').textContent = fmtTime(totalTime());
    $('objText').textContent = SEC.objective(G);
    $('secTxt').textContent = SEC.title;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  }
}

makeTextures();
newChapter(1);
loadSector(0, true);
G.yaw = 0.6; // vista do menu
refreshMenu();
requestAnimationFrame(frame);

// Ganchos para testes automáticos
window.etl = {
  snd, get frame() { return frameNo; }, get G() { return G; }, get CH() { return CH; }, get state() { return state; }, get sec() { return secIdx; }, get SEC() { return SEC; },
  interact: doInteract, get target() { return target && target.p; }, toggleUV,
  get simon() { return simon && { seq: simon.seq, busy: simon.busy }; }, get pipes() { return pipes; },
  get logic() { return logic; }, get laser() { return laser; }, get slide() { return slide; }, get mix() { return mix; }, get clock() { return clock; }
};
