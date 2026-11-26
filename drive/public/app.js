'use strict';
/* Nuvem: frontend (JavaScript simples, sem frameworks). */

// ---------- Ícones (SVG inline) ----------
const P = {
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  drive: 'M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95A5.469 5.469 0 0 1 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11A2.98 2.98 0 0 1 22 15c0 1.65-1.35 3-3 3z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  clock: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  star: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  starFill: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  trash: 'M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z',
  grid: 'M3 3v8h8V3H3zm6 6H5V5h4v4zm-6 4v8h8v-8H3zm6 6H5v-4h4v4zm4-16v8h8V3h-8zm6 6h-4V5h4v4zm-6 4v8h8v-8h-8zm6 6h-4v-4h4v4z',
  rows: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z',
  folderUp: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10zM8 13.01l1.41 1.41L11 12.84V17h2v-4.16l1.59 1.59L16 13.01 12.01 9 8 13.01z',
  newFolder: 'M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z',
  folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  folderShared: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8h-8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z',
  file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  pdf: 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z',
  video: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  audio: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  zip: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
  code: 'M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z',
  sheet: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 8h-8v8H9v-8H5V9h4V5h2v4h8v2z',
  slides: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H5V8h14v8z',
  doc: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0 4H7v-2h10v2zm0-8H7V7h10v2z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  share: 'M15 8c0-1.42-.5-2.73-1.33-3.76.42-.14.86-.24 1.33-.24 2.21 0 4 1.79 4 4s-1.79 4-4 4c-.43 0-.84-.09-1.23-.21-.03-.01-.06-.02-.1-.03A5.98 5.98 0 0 0 15 8zm1.66 5.13C18.03 14.06 19 15.32 19 17v3h4v-3c0-2.18-3.58-3.47-6.34-3.87zM9 4c2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4 1.79-4 4-4zm0 9c2.67 0 8 1.34 8 4v3H1v-3c0-2.66 5.33-4 8-4z',
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  move: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 12v-3h-4v-4h4V8l5 5-5 5z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  restore: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  forever: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l1.41-1.41L12 12.59l2.12-2.12 1.41 1.41L13.41 14l2.12 2.12-1.41 1.41L12 15.41l-2.12 2.12-1.41-1.41L10.59 14l-2.13-2.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z',
  leave: 'M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  home: 'M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3z',
  heart: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  heartFill: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  chevron: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
};
const icon = (name, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true"><path d="${P[name]}"/></svg>`;
const hydrateIcons = (root = document) =>
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (!el.querySelector('svg')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });

// ---------- Utilitários ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function fmtSize(n) {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i && n < 10 ? 1 : 0)} ${u[i]}`;
}
function fmtDate(ms) {
  const d = new Date(ms);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}
function kind(item) {
  if (item.type === 'folder') return item.shared ? 'folderShared' : 'folder';
  const m = item.mime || '';
  const ext = item.name.split('.').pop().toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (/zip|rar|7z|tar|gzip/.test(m) || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return 'zip';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return 'slides';
  if (['doc', 'docx', 'odt', 'rtf', 'md', 'txt'].includes(ext)) return 'doc';
  if (['js', 'ts', 'py', 'json', 'html', 'css', 'php', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'sh', 'xml', 'yml', 'yaml'].includes(ext)) return 'code';
  return 'file';
}
const GROUP = { image: 'img', pdf: 'pdf', video: 'video', audio: 'audio', zip: 'zip', sheet: 'sheet', slides: 'slides', doc: 'doc', code: 'code', file: 'file' };
function extLabel(item) {
  const dot = item.name.lastIndexOf('.');
  const e = dot > 0 ? item.name.slice(dot + 1) : '';
  return (e && e.length <= 5 ? e : 'FICH').toUpperCase();
}
const extBadge = (item, big = false) => `<span class="ext ext-${GROUP[kind(item)]}${big ? ' big' : ''}">${esc(extLabel(item))}</span>`;
function tint(item) {
  let h = 0;
  for (const c of item.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--t${(h % 6) + 1})`;
}
const itemIcon = (item) => item.type === 'folder'
  ? `<span class="folder-ico" style="--tint:${tint(item)}">${icon(item.shared ? 'folderShared' : 'folder')}</span>`
  : extBadge(item);
const canPreview = (item) => ['image', 'pdf', 'video', 'audio', 'doc', 'code'].includes(kind(item)) &&
  !/\.(docx?|odt|rtf)$/i.test(item.name);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

async function api(path, opts = {}) {
  const init = { method: opts.method || 'GET', headers: { 'X-Nuvem': '1' }, credentials: 'same-origin' };
  if (opts.body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith('/api/login')) { showAuth(); throw new Error(data.error || 'Sessão expirada'); }
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

// ---------- Estado ----------
const state = {
  user: null,
  view: 'mydrive',
  folderId: null,
  folder: null,
  items: [],
  selected: new Set(),
  layout: 'grid',
  search: '',
};
try { state.layout = localStorage.getItem('layout') || 'grid'; } catch { state.layout = 'grid'; }

const VIEW_TITLES = { mydrive: 'Os meus ficheiros', shared: 'Partilhados comigo', recent: 'Recentes', starred: 'Favoritos', trash: 'Reciclagem' };

// ---------- Autenticação ----------
let registering = false;
function setAuthMode(reg) {
  registering = reg;
  $('#auth-title').textContent = reg ? 'Criar conta' : 'Iniciar sessão';
  $('#auth-sub').textContent = reg ? 'Cria a tua conta Nuvem gratuita (15 GB)' : 'Usa a tua conta Nuvem';
  $('#name-field').hidden = !reg;
  $('#name-field input').required = reg;
  $('#auth-submit').textContent = reg ? 'Criar conta' : 'Entrar';
  $('#auth-toggle').textContent = reg ? 'Já tenho conta' : 'Criar conta';
  $('#auth-form [name=password]').autocomplete = reg ? 'new-password' : 'current-password';
  $('#auth-error').textContent = '';
}
function showAuth() {
  state.user = null;
  $('#app').hidden = true;
  $('#auth').hidden = false;
  document.title = 'Nuvem';
}
$('#auth-toggle').onclick = () => setAuthMode(!registering);
$('#auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = Object.fromEntries(f);
  $('#auth-error').textContent = '';
  try {
    await api(registering ? '/api/register' : '/api/login', { method: 'POST', body });
    e.target.reset();
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
  }
};

async function boot() {
  try {
    const me = await api('/api/me');
    state.user = me.user;
    renderStorage(me.usage, me.quota);
  } catch {
    showAuth();
    return;
  }
  $('#auth').hidden = true;
  $('#app').hidden = false;
  const a = $('#avatar-btn');
  a.textContent = (state.user.name[0] || '?').toUpperCase();
  a.title = `${state.user.name}\n${state.user.email}`;
  route();
}

async function refreshStorage() {
  try { const me = await api('/api/me'); renderStorage(me.usage, me.quota); } catch {}
}
function renderStorage(used, quota) {
  $('#storage-fill').style.width = `${Math.min(100, (used / quota) * 100).toFixed(1)}%`;
  $('#storage-text').textContent = `${fmtSize(used)} de ${fmtSize(quota)} utilizados`;
}

// ---------- Navegação ----------
function route() {
  const [view = 'mydrive', id] = location.hash.replace(/^#\/?/, '').split('/');
  state.view = VIEW_TITLES[view] ? view : 'mydrive';
  state.folderId = (view === 'folder' && Number(id)) || null;
  if (view === 'folder') state.view = 'folder';
  state.search = '';
  $('#search').value = '';
  load();
}
window.addEventListener('hashchange', route);
const goFolder = (id) => { location.hash = `#/folder/${id}`; };

async function load() {
  state.selected.clear();
  const params = new URLSearchParams();
  if (state.search) params.set('q', state.search);
  else if (state.view === 'folder') { params.set('view', 'mydrive'); params.set('parent', state.folderId); }
  else params.set('view', state.view);
  const list = $('#list');
  try {
    const data = await api(`/api/items?${params}`);
    state.items = data.items;
    state.folder = data.folder;
    state.path = data.path;
    render();
  } catch (e) {
    state.items = [];
    state.folder = null;
    list.innerHTML = `<div class="empty"><div class="blob">${icon('error')}</div><h3>${esc(e.message)}</h3></div>`;
    renderCrumbs();
  }
  document.querySelectorAll('.nav a').forEach((a) => {
    const v = state.view === 'folder' ? state.path?.root || 'mydrive' : state.view;
    a.classList.toggle('active', !state.search && a.dataset.view === v);
  });
  $('#sidebar').classList.remove('open');
}

// Pasta atual onde se pode criar/carregar (null = raiz do Meu Drive).
function uploadTarget() {
  if (state.view === 'folder' && state.folder) return state.folder.role === 'viewer' ? undefined : state.folder.id;
  if (state.view === 'mydrive' && !state.search) return null;
  return null;
}

// ---------- Renderização ----------
function renderCrumbs() {
  const c = $('#crumbs');
  if (state.search) { c.innerHTML = `<button>Resultados para “${esc(state.search)}”</button>`; return; }
  if (state.view !== 'folder') { c.innerHTML = `<button>${VIEW_TITLES[state.view]}</button>`; return; }
  if (!state.path) { c.innerHTML = ''; return; }
  const sep = `<span class="sep">${icon('chevron')}</span>`;
  const rootName = VIEW_TITLES[state.path.root];
  const parts = [`<button data-go="#/${state.path.root}">${rootName}</button>`];
  for (const p of state.path.items) parts.push(`<button data-go="#/folder/${p.id}" title="${esc(p.name)}">${esc(p.name)}</button>`);
  c.innerHTML = parts.join(sep);
  c.querySelectorAll('[data-go]').forEach((b, i, all) => {
    if (i < all.length - 1) b.onclick = () => { location.hash = b.dataset.go; };
  });
  c.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('dragover', (e) => e.preventDefault()));
}

function emptyState() {
  const m = {
    mydrive: ['Começa a encher a tua Nuvem', 'Arrasta ficheiros para aqui ou carrega em “Adicionar”'],
    folder: ['Esta pasta está vazia', 'Arrasta ficheiros para aqui ou carrega em “Adicionar”'],
    shared: ['Nada partilhado contigo', 'Os ficheiros e pastas que outras pessoas partilharem contigo aparecem aqui'],
    recent: ['Sem ficheiros recentes', 'Os ficheiros que abrires ou carregares aparecem aqui'],
    starred: ['Ainda sem favoritos', 'Marca com um coração o que queres ter sempre à mão'],
    trash: ['A reciclagem está vazia', 'O que apagares fica aqui até o eliminares para sempre'],
  };
  const [h, p] = state.search ? ['Sem resultados', 'Tenta outra pesquisa'] : m[state.view];
  const ico = { trash: 'trash', shared: 'people', starred: 'heart', recent: 'clock' }[state.view] || 'upload';
  const bg = { trash: 't5', shared: 't3', starred: 't6', recent: 't2' }[state.view] || 't1';
  return `<div class="empty"><div class="blob" style="background:var(--${state.search ? 't4' : bg})">${icon(state.search ? 'search' : ico)}</div><h3>${h}</h3><p>${p}</p></div>`;
}

function render() {
  renderCrumbs();
  const list = $('#list');
  $('#empty-trash').hidden = state.view !== 'trash' || !state.items.length;
  $('#layout-btn').innerHTML = icon(state.layout === 'grid' ? 'rows' : 'grid');
  document.title = `${state.folder?.name || (state.search ? 'Pesquisa' : VIEW_TITLES[state.view])} · Nuvem`;
  if (!state.items.length) { list.innerHTML = emptyState(); return; }

  if (state.layout === 'grid') {
    const folders = state.items.filter((i) => i.type === 'folder');
    const files = state.items.filter((i) => i.type === 'file');
    const more = `<button class="icon-btn" data-more aria-label="Mais ações">${icon('more')}</button>`;
    const fav = (i) => (i.starred ? `<span class="fav" title="Favorito">${icon('heartFill')}</span>` : '');
    const card = (i) => i.type === 'folder'
      ? `<div class="card folder" data-id="${i.id}" draggable="${i.role === 'owner'}" tabindex="0" style="--tint:${tint(i)}">
          <span class="glyph">${icon(i.shared ? 'folderShared' : 'folder')}</span>
          <div class="info"><span class="name" title="${esc(i.name)}">${esc(i.name)}</span><span class="meta">${i.owner === 'eu' ? fmtDate(i.updatedAt) : esc(i.owner)}</span></div>
          ${fav(i)}${more}</div>`
      : `<div class="card" data-id="${i.id}" draggable="${i.role === 'owner'}" tabindex="0">
          <div class="card-thumb">${kind(i) === 'image' ? `<img loading="lazy" alt="" src="/api/items/${i.id}/content?inline=1">` : extBadge(i, true)}</div>
          <div class="card-foot"><div class="info"><span class="name" title="${esc(i.name)}">${esc(i.name)}</span>
            <span class="meta">${fmtSize(i.size)} · ${i.owner === 'eu' ? fmtDate(i.updatedAt) : esc(i.owner)}</span></div>${fav(i)}${more}</div>
        </div>`;
    list.innerHTML =
      (folders.length ? `<div class="section-label">Pastas</div><div class="grid">${folders.map(card).join('')}</div>` : '') +
      (files.length ? `<div class="section-label">Ficheiros</div><div class="grid">${files.map(card).join('')}</div>` : '');
  } else {
    const dateLabel = state.view === 'trash' ? 'Eliminado' : 'Modificado';
    list.innerHTML = `<table class="rows"><thead><tr><th>Nome</th>
      <th class="col-owner">Dono</th><th class="col-date">${dateLabel}</th><th class="col-size">Tamanho</th><th class="col-act"></th></tr></thead><tbody>
      ${state.items.map((i) => `<tr class="row" data-id="${i.id}" draggable="${i.role === 'owner'}" tabindex="0">
        <td class="name-cell"><div class="name-wrap">${itemIcon(i)}<span class="n" title="${esc(i.name)}">${esc(i.name)}</span>
          ${i.shared ? `<span class="badge" title="Partilhado">${icon('people')}</span>` : ''}
          ${i.starred ? `<span class="fav">${icon('heartFill')}</span>` : ''}</div></td>
        <td class="c-owner">${esc(i.owner)}</td>
        <td>${fmtDate(state.view === 'trash' ? i.trashedAt : i.updatedAt)}</td>
        <td class="c-size">${i.type === 'file' ? fmtSize(i.size) : '—'}</td>
        <td><button class="icon-btn" data-more aria-label="Mais ações">${icon('more')}</button></td></tr>`).join('')}
      </tbody></table>`;
  }
  bindItems();
}

function bindItems() {
  $('#list').querySelectorAll('[data-id]').forEach((el) => {
    const item = state.items.find((i) => i.id === Number(el.dataset.id));
    el.onclick = (e) => {
      if (e.target.closest('[data-more]')) { e.stopPropagation(); select(item, el, e); openMenu(item, e.target.closest('[data-more]')); return; }
      select(item, el, e);
    };
    el.ondblclick = () => openItem(item);
    el.onkeydown = (e) => { if (e.key === 'Enter') openItem(item); if (e.key === 'Delete') trashItems([item]); };
    el.oncontextmenu = (e) => { e.preventDefault(); if (!state.selected.has(item.id)) select(item, el, e); openMenu(item, null, e.clientX, e.clientY); };

    // Arrastar itens para dentro de pastas
    el.ondragstart = (e) => {
      if (!state.selected.has(item.id)) select(item, el, {});
      e.dataTransfer.setData('application/x-nuvem', JSON.stringify([...state.selected]));
      e.dataTransfer.effectAllowed = 'move';
    };
    if (item.type === 'folder' && item.role !== 'viewer' && state.view !== 'trash') {
      el.ondragover = (e) => { if (e.dataTransfer.types.includes('application/x-nuvem') || e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); el.classList.add('drop-target'); } };
      el.ondragleave = () => el.classList.remove('drop-target');
      el.ondrop = async (e) => {
        e.preventDefault(); e.stopPropagation();
        el.classList.remove('drop-target');
        $('#main').classList.remove('dragging');
        const raw = e.dataTransfer.getData('application/x-nuvem');
        if (raw) {
          const ids = JSON.parse(raw).filter((id) => id !== item.id);
          await moveItems(ids, item.id, item.name);
        } else {
          uploadEntries(e.dataTransfer, item.id);
        }
      };
    }
  });
}

function select(item, el, e) {
  if (!(e.ctrlKey || e.metaKey)) {
    state.selected.clear();
    document.querySelectorAll('#list .selected').forEach((n) => n.classList.remove('selected'));
  }
  if (state.selected.has(item.id) && (e.ctrlKey || e.metaKey)) { state.selected.delete(item.id); el.classList.remove('selected'); }
  else { state.selected.add(item.id); el.classList.add('selected'); }
}
const selectedItems = (fallback) => {
  const s = state.items.filter((i) => state.selected.has(i.id));
  return s.length && s.some((i) => i.id === fallback.id) ? s : [fallback];
};

$('#main').addEventListener('click', (e) => {
  if (!e.target.closest('[data-id]')) { state.selected.clear(); document.querySelectorAll('#list .selected').forEach((n) => n.classList.remove('selected')); }
});

// ---------- Menu ----------
const menu = $('#menu');
function showMenu(entries, x, y) {
  menu.innerHTML = entries.map((e, i) => (e === '-' ? '<hr>' : `<button data-i="${i}">${icon(e.icon)}${esc(e.label)}</button>`)).join('');
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 8))}px`;
  menu.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { hideMenu(); entries[b.dataset.i].run(); }));
  menu.querySelector('button')?.focus();
}
const hideMenu = () => { menu.hidden = true; };
document.addEventListener('mousedown', (e) => { if (!menu.hidden && !menu.contains(e.target)) hideMenu(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideMenu(); });
window.addEventListener('blur', hideMenu);
window.addEventListener('resize', hideMenu);

function openMenu(item, anchor, x, y) {
  if (anchor) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
  const items = selectedItems(item);
  const multi = items.length > 1;
  const e = [];
  if (state.view === 'trash') {
    e.push({ icon: 'restore', label: multi ? `Restaurar ${items.length} itens` : 'Restaurar', run: () => restoreItems(items) });
    e.push({ icon: 'forever', label: 'Eliminar para sempre', run: () => deleteForever(items) });
    return showMenu(e, x, y);
  }
  if (!multi) {
    e.push({ icon: 'open', label: 'Abrir', run: () => openItem(item) });
    if (item.type === 'file') e.push({ icon: 'download', label: 'Transferir', run: () => download(item) });
    e.push('-');
    if (item.role !== 'viewer') e.push({ icon: 'edit', label: 'Mudar o nome', run: () => renameItem(item) });
    if (item.type === 'file') e.push({ icon: 'copy', label: 'Fazer uma cópia', run: () => copyItem(item) });
    e.push({ icon: 'share', label: 'Partilhar', run: () => openShare(item) });
  }
  if (items.every((i) => i.role === 'owner')) {
    e.push({ icon: 'move', label: multi ? `Mover ${items.length} itens` : 'Mover', run: () => openMove(items) });
    const allStarred = items.every((i) => i.starred);
    e.push({ icon: allStarred ? 'heartFill' : 'heart', label: allStarred ? 'Tirar dos favoritos' : 'Juntar aos favoritos', run: () => star(items, !allStarred) });
    e.push('-');
    e.push({ icon: 'trash', label: 'Apagar', run: () => trashItems(items) });
  } else if (!multi && state.view === 'shared') {
    e.push('-');
    e.push({ icon: 'leave', label: 'Remover da minha lista', run: () => leaveShare(item) });
  }
  showMenu(e, x, y);
}

$('#new-btn').onclick = $('#fab').onclick = (e) => {
  const target = uploadTarget();
  if (target === undefined) return toast('Só tens permissão de leitura nesta pasta');
  $('#sidebar').classList.remove('open');
  const r = e.currentTarget.getBoundingClientRect();
  showMenu([
    { icon: 'newFolder', label: 'Nova pasta', run: newFolder },
    '-',
    { icon: 'upload', label: 'Carregar ficheiros', run: () => $('#file-input').click() },
    ...(window.NuvemApp ? [] : [{ icon: 'folderUp', label: 'Carregar pasta', run: () => $('#folder-input').click() }]),
  ], r.left, e.currentTarget.id === 'fab' ? r.top - (window.NuvemApp ? 150 : 190) : r.bottom + 4);
};

$('#main').addEventListener('contextmenu', (e) => {
  if (e.target.closest('[data-id]') || state.view === 'trash') return;
  const target = uploadTarget();
  if (target === undefined || (state.view !== 'mydrive' && state.view !== 'folder') || state.search) return;
  e.preventDefault();
  showMenu([
    { icon: 'newFolder', label: 'Nova pasta', run: newFolder },
    '-',
    { icon: 'upload', label: 'Carregar ficheiros', run: () => $('#file-input').click() },
    { icon: 'folderUp', label: 'Carregar pasta', run: () => $('#folder-input').click() },
  ], e.clientX, e.clientY);
});

// ---------- Diálogos ----------
function prompt2(title, value = '', okLabel = 'OK') {
  const dlg = $('#prompt-dlg');
  $('#prompt-title').textContent = title;
  $('#prompt-ok').textContent = okLabel;
  const input = $('#prompt-input');
  input.value = value;
  dlg.returnValue = '';
  dlg.showModal();
  const dot = value.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : value.length);
  return new Promise((resolve) => {
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? input.value.trim() : null);
  });
}
function confirm2(title, text, okLabel) {
  const dlg = $('#confirm-dlg');
  $('#confirm-title').textContent = title;
  $('#confirm-text').textContent = text;
  $('#confirm-ok').textContent = okLabel;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => { dlg.onclose = () => resolve(dlg.returnValue === 'ok'); });
}

// ---------- Ações ----------
async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message); }
}

async function newFolder() {
  const parent = uploadTarget();
  const name = await prompt2('Nova pasta', 'Pasta sem título', 'Criar');
  if (!name) return;
  await act(() => api('/api/folders', { method: 'POST', body: { name, parent } }), 'Pasta criada');
  load();
}
async function renameItem(item) {
  const name = await prompt2('Mudar o nome', item.name, 'OK');
  if (!name || name === item.name) return;
  await act(() => api(`/api/items/${item.id}`, { method: 'PATCH', body: { name } }));
  load();
}
async function copyItem(item) {
  await act(() => api(`/api/items/${item.id}/copy`, { method: 'POST' }), 'Cópia criada');
  load(); refreshStorage();
}
async function star(items, starred) {
  await act(() => Promise.all(items.map((i) => api(`/api/items/${i.id}`, { method: 'PATCH', body: { starred } }))));
  load();
}
async function trashItems(items) {
  items = items.filter((i) => i.role === 'owner');
  if (!items.length) return toast('Só o dono pode apagar');
  await act(() => Promise.all(items.map((i) => api(`/api/items/${i.id}`, { method: 'DELETE' }))),
    items.length > 1 ? `${items.length} itens enviados para a reciclagem` : `“${items[0].name}” enviado para a reciclagem`);
  load();
}
async function restoreItems(items) {
  await act(() => Promise.all(items.map((i) => api(`/api/items/${i.id}/restore`, { method: 'POST' }))),
    items.length > 1 ? `${items.length} itens restaurados` : `“${items[0].name}” restaurado`);
  load();
}
async function deleteForever(items) {
  const ok = await confirm2('Eliminar para sempre?', items.length > 1
    ? `${items.length} itens vão ser eliminados para sempre. Não é possível anular esta ação.`
    : `“${items[0].name}” vai ser eliminado para sempre. Não é possível anular esta ação.`, 'Eliminar para sempre');
  if (!ok) return;
  await act(() => Promise.all(items.map((i) => api(`/api/items/${i.id}/permanent`, { method: 'DELETE' }))), 'Eliminado');
  load(); refreshStorage();
}
$('#empty-trash').onclick = async () => {
  const ok = await confirm2('Esvaziar a reciclagem?', 'Todos os itens na reciclagem vão ser eliminados para sempre. Não é possível anular esta ação.', 'Esvaziar');
  if (!ok) return;
  await act(() => api('/api/trash', { method: 'DELETE' }), 'Reciclagem esvaziada');
  load(); refreshStorage();
};
async function leaveShare(item) {
  await act(() => api(`/api/items/${item.id}/shares/${state.user.id}`, { method: 'DELETE' }), 'Removido da tua lista');
  load();
}
function download(item) {
  const a = document.createElement('a');
  a.href = `/api/items/${item.id}/content`;
  a.download = item.name;
  document.body.append(a);
  a.click();
  a.remove();
}
function openItem(item) {
  if (state.view === 'trash') return toast('Restaura o item para o abrires');
  if (item.type === 'folder') return goFolder(item.id);
  openPreview(item);
}

// ---------- Pré-visualização ----------
let previewList = [];
let previewIdx = 0;
function openPreview(item) {
  previewList = state.items.filter((i) => i.type === 'file');
  previewIdx = previewList.findIndex((i) => i.id === item.id);
  $('#preview').hidden = false;
  showPreview();
}
function showPreview() {
  const item = previewList[previewIdx];
  const body = $('#preview-body');
  const src = `/api/items/${item.id}/content?inline=1`;
  $('#preview-name').textContent = item.name;
  $('#preview-download').href = `/api/items/${item.id}/content`;
  $('#preview-download').setAttribute('download', item.name);
  $('#preview-prev').disabled = previewIdx <= 0;
  $('#preview-next').disabled = previewIdx >= previewList.length - 1;
  const k = kind(item);
  if (!canPreview(item)) {
    body.innerHTML = `<div class="no-preview">${extBadge(item, true)}<p>Não é possível pré-visualizar este ficheiro</p>
      <a class="btn filled" href="/api/items/${item.id}/content" download>${icon('download')}Transferir</a></div>`;
  } else if (k === 'image') body.innerHTML = `<img alt="${esc(item.name)}" src="${src}">`;
  else if (k === 'video') body.innerHTML = `<video controls autoplay src="${src}"></video>`;
  else if (k === 'audio') body.innerHTML = `<audio controls autoplay src="${src}"></audio>`;
  else body.innerHTML = `<iframe title="${esc(item.name)}" src="${src}"></iframe>`;
}
function closePreview() { $('#preview').hidden = true; $('#preview-body').innerHTML = ''; }
$('#preview-close').onclick = closePreview;
$('#preview-prev').onclick = () => { if (previewIdx > 0) { previewIdx--; showPreview(); } };
$('#preview-next').onclick = () => { if (previewIdx < previewList.length - 1) { previewIdx++; showPreview(); } };
document.addEventListener('keydown', (e) => {
  if ($('#preview').hidden) return;
  if (e.key === 'Escape') closePreview();
  if (e.key === 'ArrowLeft') $('#preview-prev').click();
  if (e.key === 'ArrowRight') $('#preview-next').click();
});

// ---------- Partilha ----------
let shareItem = null;
async function openShare(item) {
  shareItem = item;
  $('#share-title').textContent = `Partilhar “${item.name}”`;
  $('#share-error').textContent = '';
  $('#share-email').value = '';
  $('#share-dlg').showModal();
  await renderShare();
}
async function renderShare() {
  const data = await act(() => api(`/api/items/${shareItem.id}/shares`));
  if (!data) return;
  const av = (u) => `<button class="avatar" tabindex="-1">${esc((u.name[0] || '?').toUpperCase())}</button>`;
  const me = state.user.id;
  $('#share-form').hidden = !data.canManage;
  $('#share-people').innerHTML =
    `<li>${av(data.owner)}<div class="who"><b>${esc(data.owner.name)}${data.owner.id === me ? ' (tu)' : ''}</b><small>${esc(data.owner.email)}</small></div><span class="muted">Dono</span></li>` +
    data.people.map((p) => `<li>${av(p)}<div class="who"><b>${esc(p.name)}${p.id === me ? ' (tu)' : ''}</b><small>${esc(p.email)}</small></div>
      ${data.canManage ? `<select data-user="${p.id}"><option value="viewer" ${p.role === 'viewer' ? 'selected' : ''}>Leitor</option>
        <option value="editor" ${p.role === 'editor' ? 'selected' : ''}>Editor</option><option value="remove">Remover acesso</option></select>`
        : `<span class="muted">${p.role === 'editor' ? 'Editor' : 'Leitor'}</span>`}</li>`).join('');
  $('#share-people').querySelectorAll('select').forEach((s) => (s.onchange = async () => {
    const p = data.people.find((x) => x.id === Number(s.dataset.user));
    if (s.value === 'remove') await act(() => api(`/api/items/${shareItem.id}/shares/${p.id}`, { method: 'DELETE' }), 'Acesso removido');
    else await act(() => api(`/api/items/${shareItem.id}/shares`, { method: 'POST', body: { email: p.email, role: s.value } }), 'Permissão atualizada');
    renderShare();
  }));
  const pub = $('#public-toggle');
  pub.closest('.public-row').hidden = !data.canManage;
  pub.checked = !!data.publicToken;
  setPublicLink(data.publicToken);
}
function setPublicLink(token) {
  $('#link-row').hidden = !token;
  $('#public-link').value = token ? `${location.origin}/s/${token}` : '';
}
$('#share-form').onsubmit = async (e) => {
  e.preventDefault();
  $('#share-error').textContent = '';
  try {
    await api(`/api/items/${shareItem.id}/shares`, { method: 'POST', body: { email: $('#share-email').value, role: $('#share-role').value } });
    $('#share-email').value = '';
    toast('Partilhado');
    renderShare();
  } catch (err) { $('#share-error').textContent = err.message; }
};
$('#public-toggle').onchange = async (e) => {
  const r = await act(() => api(`/api/items/${shareItem.id}/public`, { method: 'POST', body: { enabled: e.target.checked } }));
  if (r) setPublicLink(r.publicToken);
};
$('#copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText($('#public-link').value); toast('Link copiado'); }
  catch { $('#public-link').select(); document.execCommand('copy'); toast('Link copiado'); }
};
$('#share-done').onclick = () => { $('#share-dlg').close(); load(); };

// ---------- Mover ----------
let moveState = { items: [], folder: null };
function openMove(items) {
  moveState = { items, folder: null };
  $('#move-title').textContent = items.length > 1 ? `Mover ${items.length} itens` : `Mover “${items[0].name}”`;
  $('#move-dlg').showModal();
  renderMove();
}
async function renderMove() {
  const data = await act(() => api(`/api/folders?parent=${moveState.folder ?? 'root'}`));
  if (!data) return;
  const moving = new Set(moveState.items.map((i) => i.id));
  const sep = `<span class="sep">${icon('chevron')}</span>`;
  $('#move-crumbs').innerHTML = [`<button data-f="root">Os meus ficheiros</button>`, ...data.path.map((p) => `<button data-f="${p.id}">${esc(p.name)}</button>`)].join(sep);
  $('#move-crumbs').querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { moveState.folder = b.dataset.f === 'root' ? null : Number(b.dataset.f); renderMove(); }));
  $('#move-list').innerHTML = data.folders.length
    ? data.folders.map((f) => `<li data-f="${f.id}" class="${moving.has(f.id) ? 'disabled' : ''}"><span class="folder-ico" style="--tint:${tint(f)}">${icon('folder')}</span><span class="grow">${esc(f.name)}</span>${icon('chevron')}</li>`).join('')
    : '<li class="empty-note">Sem subpastas</li>';
  $('#move-list').querySelectorAll('[data-f]').forEach((li) => {
    if (li.classList.contains('disabled')) return;
    li.onclick = () => { moveState.folder = Number(li.dataset.f); renderMove(); };
  });
}
$('#move-cancel').onclick = () => $('#move-dlg').close();
$('#move-ok').onclick = async () => {
  $('#move-dlg').close();
  const name = $('#move-crumbs button:last-of-type')?.textContent || 'Os meus ficheiros';
  await moveItems(moveState.items.map((i) => i.id), moveState.folder, name);
};
async function moveItems(ids, parent, name) {
  if (!ids.length) return;
  await act(() => Promise.all(ids.map((id) => api(`/api/items/${id}`, { method: 'PATCH', body: { parent: parent ?? 'root' } }))),
    `${ids.length > 1 ? `${ids.length} itens movidos` : 'Movido'} para “${name}”`);
  load();
}

// ---------- Carregar ficheiros ----------
const uploadsBox = $('#uploads');
let pending = 0;
function uploadFiles(files, parent, paths) {
  if (!files.length) return;
  if (parent === undefined) return toast('Só tens permissão de leitura nesta pasta');
  uploadsBox.hidden = false;
  const li = document.createElement('li');
  const label = files.length === 1 ? files[0].name : `${files.length} ficheiros`;
  li.innerHTML = `<span class="prog"></span><span class="grow">${esc(label)}</span>`;
  $('#uploads-list').prepend(li);
  pending++;
  updateUploadsTitle();

  const fd = new FormData();
  files.forEach((f, i) => { fd.append('paths', paths?.[i] || f.name); });
  files.forEach((f) => fd.append('files', f, f.name));
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `/api/upload?parent=${parent ?? 'root'}`);
  xhr.setRequestHeader('X-Nuvem', '1');
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) li.querySelector('.prog').style.setProperty('--p', (e.loaded / e.total) * 100); };
  xhr.onloadend = () => {
    pending--;
    const ok = xhr.status >= 200 && xhr.status < 300;
    let msg = '';
    try { msg = JSON.parse(xhr.responseText).error; } catch {}
    li.querySelector('.prog').outerHTML = ok ? icon('check', 'done') : icon('error', 'fail');
    if (!ok) { li.title = msg || 'Falhou'; toast(msg || 'O envio falhou'); }
    updateUploadsTitle();
    if (xhr.status === 401) return showAuth();
    load(); refreshStorage();
  };
  xhr.send(fd);
}
function updateUploadsTitle() {
  $('#uploads-title').textContent = pending ? `A carregar (${pending})…` : 'Envios concluídos';
}
$('#uploads-close').onclick = () => { uploadsBox.hidden = true; $('#uploads-list').innerHTML = ''; };
$('#file-input').onchange = (e) => { uploadFiles([...e.target.files], uploadTarget()); e.target.value = ''; };
$('#folder-input').onchange = (e) => {
  const files = [...e.target.files];
  uploadFiles(files, uploadTarget(), files.map((f) => f.webkitRelativePath || f.name));
  e.target.value = '';
};

// Arrastar ficheiros (incluindo pastas) do computador
async function uploadEntries(dt, parent) {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return uploadFiles([...dt.files], parent);
  const files = [];
  const paths = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const f = await new Promise((res, rej) => entry.file(res, rej));
      files.push(f); paths.push(prefix + f.name);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, '');
  uploadFiles(files, parent, paths);
}
const main = $('#main');
let dragDepth = 0;
main.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('Files') || uploadTarget() === undefined || !['mydrive', 'folder'].includes(state.view)) return;
  dragDepth++; main.classList.add('dragging');
});
main.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; main.classList.remove('dragging'); } });
main.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
main.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0; main.classList.remove('dragging');
  if (!e.dataTransfer.types.includes('Files') || !['mydrive', 'folder'].includes(state.view)) return;
  uploadEntries(e.dataTransfer, uploadTarget());
});

// ---------- Pesquisa, vista e conta ----------
let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = e.target.value.trim(); load(); }, 250);
});
$('#search-form').onsubmit = (e) => { e.preventDefault(); clearTimeout(searchTimer); state.search = $('#search').value.trim(); load(); };
$('#layout-btn').onclick = () => {
  state.layout = state.layout === 'grid' ? 'list' : 'grid';
  try { localStorage.setItem('layout', state.layout); } catch {}
  render();
};
$('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
$('#scrim').onclick = () => $('#sidebar').classList.remove('open');

$('#avatar-btn').onclick = () => {
  const f = $('#account-form');
  f.reset();
  f.name.value = state.user.name;
  f.email.value = state.user.email;
  $('#account-error').textContent = '';
  $('#account-dlg').showModal();
};
$('#account-cancel').onclick = () => $('#account-dlg').close();
$('#account-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = { name: f.name.value };
  if (f.newPassword.value) { body.newPassword = f.newPassword.value; body.currentPassword = f.currentPassword.value; }
  try {
    const r = await api('/api/me', { method: 'PATCH', body });
    state.user = r.user;
    $('#avatar-btn').textContent = state.user.name[0].toUpperCase();
    $('#account-dlg').close();
    toast('Conta atualizada');
  } catch (err) { $('#account-error').textContent = err.message; }
};
$('#logout-btn').onclick = async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  $('#account-dlg').close();
  location.hash = '';
  showAuth();
};

// ---------- Integração com a app Android ----------
const inApp = !!window.NuvemApp;
// Chamado pelo botão "voltar" do Android. Devolve true se fechou alguma coisa.
window.nuvemBack = () => {
  if (!menu.hidden) { hideMenu(); return true; }
  if (!$('#preview').hidden) { closePreview(); return true; }
  const open = document.querySelector('dialog[open]');
  if (open) { open.close(); return true; }
  if ($('#sidebar').classList.contains('open')) { $('#sidebar').classList.remove('open'); return true; }
  return false;
};
if (inApp) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn text';
  b.textContent = 'Mudar servidor';
  b.onclick = () => { $('#account-dlg').close(); window.NuvemApp.changeServer(); };
  $('#account-links').append(b);
}

// ---------- Arranque ----------
hydrateIcons();
setAuthMode(false);
boot();
