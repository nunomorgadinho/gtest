import * as THREE from 'three';
import { snd } from './audio.js';
import { SECTORS } from './sectors.js';

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
  G.colliders.push({ x0: x - r - 0.1, x1: x + r + 0.1, z0: z - r - 0.1, z1: z + r + 0.1 });
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
  valve: { name: 'manípulo da válvula', short: 'Válvula', color: 0x4fc3f7, css: '#4fc3f7', kind: 'valve' }
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
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.3), new THREE.MeshLambertMaterial({ color: 0xf4efe1, emissive: 0x7dffcf, emissiveIntensity: 0.25 }));
  g.add(paper); hitbox(g, 0.5, 0.35, 0.5); scene.add(g);
  const halo = glowSprite(x, y + 0.1, z, 0x7dffcf, 0.8, 0.35);
  interact(g, () => 'Apanhar o documento Ω', () => {
    CH.found[n - 1] = true; scene.remove(g); scene.remove(halo); snd.pick(); renderInv(); saveChapter();
    showNote('FRAGMENTO ÓMEGA ' + n + '/4\n\nDígito: ' + CH.frags[n - 1] + '\n\n' + story);
  });
  G.anim.push({ card: g, y0: y });
}
function renderInv() {
  const html = Object.keys(ITEMS).filter((k) => G.inv[k]).map((k) =>
    '<div class="it" style="--c:' + ITEMS[k].css + '"><i></i>' + ITEMS[k].short + '</div>');
  CH.found.forEach((f, i) => { if (f) html.push('<div class="frag">Ω' + (i + 1) + '·' + CH.frags[i] + '</div>'); });
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

function newChapter() {
  CH = { sec: 0, frags: [0, 1, 2, 3].map(() => Math.floor(Math.random() * 10)), found: [false, false, false, false], time: 0 };
}
function saveChapter() { if (CH) save('etl_save', JSON.stringify({ sec: secIdx, frags: CH.frags, found: CH.found, time: CH.time })); }
function loadChapter() { try { const s = JSON.parse(load('etl_save')); return s && s.frags ? s : null; } catch (e) { return null; } }

function loadSector(i, preview) {
  secIdx = i; SEC = SECTORS[i]; CH.sec = i;
  if (SEC.prepare) SEC.prepare();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020304);
  scene.fog = new THREE.FogExp2(SEC.fog || 0x06080a, SEC.fogDensity || 0.045);
  scene.add(camera);
  soundWorld = { lights: [], tanks: [], steam: [], alarm: [], spots: [], server: null, core: null, creepy: SEC.creepy || 1 };
  G = {
    colliders: [], doors: [], lights: [], emergency: [], anim: [], tanks: [], uvMarks: [], steam: [], s: {},
    inv: {}, power: !!SEC.power, exitDoor: null, uv: false, countdown: null,
    x: SEC.start[0] * S, z: SEC.start[1] * S, yaw: SEC.start[2], pitch: 0, bob: 0, time: 0, done: false
  };
  scene.add(new THREE.HemisphereLight(0x7d92b3, 0x1e1710, SEC.ambient == null ? 0.6 : SEC.ambient));
  buildStructure();
  SEC.build(api);
  // pontos aleatórios para sons de ambiente
  const fl = [];
  SEC.map.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '.') fl.push([(c + 0.5) * S, (r + 0.5) * S]); }));
  for (let k = 0; k < 10; k++) soundWorld.spots.push(fl[Math.floor(Math.random() * fl.length)]);
  snd.setWorld(soundWorld); snd.setPower(G.power); snd.klaxonOn(false);
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

// ---------- Interface ----------
let toastT = 0;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.style.opacity = 1; toastT = 3.6; }
function showNote(text, screenish) {
  snd.note();
  $('modalText').textContent = text; $('paper').classList.toggle('screenish', !!screenish);
  $('modal').classList.remove('hidden');
}
$('modalOk').addEventListener('click', () => $('modal').classList.add('hidden'));
const OVERLAYS = ['modal', 'keypad', 'terminal', 'simon', 'pipes'];
function modalOpen() { return OVERLAYS.some((id) => !$(id).classList.contains('hidden')); }
function closeOverlays() { closeKeypad(); closeTerminal(); closeSimon(); closePipes(); $('modal').classList.add('hidden'); }

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
  if (secIdx < 4 && !CH.found[secIdx]) { CH.found[secIdx] = true; CH.pending = 'Encontraste no bolso um papel amarrotado: <b>Ω' + (secIdx + 1) + ' · ' + CH.frags[secIdx] + '</b>.'; }
  if (secIdx + 1 < SECTORS.length) enterSector(secIdx + 1);
}
// Final do capítulo: o elevador sobe... e para.
function playEnding() {
  if (G.done) return;
  G.done = true; CH.time += G.time; G.time = 0; stopCountdown();
  state = 'story'; $('hud').classList.add('hidden'); resetInput();
  const lines = [
    [0, 'O elevador começa a subir.', () => snd.elevator(7)],
    [3500, 'Nível −6 … −5 … −4 …'],
    [7600, 'De repente, para.', () => snd.sting()],
    [10200, 'As luzes apagam-se. Só se ouve o zumbido do altifalante.', () => snd.radio()],
    [14200, '«Muito bem, Sujeito 12. Exatamente como previsto.»', () => snd.radio()],
    [18200, '«Teste 7 concluído. Preparem a sala para o Teste 8.»', () => snd.radio()],
    [22400, 'Sentes uma picada no pescoço. O chão foge-te dos pés…', () => snd.sting()]
  ];
  $('story').classList.remove('hidden'); $('storyText').innerHTML = '';
  lines.forEach(([ms, txt, fx]) => setTimeout(() => {
    const p = document.createElement('p'); p.textContent = txt; $('storyText').appendChild(p);
    requestAnimationFrame(() => p.classList.add('in'));
    if (fx) fx();
  }, ms));
  setTimeout(() => {
    $('story').classList.add('hidden');
    const best = parseFloat(load('etl_best_ch1')), rec = !best || CH.time < best;
    if (rec) save('etl_best_ch1', CH.time.toFixed(1));
    save('etl_ch1_done', '1'); save('etl_save', '');
    $('winTxt').innerHTML = 'Tempo do capítulo: <b>' + fmtTime(CH.time) + '</b>' + (rec ? ' (novo recorde!)' : '<br>Melhor tempo: ' + fmtTime(best)) +
      '<br><br>O LAB-7 ainda não acabou contigo.';
    setState('end'); refreshMenu();
  }, 27500);
}

function refreshMenu() {
  const sv = loadChapter();
  $('contBtn').classList.toggle('hidden', !sv);
  if (sv) $('contBtn').textContent = 'CONTINUAR — ' + SECTORS[sv.sec].title;
  const b = parseFloat(load('etl_best_ch1'));
  $('bestTxt').textContent = b ? 'Melhor tempo do Capítulo 1: ' + fmtTime(b) : '';
}
$('playBtn').addEventListener('click', () => { audio(); newChapter(); enterSector(0); });
$('contBtn').addEventListener('click', () => {
  audio(); const sv = loadChapter(); if (!sv) return;
  CH = { sec: sv.sec, frags: sv.frags, found: sv.found, time: sv.time || 0 }; enterSector(sv.sec);
});
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
newChapter();
loadSector(0, true);
G.yaw = 0.6; // vista do menu
refreshMenu();
requestAnimationFrame(frame);

// Ganchos para testes automáticos
window.etl = {
  snd, get frame() { return frameNo; }, get G() { return G; }, get CH() { return CH; }, get state() { return state; }, get sec() { return secIdx; }, get SEC() { return SEC; },
  interact: doInteract, get target() { return target && target.p; }, toggleUV,
  get simon() { return simon && { seq: simon.seq, busy: simon.busy }; }, get pipes() { return pipes; }
};
