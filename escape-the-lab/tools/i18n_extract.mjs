// Recolhe todas as frases traduzíveis e verifica as traduções.
// Uso: node tools/i18n_extract.mjs          -> escreve src/i18n/keys.json e mostra o que falta em cada língua
//      node tools/i18n_extract.mjs --list   -> imprime também as frases em falta (impressão digital + texto)
import fs from 'fs';
import * as acorn from 'acorn';
import { key } from './i18n_key.mjs';

const root = new URL('..', import.meta.url).pathname;
const FILES = ['src/main.js', 'src/sectors.js', 'src/sectors2.js'];
// palavras soltas que o código usa como valores (cores dos frascos e do misturador, nomes curtos dos itens)
const EXTRA = ['vermelho', 'azul', 'verde', 'amarelo', 'branco', 'preto', 'Verde', 'Azul', 'Verm.', 'Chave', 'Contraste'];

function isText(s) {
  if (typeof s !== 'string' || s.length < 2) return false;
  if (/\d+px|^(bold|italic|normal)\b|^rgba?\(|^hsla?\(|^#[0-9a-f]{3,8}$|^(source|destination)-|^[.#][\w-]/i.test(s)) return false;
  if (/(class|style)="/.test(s)) return false;
  if (/^[#. A-Z]+$/.test(s) && s.includes('#')) return false;
  if (/^(varying|uniform|precision)\b/.test(s)) return false;
  return (/\s/.test(s) && /[A-Za-zÀ-ÿ]{2}/.test(s)) || /[À-ÿ]/.test(s) || /^[A-ZÀ-Ý][A-ZÀ-Ý ]{2,}$/.test(s);
}
const keys = new Map();
const add = (s) => { if (!keys.has(key(s))) keys.set(key(s), s); };

for (const f of FILES) {
  const src = fs.readFileSync(root + f, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' });
  (function walk(node, inFn) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === '_t') {
      const a = node.arguments[0];
      if (a && a.type === 'Literal' && typeof a.value === 'string') add(a.value);
    }
    if (!inFn && node.type === 'Literal' && isText(node.value)) add(node.value);
    const fn = inFn || /Function/.test(node.type);
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, fn)); else if (v && typeof v.type === 'string') walk(v, fn);
    }
  })(ast, false);
}
EXTRA.forEach(add);
// textos fixos da página
const html = fs.readFileSync(root + 'web/index.html', 'utf8');
for (const m of html.matchAll(/<(\w+)([^>]*?)\sdata-i18n(-html)?(\s[^>]*)?>([\s\S]*?)<\/\1>/g)) {
  const inner = m[5].replace(/\s+/g, ' ').trim();
  add(m[3] ? inner : inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'));
}
const obj = Object.fromEntries(keys);
fs.writeFileSync(root + 'src/i18n/keys.json', JSON.stringify(obj, null, 1) + '\n');
console.log(keys.size + ' frases');

const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
const tags = (s) => (s.match(/<\/?[a-z]+>/g) || []).sort().join(',');
let bad = 0;
for (const l of ['br', 'es', 'fr', 'en']) {
  const d = JSON.parse(fs.readFileSync(root + 'src/i18n/' + l + '.json', 'utf8'));
  const missing = [...keys.keys()].filter((k) => d[k] === undefined);
  const wrong = [...keys.keys()].filter((k) => d[k] !== undefined && (ph(d[k]) !== ph(obj[k]) || tags(d[k]) !== tags(obj[k])));
  const stale = Object.keys(d).filter((k) => !keys.has(k));
  console.log(l + ': faltam ' + missing.length + ', modelos errados ' + wrong.length + ', a mais ' + stale.length);
  wrong.forEach((k) => console.log('   modelo diferente', k, JSON.stringify(obj[k]).slice(0, 80)));
  if (process.argv.includes('--list')) missing.forEach((k) => console.log('   ' + k + '\t' + JSON.stringify(obj[k])));
  bad += missing.length + wrong.length;
}
process.exitCode = bad ? 1 : 0;
