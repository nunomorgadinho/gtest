/* Constrói um APK Android a partir do "leitor" de jogos (APK modelo) sem servidor:
   troca o nome do pacote, o nome da app, o ícone e o ficheiro do jogo, e assina com o esquema v2 do Android.
   Tudo em JavaScript puro (SHA-256, RSA com BigInt, ZIP e CRC32). */
(function (root) {
  'use strict';
  const PKG_PLACEHOLDER = 'com.magodosjogos.jogo.zzzzzzzzzzzzzzzz';
  const PKG_PREFIX = 'com.magodosjogos.jogo.';
  const LABEL_PLACEHOLDER = 'ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'; // 30 caracteres
  const enc = new TextEncoder();

  // ---------- utilidades binárias ----------
  function b64ToBytes(b64) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function bytesToB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function concat(parts) { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; }
  function u16(v) { return new Uint8Array([v & 255, (v >>> 8) & 255]); }
  function u32(v) { return new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]); }
  function u64(v) { return concat([u32(v >>> 0), u32(Math.floor(v / 4294967296))]); }
  function lp(b) { return concat([u32(b.length), b]); } // prefixado pelo comprimento (uint32)
  function find(hay, needle, from) {
    outer: for (let i = from || 0; i <= hay.length - needle.length; i++) { for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer; return i; }
    return -1;
  }
  function utf16(s) { const o = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { o[2 * i] = s.charCodeAt(i) & 255; o[2 * i + 1] = s.charCodeAt(i) >> 8; } return o; }

  // ---------- CRC32 ----------
  const CRC = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  // ---------- SHA-256 ----------
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(data) {
    const len = data.length, padLen = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(padLen);
    m.set(data); m[len] = 0x80;
    const bits = len * 8; for (let i = 0; i < 8; i++) m[padLen - 1 - i] = Math.floor(bits / Math.pow(2, 8 * i)) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    for (let off = 0; off < padLen; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = (m[off + 4 * i] << 24) | (m[off + 4 * i + 1] << 16) | (m[off + 4 * i + 2] << 8) | m[off + 4 * i + 3];
      for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32); for (let i = 0; i < 8; i++) { out[4 * i] = H[i] >>> 24; out[4 * i + 1] = (H[i] >>> 16) & 255; out[4 * i + 2] = (H[i] >>> 8) & 255; out[4 * i + 3] = H[i] & 255; }
    return out;
  }

  // ---------- RSA PKCS#1 v1.5 com SHA-256 ----------
  const big = (hex) => BigInt('0x' + hex);
  function modPow(b, e, m) { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; }
  function rsaSign(key, data) {
    const n = big(key.n), kLen = Math.ceil(key.n.length / 2);
    const di = new Uint8Array([0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20]);
    const t = concat([di, sha256(data)]), em = new Uint8Array(kLen);
    em[0] = 0; em[1] = 1; em.fill(0xff, 2, kLen - t.length - 1); em[kLen - t.length - 1] = 0; em.set(t, kLen - t.length);
    let mInt = 0n; for (const v of em) mInt = (mInt << 8n) | BigInt(v);
    const p = big(key.p), q = big(key.q), m1 = modPow(mInt, big(key.dp), p), m2 = modPow(mInt, big(key.dq), q);
    const h = (big(key.qi) * (((m1 - m2) % p) + p)) % p, s = m2 + h * q;
    if (modPow(s, big(key.e), n) !== mInt) throw new Error('assinatura RSA inválida');
    const out = new Uint8Array(kLen); let v = s; for (let i = kLen - 1; i >= 0; i--) { out[i] = Number(v & 255n); v >>= 8n; }
    return out;
  }
  const hexBytes = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(2 * i, 2), 16); return o; };

  // ---------- ZIP ----------
  function readZip(b) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = b.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('APK modelo inválido');
    const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const entries = [], dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('diretório central inválido');
      const method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true), crc = dv.getUint32(p + 16, true);
      const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      const lo = dv.getUint32(p + 42, true), name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), d0 = lo + 30 + lnl + lxl;
      entries.push({ name, method, time, date, crc, csize, usize, data: b.subarray(d0, d0 + csize) });
      p += 46 + nl + xl + cl;
    }
    return entries;
  }
  function writeZip(entries) {
    const parts = [], cd = []; let off = 0;
    for (const en of entries) {
      const name = enc.encode(en.name);
      // ficheiros guardados sem compressão ficam alinhados a 4 bytes (como o zipalign faz)
      let pad = 0; if (en.method === 0) { pad = (4 - ((off + 30 + name.length) % 4)) % 4; }
      const lh = concat([u32(0x04034b50), u16(en.method === 0 ? 10 : 20), u16(0x0800), u16(en.method), u16(en.time), u16(en.date), u32(en.crc), u32(en.data.length), u32(en.usize), u16(name.length), u16(pad), name, new Uint8Array(pad)]);
      cd.push(concat([u32(0x02014b50), u16(20), u16(en.method === 0 ? 10 : 20), u16(0x0800), u16(en.method), u16(en.time), u16(en.date), u32(en.crc), u32(en.data.length), u32(en.usize), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), name]));
      parts.push(lh, en.data); off += lh.length + en.data.length;
    }
    const cdb = concat(cd);
    const eocd = concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cdb.length), u32(off), u16(0)]);
    return { body: concat(parts), cd: cdb, eocd };
  }

  // ---------- assinatura APK v2 ----------
  function chunkedDigest(sections) {
    const digests = []; const MB = 1048576;
    for (const s of sections) for (let i = 0; i < s.length; i += MB) { const c = s.subarray(i, Math.min(s.length, i + MB)); digests.push(sha256(concat([new Uint8Array([0xa5]), u32(c.length), c]))); }
    return sha256(concat([new Uint8Array([0x5a]), u32(digests.length)].concat(digests)));
  }
  function signV2(zip, key) {
    const { body, cd, eocd } = zip;
    const eocdD = eocd.slice(); eocdD.set(u32(body.length), 16); // na assinatura, o EOCD aponta para o início do bloco de assinatura
    const digest = chunkedDigest([body, cd, eocdD]);
    const cert = hexBytes(key.cert), spki = hexBytes(key.spki);
    const ALG = 0x0103;
    const signedData = concat([lp(lp(concat([u32(ALG), lp(digest)]))), lp(lp(cert)), lp(new Uint8Array(0))]);
    const sig = rsaSign(key, signedData);
    const signer = concat([lp(signedData), lp(lp(concat([u32(ALG), lp(sig)]))), lp(spki)]);
    const v2 = lp(lp(signer));
    const pair = concat([u64(4 + v2.length), u32(0x7109871a), v2]);
    const size = pair.length + 8 + 16;
    const block = concat([u64(size), pair, u64(size), enc.encode('APK Sig Block 42')]);
    const eocdF = eocd.slice(); eocdF.set(u32(body.length + block.length), 16);
    return concat([body, block, cd, eocdF]);
  }

  // ---------- trocas dentro do APK ----------
  function patchManifest(bin, pkg) {
    const out = bin.slice();
    let n = 0;
    for (const [a, b] of [[utf16(PKG_PLACEHOLDER), utf16(pkg)], [enc.encode(PKG_PLACEHOLDER), enc.encode(pkg)]]) {
      let i = find(out, a); while (i >= 0) { out.set(b, i); n++; i = find(out, a, i + a.length); }
    }
    if (!n) throw new Error('marcador do pacote não encontrado no manifesto');
    return out;
  }
  // nome da app no resources.arsc: o espaço tem sempre 30 caracteres, o resto fica a zeros
  function fitLabel(name) {
    let s = String(name).replace(/[\u0000-\u001f]/g, '').trim() || 'Jogo';
    while (enc.encode(s).length > 30 || s.length > 30) s = s.slice(0, -1);
    return s;
  }
  function patchArsc(bin, label) {
    const out = bin.slice(), s = fitLabel(label);
    const a8 = enc.encode(LABEL_PLACEHOLDER), i8 = find(out, a8);
    if (i8 >= 2 && out[i8 - 2] === 30 && out[i8 - 1] === 30) {
      const b = enc.encode(s), units = s.length; // comprimento em unidades UTF-16 e em bytes UTF-8 (ambos < 128)
      out[i8 - 2] = units; out[i8 - 1] = b.length; out.fill(0, i8, i8 + 31); out.set(b, i8);
      return out;
    }
    const a16 = utf16(LABEL_PLACEHOLDER), i16 = find(out, a16);
    if (i16 >= 2) { out[i16 - 2] = s.length; out[i16 - 1] = 0; out.fill(0, i16, i16 + 62); out.set(utf16(s), i16); return out; }
    throw new Error('marcador do nome não encontrado');
  }
  function pngSize(png) { return (png[16] << 24 | png[17] << 16 | png[18] << 8 | png[19]) >>> 0; }

  // ícone: fundo com as cores do tema e o herói ao centro
  function drawIcon(cfg, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'), th = cfg.theme;
    const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, th.bg1); g.addColorStop(1, th.bg2);
    const r = size * 0.22;
    x.beginPath(); x.moveTo(r, 0); x.arcTo(size, 0, size, size, r); x.arcTo(size, size, 0, size, r); x.arcTo(0, size, 0, 0, r); x.arcTo(0, 0, size, 0, r); x.closePath();
    x.fillStyle = g; x.fill(); x.save(); x.clip();
    x.globalAlpha = 0.35; x.fillStyle = th.accent; x.beginPath(); x.arc(size * 0.5, size * 0.55, size * 0.36, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, size * 0.78, size, size * 0.22);
    x.restore();
    MDJ.emoji(x, cfg.hero, size * 0.5, size * 0.52, size * 0.56);
    return c;
  }
  function canvasPng(c) { return b64ToBytes(c.toDataURL('image/png').split(',')[1]); }

  function packageFor(game) {
    // 16 caracteres derivados do id do jogo (começa sempre por letra)
    const h = sha256(enc.encode(game.id || game.name)); let s = 'j';
    const al = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; s.length < 16; i++) s += al[h[i] % 36];
    return PKG_PREFIX + s;
  }
  function fileName(name) {
    const s = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (s || 'jogo') + '.apk';
  }

  function build(game, cfg, opts) {
    opts = opts || {};
    const tpl = opts.template || b64ToBytes(root.MDJ_PLAYER_APK);
    const key = opts.key || root.MDJ_KEY;
    const pkg = packageFor(game);
    const now = new Date(), time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const entries = readZip(tpl).map((en) => {
      let data = null;
      if (en.name === 'AndroidManifest.xml') data = patchManifest(en.data, pkg);
      else if (en.name === 'resources.arsc') data = patchArsc(en.data, cfg.name);
      else if (en.name === 'assets/game.js') data = enc.encode('window.GAME = ' + JSON.stringify(cfg) + ';\n');
      else if (/^res\/mipmap[^/]*\/ic_launcher\.png$/.test(en.name)) data = canvasPng(drawIcon(cfg, pngSize(en.data)));
      if (data === null) return en;
      if (en.method !== 0 && en.name !== 'assets/game.js' && !/\.png$/.test(en.name)) throw new Error(en.name + ' devia estar guardado sem compressão no modelo');
      return { name: en.name, method: 0, time, date, crc: crc32(data), csize: data.length, usize: data.length, data };
    });
    const apk = signV2(writeZip(entries), key);
    return { bytes: apk, pkg, fileName: fileName(cfg.name), label: fitLabel(cfg.name) };
  }

  // um ZIP com um só ficheiro (usado onde não se pode descarregar .apk diretamente)
  function zipOne(name, data) {
    const z = writeZip([{ name, method: 0, time: 0, date: (46 << 9) | (1 << 5) | 1, crc: crc32(data), usize: data.length, data }]);
    return concat([z.body, z.cd, z.eocd]);
  }
  root.MDJApk = { zipOne, build, bytesToB64, b64ToBytes, sha256, crc32, drawIcon, packageFor, fileName };
})(window);
