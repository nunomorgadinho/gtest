// Ferramenta de uso único: envolve em _t(...) o texto visível dentro de funções.
// Concatenações ('Frasco ' + cor + '.') passam a modelos: _t('Frasco {0}.', cor).
// Uso: node tools/i18n_wrap.mjs src/ficheiro.js   (reescreve o ficheiro)
import fs from 'fs';
import * as acorn from 'acorn';

const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' });

const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const NO_ARG_CALLS = new Set(['getElementById', 'querySelector', 'querySelectorAll', 'add', 'remove', 'toggle', 'contains',
  'addEventListener', 'removeEventListener', 'setAttribute', 'getAttribute', 'createElement', 'getContext', 'load', 'save', 'getItem', 'setItem', 'Event']);
const NO_ASSIGN = new Set(['font', 'type', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin', 'fillStyle', 'strokeStyle', 'shadowColor',
  'globalCompositeOperation', 'className', 'cssText', 'transform', 'background', 'display', 'width', 'opacity', 'value']);

function isText(s) {
  if (typeof s !== 'string' || s.length < 2) return false;
  if (/\d+px|^(bold|italic|normal)\b|^rgba?\(|^hsla?\(|^#[0-9a-f]{3,8}$|^(source|destination)-|^[.#][\w-]/i.test(s)) return false;
  if (/^<\/?[a-z]+[ >]/.test(s) && /(class|style)=/.test(s)) return false;
  if (/(class|style)="/.test(s)) return false;
  if (/^[#. A-Z]+$/.test(s) && s.includes('#')) return false;
  return (/\s/.test(s) && /[A-Za-zÀ-ÿ]{2}/.test(s)) || /[À-ÿ]/.test(s) || /^[A-ZÀ-Ý][A-ZÀ-Ý ]{2,}$/.test(s);
}
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
const isStr = (n) => n && n.type === 'Literal' && typeof n.value === 'string';

function children(node) {
  const out = [];
  for (const k of Object.keys(node)) {
    if (k === 'type' || k === 'start' || k === 'end') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === 'string') out.push([k, c]); });
    else if (v && typeof v.type === 'string') out.push([k, v]);
  }
  out.sort((a, b) => a[1].start - b[1].start);
  // atalhos como { cor } ou import { snd }: chave e valor são o mesmo pedaço de código
  return out.filter((c, i) => !(i > 0 && c[1].start === out[i - 1][1].start && c[1].end === out[i - 1][1].end));
}
function excluded(ctx) {
  const p = ctx.parent;
  if (!ctx.inFn || !p) return true;
  if (p.type === 'Property' && ctx.key === 'key') return true;
  if (p.type === 'ImportDeclaration' || p.type === 'ExportNamedDeclaration') return true;
  if (p.type === 'BinaryExpression' && /^[=!]==?$/.test(p.operator)) return true;
  if (p.type === 'SwitchCase') return true;
  if ((p.type === 'CallExpression' || p.type === 'NewExpression') && ctx.key === 'arguments') {
    const c = p.callee;
    if (c.type === 'Identifier' && (c.name === '$' || NO_ARG_CALLS.has(c.name) || c.name === '_t')) return true;
    if (c.type === 'MemberExpression' && c.property && NO_ARG_CALLS.has(c.property.name)) return true;
  }
  if (p.type === 'AssignmentExpression' && ctx.key === 'right' && p.left.type === 'MemberExpression' && NO_ASSIGN.has(p.left.property.name)) return true;
  if (p.type === 'MemberExpression' && ctx.key === 'property') return true;
  return false;
}
function spine(node) { // partes de uma cadeia a + b + c (só pelo lado esquerdo)
  const parts = [], nodes = [];
  let n = node;
  while (n.type === 'BinaryExpression' && n.operator === '+') { parts.unshift(n.right); nodes.unshift(n); n = n.left; }
  parts.unshift(n); nodes.unshift(null);
  return { parts, nodes };
}
let wraps = 0;
function rebuild(node, ctx) {
  if (node.type === 'BinaryExpression' && node.operator === '+' && !excluded(ctx)) {
    const { parts, nodes } = spine(node);
    const k = parts.findIndex(isStr);
    if (k >= 0 && parts.some((p) => isStr(p) && isText(p.value))) {
      const items = [];
      if (k >= 2) items.push({ expr: nodes[k - 1] });
      else if (k === 1) items.push({ expr: parts[0] });
      for (let i = k; i < parts.length; i++) items.push(isStr(parts[i]) ? { lit: parts[i].value } : { expr: parts[i] });
      let tmpl = '', args = [];
      for (const it of items) {
        if (it.lit !== undefined) tmpl += it.lit;
        else { tmpl += '{' + args.length + '}'; args.push(rebuild(it.expr, { inFn: ctx.inFn, parent: node, key: 'chain' })); }
      }
      wraps++;
      return '_t(' + [q(tmpl)].concat(args).join(', ') + ')';
    }
  }
  if (isStr(node) && isText(node.value) && !excluded(ctx)) { wraps++; return '_t(' + src.slice(node.start, node.end) + ')'; }
  const inFn = ctx.inFn || FN.has(node.type);
  let out = '', pos = node.start;
  for (const [key, c] of children(node)) {
    out += src.slice(pos, c.start) + rebuild(c, { inFn, parent: node, key });
    pos = c.end;
  }
  return out + src.slice(pos, node.end);
}
const result = src.slice(0, ast.start) + rebuild(ast, { inFn: false, parent: null, key: null }) + src.slice(ast.end);
fs.writeFileSync(file, result);
console.log(file + ': ' + wraps + ' textos marcados');
