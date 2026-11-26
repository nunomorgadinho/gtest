'use strict';
// Nuvem: um clone simples do Google Drive com contas, pastas, partilha e lixo.
const express = require('express');
const multer = require('multer');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const FILES_DIR = path.join(DATA_DIR, 'files');
const QUOTA = Number(process.env.QUOTA_BYTES) || 15 * 1024 ** 3; // 15 GB por conta
const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES) || 2 * 1024 ** 3;
const SESSION_DAYS = 30;

fs.mkdirSync(FILES_DIR, { recursive: true });

// ---------- Base de dados ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'drive.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('folder','file')),
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  trashed_at INTEGER,
  public_token TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE TABLE IF NOT EXISTS shares (
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer','editor')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (item_id, user_id)
);
`);

const q = (sql) => db.prepare(sql);
const now = () => Date.now();

// ---------- Utilitários ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function safeEqualHex(a, b) {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
function cleanName(name) {
  const n = String(name ?? '').replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 255);
  if (!n || n === '.' || n === '..') return null;
  return n;
}
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const getItem = (id) => q('SELECT * FROM items WHERE id = ?').get(Number(id));
const publicUser = (u) => u && { id: u.id, name: u.name, email: u.email };

// Lista de antepassados (incluindo o próprio item), do item até à raiz.
function ancestry(item) {
  const chain = [];
  let cur = item;
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parent_id ? getItem(cur.parent_id) : null;
  }
  return chain;
}
const isTrashed = (item) => ancestry(item).some((i) => i.trashed_at);

// Papel do utilizador sobre o item: 'owner' | 'editor' | 'viewer' | null.
// A partilha de uma pasta aplica-se a tudo o que está dentro dela.
const shareStmt = q('SELECT role FROM shares WHERE item_id = ? AND user_id = ?');
function roleFor(userId, item) {
  if (!item) return null;
  if (item.owner_id === userId) return 'owner';
  let best = null;
  for (const a of ancestry(item)) {
    const s = shareStmt.get(a.id, userId);
    if (s?.role === 'editor') return 'editor';
    if (s) best = 'viewer';
  }
  return best;
}
const RANK = { viewer: 1, editor: 2, owner: 3 };
function requireRole(user, id, min) {
  const item = getItem(id);
  const role = roleFor(user.id, item);
  if (!item || !role) throw httpError(404, 'Item não encontrado');
  if (RANK[role] < RANK[min]) throw httpError(403, 'Não tens permissão para isto');
  return { item, role };
}

function descendants(rootId) {
  const out = [];
  const stack = [rootId];
  const kids = q('SELECT * FROM items WHERE parent_id = ?');
  while (stack.length) {
    for (const c of kids.all(stack.pop())) {
      out.push(c);
      if (c.type === 'folder') stack.push(c.id);
    }
  }
  return out;
}

function usage(userId) {
  return q("SELECT COALESCE(SUM(size),0) AS used FROM items WHERE owner_id = ? AND type = 'file'").get(userId).used;
}

const ownerName = q('SELECT name, email FROM users WHERE id = ?');
const shareCount = q('SELECT COUNT(*) AS n FROM shares WHERE item_id = ?');
function serialize(item, userId, role) {
  const owner = ownerName.get(item.owner_id);
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    mime: item.mime,
    size: item.size,
    parentId: item.parent_id,
    starred: !!item.starred && item.owner_id === userId,
    trashedAt: item.trashed_at,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    owner: item.owner_id === userId ? 'eu' : owner?.name,
    ownerEmail: owner?.email,
    role: role ?? roleFor(userId, item),
    shared: shareCount.get(item.id).n > 0 || !!item.public_token,
    publicToken: item.owner_id === userId ? item.public_token : undefined,
  };
}

function uniqueName(ownerId, parentId, name, excludeId = 0) {
  const exists = q(
    'SELECT 1 FROM items WHERE owner_id = ? AND parent_id IS ? AND name = ? AND id != ? AND trashed_at IS NULL'
  );
  if (!exists.get(ownerId, parentId, name, excludeId)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!exists.get(ownerId, parentId, candidate, excludeId)) return candidate;
  }
}

function removeFromDisk(items) {
  for (const it of items) {
    if (it.storage_key) fs.rm(path.join(FILES_DIR, it.storage_key), { force: true }, () => {});
  }
}

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Sessão
app.use((req, res, next) => {
  const token = parseCookies(req.headers.cookie).sid;
  if (token) {
    const row = q(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?'
    ).get(token, now());
    if (row) {
      req.user = row;
      req.sessionToken = token;
    }
  }
  next();
});

// Proteção CSRF: todos os pedidos que alteram dados vêm do nosso frontend com este cabeçalho.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('X-Nuvem') !== '1') return res.status(403).json({ error: 'Pedido inválido' });
  next();
});

const auth = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Sessão expirada' }));
const wrap = (fn) => (req, res, next) => {
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === 'function') r.catch(next);
  } catch (e) {
    next(e);
  }
};

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  q('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    now() + SESSION_DAYS * 864e5
  );
  res.setHeader(
    'Set-Cookie',
    `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
}

// ---- Contas ----
app.post('/api/register', wrap((req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name) throw httpError(400, 'Indica o teu nome');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Email inválido');
  if (password.length < 8) throw httpError(400, 'A palavra-passe precisa de pelo menos 8 caracteres');
  if (q('SELECT 1 FROM users WHERE email = ?').get(email)) throw httpError(409, 'Já existe uma conta com este email');
  const salt = crypto.randomBytes(16).toString('hex');
  const { lastInsertRowid } = q(
    'INSERT INTO users (name, email, pass_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hashPassword(password, salt), salt, now());
  startSession(res, Number(lastInsertRowid));
  res.status(201).json({ user: publicUser(q('SELECT * FROM users WHERE id = ?').get(lastInsertRowid)) });
}));

app.post('/api/login', wrap((req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const u = q('SELECT * FROM users WHERE email = ?').get(email);
  const ok = u && safeEqualHex(hashPassword(String(req.body.password || ''), u.salt), u.pass_hash);
  if (!ok) throw httpError(401, 'Email ou palavra-passe incorretos');
  startSession(res, u.id);
  res.json({ user: publicUser(u) });
}));

app.post('/api/logout', (req, res) => {
  if (req.sessionToken) q('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user), usage: usage(req.user.id), quota: QUOTA });
});

app.patch('/api/me', auth, wrap((req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  if (name !== undefined) {
    const n = String(name).trim().slice(0, 80);
    if (!n) throw httpError(400, 'Nome inválido');
    q('UPDATE users SET name = ? WHERE id = ?').run(n, req.user.id);
  }
  if (newPassword !== undefined) {
    if (!safeEqualHex(hashPassword(String(currentPassword || ''), req.user.salt), req.user.pass_hash))
      throw httpError(401, 'Palavra-passe atual incorreta');
    if (String(newPassword).length < 8) throw httpError(400, 'A nova palavra-passe precisa de 8 caracteres');
    const salt = crypto.randomBytes(16).toString('hex');
    q('UPDATE users SET pass_hash = ?, salt = ? WHERE id = ?').run(hashPassword(String(newPassword), salt), salt, req.user.id);
    q('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(req.user.id, req.sessionToken);
  }
  res.json({ user: publicUser(q('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

// ---- Listagens ----
app.get('/api/items', auth, wrap((req, res) => {
  const uid = req.user.id;
  const view = req.query.view || 'mydrive';
  const search = String(req.query.q || '').trim();
  let rows;
  let folder = null;

  if (search) {
    const like = `%${search.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
    const own = q("SELECT * FROM items WHERE owner_id = ? AND name LIKE ? ESCAPE '\\' LIMIT 500").all(uid, like);
    const shared = q(
      `SELECT i.* FROM items i JOIN shares s ON s.item_id = i.id WHERE s.user_id = ? AND i.name LIKE ? ESCAPE '\\'`
    ).all(uid, like);
    rows = [...own, ...shared].filter((i) => !isTrashed(i));
  } else if (view === 'mydrive') {
    const parent = req.query.parent && req.query.parent !== 'root' ? Number(req.query.parent) : null;
    if (parent) {
      const { item } = requireRole(req.user, parent, 'viewer');
      if (item.type !== 'folder') throw httpError(400, 'Não é uma pasta');
      if (isTrashed(item)) throw httpError(404, 'Esta pasta está na reciclagem');
      folder = item;
    }
    rows = parent
      ? q('SELECT * FROM items WHERE parent_id = ? AND trashed_at IS NULL').all(parent)
      : q('SELECT * FROM items WHERE owner_id = ? AND parent_id IS NULL AND trashed_at IS NULL').all(uid);
  } else if (view === 'shared') {
    rows = q(
      'SELECT i.* FROM items i JOIN shares s ON s.item_id = i.id WHERE s.user_id = ? ORDER BY s.created_at DESC'
    ).all(uid).filter((i) => !isTrashed(i));
  } else if (view === 'recent') {
    rows = q("SELECT * FROM items WHERE owner_id = ? AND type = 'file' ORDER BY updated_at DESC LIMIT 100")
      .all(uid)
      .filter((i) => !isTrashed(i))
      .slice(0, 50);
  } else if (view === 'starred') {
    rows = q('SELECT * FROM items WHERE owner_id = ? AND starred = 1').all(uid).filter((i) => !isTrashed(i));
  } else if (view === 'trash') {
    rows = q('SELECT * FROM items WHERE owner_id = ? AND trashed_at IS NOT NULL ORDER BY trashed_at DESC').all(uid);
  } else {
    throw httpError(400, 'Vista desconhecida');
  }

  const items = rows.map((i) => serialize(i, uid));
  if (view !== 'recent') {
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'pt', { numeric: true }) : a.type === 'folder' ? -1 : 1));
  }
  res.json({
    items,
    folder: folder && serialize(folder, uid),
    path: folder ? breadcrumbs(req.user.id, folder) : [],
  });
}));

// Caminho visível para o utilizador (para utilizadores com partilha, começa na pasta partilhada).
function breadcrumbs(userId, item) {
  const chain = ancestry(item).reverse();
  const out = [];
  for (const a of chain) {
    if (!roleFor(userId, a)) continue;
    out.push({ id: a.id, name: a.name });
  }
  const top = chain.find((a) => roleFor(userId, a));
  return { root: top && top.owner_id === userId ? 'mydrive' : 'shared', items: out };
}

app.get('/api/folders', auth, wrap((req, res) => {
  // Para o diálogo "Mover": pastas filhas de uma pasta onde o utilizador pode editar.
  const parent = req.query.parent && req.query.parent !== 'root' ? Number(req.query.parent) : null;
  let rows;
  if (parent) {
    requireRole(req.user, parent, 'viewer');
    rows = q("SELECT * FROM items WHERE parent_id = ? AND type = 'folder' AND trashed_at IS NULL ORDER BY name").all(parent);
  } else {
    rows = q("SELECT * FROM items WHERE owner_id = ? AND parent_id IS NULL AND type = 'folder' AND trashed_at IS NULL ORDER BY name").all(req.user.id);
  }
  res.json({
    folders: rows.map((r) => ({ id: r.id, name: r.name, canEdit: RANK[roleFor(req.user.id, r)] >= 2 })),
    path: parent ? breadcrumbs(req.user.id, getItem(parent)).items : [],
  });
}));

// ---- Criar ----
function resolveTargetFolder(user, parentRaw) {
  const parentId = parentRaw && parentRaw !== 'root' ? Number(parentRaw) : null;
  if (!parentId) return { parentId: null, ownerId: user.id };
  const { item } = requireRole(user, parentId, 'editor');
  if (item.type !== 'folder') throw httpError(400, 'O destino não é uma pasta');
  if (isTrashed(item)) throw httpError(400, 'A pasta de destino está na reciclagem');
  // O conteúdo de uma pasta pertence ao dono da pasta (e conta para a quota dele).
  return { parentId, ownerId: item.owner_id };
}

function touch(parentId) {
  if (parentId) q('UPDATE items SET updated_at = ? WHERE id = ?').run(now(), parentId);
}

app.post('/api/folders', auth, wrap((req, res) => {
  const name = cleanName(req.body.name);
  if (!name) throw httpError(400, 'Nome inválido');
  const { parentId, ownerId } = resolveTargetFolder(req.user, req.body.parent);
  const t = now();
  const { lastInsertRowid } = q(
    "INSERT INTO items (owner_id, parent_id, name, type, created_at, updated_at) VALUES (?, ?, ?, 'folder', ?, ?)"
  ).run(ownerId, parentId, uniqueName(ownerId, parentId, name), t, t);
  touch(parentId);
  res.status(201).json({ item: serialize(getItem(lastInsertRowid), req.user.id) });
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: FILES_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_UPLOAD, files: 100 },
});

app.post('/api/upload', auth, upload.array('files'), wrap((req, res) => {
  const files = req.files || [];
  try {
    if (!files.length) throw httpError(400, 'Nenhum ficheiro recebido');
    const { parentId: baseParent, ownerId } = resolveTargetFolder(req.user, req.query.parent);
    const total = files.reduce((s, f) => s + f.size, 0);
    if (usage(ownerId) + total > QUOTA) throw httpError(413, 'Espaço de armazenamento esgotado');

    // Os caminhos relativos (upload de pastas) chegam em "paths", pela mesma ordem dos ficheiros.
    let rel = req.body.paths;
    if (!Array.isArray(rel)) rel = rel ? [rel] : [];
    const folderCache = new Map();
    const ensureFolder = (parentId, name) => {
      const key = `${parentId}/${name}`;
      if (folderCache.has(key)) return folderCache.get(key);
      let f = q("SELECT * FROM items WHERE owner_id = ? AND parent_id IS ? AND name = ? AND type = 'folder' AND trashed_at IS NULL").get(ownerId, parentId, name);
      if (!f) {
        const t = now();
        const r = q("INSERT INTO items (owner_id, parent_id, name, type, created_at, updated_at) VALUES (?, ?, ?, 'folder', ?, ?)").run(ownerId, parentId, name, t, t);
        f = getItem(r.lastInsertRowid);
      }
      folderCache.set(key, f.id);
      return f.id;
    };

    const created = [];
    db.exec('BEGIN');
    try {
      files.forEach((f, idx) => {
        // multer entrega o nome em latin1; converter para UTF-8.
        const original = Buffer.from(f.originalname, 'latin1').toString('utf8');
        const parts = String(rel[idx] || original).split('/').map(cleanName).filter(Boolean);
        const fileName = parts.pop() || cleanName(original) || 'sem nome';
        let parentId = baseParent;
        for (const p of parts) parentId = ensureFolder(parentId, p);
        const t = now();
        const r = q(
          "INSERT INTO items (owner_id, parent_id, name, type, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?)"
        ).run(ownerId, parentId, uniqueName(ownerId, parentId, fileName), f.mimetype || 'application/octet-stream', f.size, f.filename, t, t);
        created.push(getItem(r.lastInsertRowid));
      });
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    touch(baseParent);
    res.status(201).json({ items: created.map((i) => serialize(i, req.user.id)) });
  } catch (e) {
    for (const f of files) fs.rm(f.path, { force: true }, () => {});
    throw e;
  }
}));

// ---- Ler ficheiros ----
// Tipos que o browser pode mostrar com segurança dentro da página.
const INLINE_SAFE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/|audio\/|application\/pdf$|text\/plain$)/;

function sendFile(res, item, inline) {
  const file = path.join(FILES_DIR, item.storage_key);
  if (!fs.existsSync(file)) return res.status(404).send('Ficheiro em falta');
  let mime = item.mime || 'application/octet-stream';
  const isText = /^text\/|json|xml|javascript/.test(mime);
  if (inline && isText) mime = 'text/plain; charset=utf-8';
  const showInline = inline && (INLINE_SAFE.test(mime) || isText);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader(
    'Content-Disposition',
    `${showInline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(item.name)}`
  );
  res.sendFile(file, { acceptRanges: true, headers: { 'Cache-Control': 'private, max-age=0' } });
}

app.get('/api/items/:id/content', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'viewer');
  if (item.type !== 'file') throw httpError(400, 'As pastas não têm conteúdo');
  sendFile(res, item, req.query.inline === '1');
}));

app.get('/api/items/:id', auth, wrap((req, res) => {
  const { item, role } = requireRole(req.user, req.params.id, 'viewer');
  res.json({ item: serialize(item, req.user.id, role) });
}));

// ---- Alterar ----
app.patch('/api/items/:id', auth, wrap((req, res) => {
  const uid = req.user.id;
  const { item, role } = requireRole(req.user, req.params.id, 'viewer');
  const { name, parent, starred } = req.body;

  if (starred !== undefined) {
    if (role !== 'owner') throw httpError(403, 'Só o dono pode marcar favoritos');
    q('UPDATE items SET starred = ? WHERE id = ?').run(starred ? 1 : 0, item.id);
  }
  if (name !== undefined) {
    if (RANK[role] < 2) throw httpError(403, 'Precisas de permissão de edição');
    const n = cleanName(name);
    if (!n) throw httpError(400, 'Nome inválido');
    q('UPDATE items SET name = ?, updated_at = ? WHERE id = ?').run(uniqueName(item.owner_id, item.parent_id, n, item.id), now(), item.id);
  }
  if (parent !== undefined) {
    if (role !== 'owner') throw httpError(403, 'Só o dono pode mover este item');
    const target = resolveTargetFolder(req.user, parent);
    if (target.ownerId !== item.owner_id) throw httpError(400, 'Só podes mover para pastas do mesmo dono');
    if (target.parentId) {
      const chain = ancestry(getItem(target.parentId));
      if (chain.some((a) => a.id === item.id)) throw httpError(400, 'Não podes mover uma pasta para dentro de si própria');
    }
    const fresh = getItem(item.id);
    q('UPDATE items SET parent_id = ?, name = ?, updated_at = ? WHERE id = ?').run(
      target.parentId,
      uniqueName(item.owner_id, target.parentId, fresh.name, item.id),
      now(),
      item.id
    );
  }
  res.json({ item: serialize(getItem(item.id), uid) });
}));

app.post('/api/items/:id/copy', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'viewer');
  if (item.type !== 'file') throw httpError(400, 'Só é possível copiar ficheiros');
  // A cópia fica na mesma pasta se o utilizador puder editar lá; senão vai para a raiz do Meu Drive.
  let parentId = null;
  let ownerId = req.user.id;
  if (item.parent_id && RANK[roleFor(req.user.id, getItem(item.parent_id))] >= 2) {
    parentId = item.parent_id;
    ownerId = getItem(item.parent_id).owner_id;
  }
  if (usage(ownerId) + item.size > QUOTA) throw httpError(413, 'Espaço de armazenamento esgotado');
  const key = crypto.randomUUID();
  fs.copyFileSync(path.join(FILES_DIR, item.storage_key), path.join(FILES_DIR, key));
  const t = now();
  const r = q(
    "INSERT INTO items (owner_id, parent_id, name, type, mime, size, storage_key, created_at, updated_at) VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?)"
  ).run(ownerId, parentId, uniqueName(ownerId, parentId, `Cópia de ${item.name}`), item.mime, item.size, key, t, t);
  res.status(201).json({ item: serialize(getItem(r.lastInsertRowid), req.user.id) });
}));

// ---- Lixo ----
app.delete('/api/items/:id', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'owner');
  q('UPDATE items SET trashed_at = ? WHERE id = ?').run(now(), item.id);
  res.json({ ok: true });
}));

app.post('/api/items/:id/restore', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'owner');
  // Se a pasta original também estiver no lixo (ou desapareceu), restaura para a raiz.
  const parent = item.parent_id ? getItem(item.parent_id) : null;
  const parentId = parent && !isTrashed(parent) ? parent.id : null;
  q('UPDATE items SET trashed_at = NULL, parent_id = ?, name = ? WHERE id = ?').run(
    parentId,
    uniqueName(item.owner_id, parentId, item.name, item.id),
    item.id
  );
  res.json({ item: serialize(getItem(item.id), req.user.id) });
}));

function destroy(item) {
  const all = [item, ...descendants(item.id)];
  q('DELETE FROM items WHERE id = ?').run(item.id); // ON DELETE CASCADE trata dos filhos
  removeFromDisk(all);
}

app.delete('/api/items/:id/permanent', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'owner');
  if (!item.trashed_at) throw httpError(400, 'Apaga primeiro (vai para a reciclagem)');
  destroy(item);
  res.json({ ok: true });
}));

app.delete('/api/trash', auth, wrap((req, res) => {
  const rows = q('SELECT * FROM items WHERE owner_id = ? AND trashed_at IS NOT NULL').all(req.user.id);
  db.exec('BEGIN');
  try {
    for (const r of rows) if (getItem(r.id)) destroy(r);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  res.json({ ok: true, removed: rows.length });
}));

// ---- Partilha ----
app.get('/api/items/:id/shares', auth, wrap((req, res) => {
  const { item, role } = requireRole(req.user, req.params.id, 'viewer');
  const people = q(
    'SELECT u.id, u.name, u.email, s.role FROM shares s JOIN users u ON u.id = s.user_id WHERE s.item_id = ? ORDER BY u.name'
  ).all(item.id);
  res.json({
    owner: publicUser(q('SELECT * FROM users WHERE id = ?').get(item.owner_id)),
    people,
    canManage: role === 'owner',
    publicToken: role === 'owner' ? item.public_token : undefined,
  });
}));

app.post('/api/items/:id/shares', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'owner');
  const email = String(req.body.email || '').trim().toLowerCase();
  const role = req.body.role === 'editor' ? 'editor' : 'viewer';
  const target = q('SELECT * FROM users WHERE email = ?').get(email);
  if (!target) throw httpError(404, 'Não existe nenhuma conta com esse email');
  if (target.id === item.owner_id) throw httpError(400, 'Já és o dono deste item');
  q(
    'INSERT INTO shares (item_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(item_id, user_id) DO UPDATE SET role = excluded.role'
  ).run(item.id, target.id, role, now());
  res.status(201).json({ ok: true });
}));

app.delete('/api/items/:id/shares/:userId', auth, wrap((req, res) => {
  const item = getItem(req.params.id);
  const role = roleFor(req.user.id, item);
  const targetId = Number(req.params.userId);
  // O dono remove qualquer pessoa; cada pessoa pode remover-se a si própria.
  if (!role || (role !== 'owner' && targetId !== req.user.id)) throw httpError(403, 'Sem permissão');
  q('DELETE FROM shares WHERE item_id = ? AND user_id = ?').run(item.id, targetId);
  res.json({ ok: true });
}));

app.post('/api/items/:id/public', auth, wrap((req, res) => {
  const { item } = requireRole(req.user, req.params.id, 'owner');
  const token = req.body.enabled ? item.public_token || crypto.randomBytes(18).toString('base64url') : null;
  q('UPDATE items SET public_token = ? WHERE id = ?').run(token, item.id);
  res.json({ publicToken: token });
}));

// ---- Links públicos ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtSize = (n) => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
};

app.get(['/s/:token', '/s/:token/:childId'], wrap((req, res) => {
  const root = q('SELECT * FROM items WHERE public_token = ?').get(req.params.token);
  if (!root || isTrashed(root)) return res.status(404).send('Link inválido ou desativado');
  let item = root;
  if (req.params.childId) {
    item = getItem(req.params.childId);
    if (!item || !ancestry(item).some((a) => a.id === root.id) || isTrashed(item)) return res.status(404).send('Não encontrado');
  }
  if (item.type === 'file') return sendFile(res, item, req.query.download !== '1');
  const kids = q('SELECT * FROM items WHERE parent_id = ? AND trashed_at IS NULL ORDER BY type DESC, name').all(item.id);
  const base = `/s/${encodeURIComponent(root.public_token)}`;
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
  res.send(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(item.name)} · Nuvem</title>
<style>body{font:15px system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#17161c;background:#f4f1ea}
h1{font-size:26px;font-weight:800;letter-spacing:-.02em}a{color:#17161c;font-weight:600}
li{list-style:none;padding:12px 16px;margin:0 0 8px;background:#fffdf8;border:2px solid rgba(23,22,28,.12);border-radius:14px;display:flex;gap:12px;justify-content:space-between}ul{padding:0}
small{color:#6d6a74}.tag{display:inline-block;background:#e8502c;color:#fff;border-radius:8px;padding:2px 8px;font-size:12px;font-weight:700}
@media(prefers-color-scheme:dark){body{background:#111014;color:#f1eee6}a{color:#f1eee6}li{background:#1a191f;border-color:rgba(241,238,230,.12)}}</style></head>
<body><span class="tag">Nuvem</span> <small>partilha pública</small><h1>${esc(item.name)}</h1>
${item.id !== root.id ? `<p><a href="${item.parent_id === root.id ? base : `${base}/${item.parent_id}`}">← Voltar</a></p>` : ''}
<ul>${kids.map((k) => `<li><span><a href="${base}/${k.id}">${esc(k.name)}</a></span>
${k.type === 'file' ? `<span><small>${fmtSize(k.size)}</small> · <a href="${base}/${k.id}?download=1">Transferir</a></span>` : ''}</li>`).join('') || '<li><small>Pasta vazia</small></li>'}</ul></body></html>`);
}));

// ---- Frontend ----
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    err.status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    err.message = err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande' : 'Erro no envio';
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Erro interno do servidor' : err.message });
});

// Limpeza periódica de sessões expiradas.
setInterval(() => q('DELETE FROM sessions WHERE expires_at < ?').run(now()), 3600e3).unref();

if (require.main === module) {
  app.listen(PORT, () => console.log(`Nuvem a correr em http://localhost:${PORT}`));
}
module.exports = app;
