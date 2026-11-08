// Impressão digital de uma frase (FNV-1a 32 bits, base 36). Tem de ser igual à de src/i18n.js.
export function key(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
