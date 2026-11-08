// Traduções. O texto em português de Portugal no código é a referência; cada língua tem um
// dicionário em src/i18n/<língua>.json indexado por uma impressão digital curta dessa frase.
// Modelos com {0}, {1}… recebem valores; valores que também sejam frases conhecidas são traduzidos.
import br from './i18n/br.json';
import es from './i18n/es.json';
import fr from './i18n/fr.json';
import en from './i18n/en.json';

export const LANGS = [['pt', 'Português (PT)'], ['br', 'Português (BR)'], ['es', 'Español'], ['fr', 'Français'], ['en', 'English']];
const DICTS = { br, es, fr, en };
const HTML_LANG = { pt: 'pt-PT', br: 'pt-BR', es: 'es', fr: 'fr', en: 'en' };

// FNV-1a de 32 bits em base 36: a mesma função é usada por tools/i18n_extract.mjs
export function key(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const cache = new Map();
const hashOf = (s) => { let k = cache.get(s); if (k === undefined) { k = key(s); cache.set(s, k); } return k; };

function detect() {
  try { const s = localStorage.getItem('etl_lang'); if (s && (s === 'pt' || DICTS[s])) return s; } catch (e) { /* sem armazenamento */ }
  const n = (navigator.language || 'pt').toLowerCase();
  if (n.startsWith('pt-br')) return 'br';
  if (n.startsWith('pt')) return 'pt';
  for (const l of ['es', 'fr', 'en']) if (n.startsWith(l)) return l;
  return 'en';
}
let lang = detect();
const listeners = [];

export function getLang() { return lang; }
export function setLang(l) {
  lang = l;
  try { localStorage.setItem('etl_lang', l); } catch (e) { /* sem armazenamento */ }
  document.documentElement.lang = HTML_LANG[l];
  listeners.forEach((f) => f(l));
}
export function onLang(f) { listeners.push(f); }

function look(s) {
  const d = DICTS[lang];
  if (!d || typeof s !== 'string') return s;
  const r = d[hashOf(s)];
  return r === undefined ? s : r;
}
export function _t(s, ...args) {
  let r = look(s);
  if (args.length) r = r.replace(/\{(\d+)\}/g, (m, i) => { const v = args[i]; return typeof v === 'string' ? look(v) : String(v); });
  return r;
}
document.documentElement.lang = HTML_LANG[lang];
