'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nuvem-'));
const app = require('../server.js');

let base, server;
test.before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
test.after(() => server.close());

function client() {
  let cookie = '';
  return async (method, url, body, raw) => {
    const headers = { 'X-Nuvem': '1', cookie };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    if (raw) return res;
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}

test('fluxo completo', async () => {
  const ana = client(), rui = client();
  assert.equal((await ana('POST', '/api/register', { name: 'Ana', email: 'ana@x.pt', password: '12345678' })).status, 201);
  assert.equal((await rui('POST', '/api/register', { name: 'Rui', email: 'rui@x.pt', password: '12345678' })).status, 201);
  assert.equal((await ana('POST', '/api/register', { name: 'A', email: 'ana@x.pt', password: '12345678' })).status, 409);

  // CSRF: sem cabeçalho é recusado
  const noHdr = await fetch(base + '/api/folders', { method: 'POST' });
  assert.equal(noHdr.status, 403);

  const { data: { item: folder } } = await ana('POST', '/api/folders', { name: 'Projetos' });
  const fd = new FormData();
  fd.append('paths', 'olá.txt');
  fd.append('files', new Blob(['conteúdo']), 'olá.txt');
  fd.append('paths', 'sub/b.txt');
  fd.append('files', new Blob(['b']), 'b.txt');
  const up = await ana('POST', `/api/upload?parent=${folder.id}`, fd);
  assert.equal(up.status, 201);
  assert.equal(up.data.items[0].name, 'olá.txt');

  const list = await ana('GET', `/api/items?parent=${folder.id}`);
  assert.deepEqual(list.data.items.map((i) => i.name), ['sub', 'olá.txt']);
  const file = list.data.items.find((i) => i.type === 'file');

  // Rui ainda não tem acesso
  assert.equal((await rui('GET', `/api/items/${file.id}/content`, undefined, true)).status, 404);
  assert.equal((await ana('POST', `/api/items/${folder.id}/shares`, { email: 'rui@x.pt', role: 'viewer' })).status, 201);
  const shared = await rui('GET', '/api/items?view=shared');
  assert.equal(shared.data.items[0].name, 'Projetos');
  const content = await rui('GET', `/api/items/${file.id}/content`, undefined, true);
  assert.equal(await content.text(), 'conteúdo');
  // Leitor não pode mudar o nome nem carregar
  assert.equal((await rui('PATCH', `/api/items/${file.id}`, { name: 'x' })).status, 403);
  // Editor pode
  await ana('POST', `/api/items/${folder.id}/shares`, { email: 'rui@x.pt', role: 'editor' });
  assert.equal((await rui('PATCH', `/api/items/${file.id}`, { name: 'novo.txt' })).status, 200);
  assert.equal((await rui('DELETE', `/api/items/${file.id}`)).status, 403);

  // Mover pasta para dentro de si própria é recusado
  const sub = list.data.items.find((i) => i.name === 'sub');
  assert.equal((await ana('PATCH', `/api/items/${folder.id}`, { parent: sub.id })).status, 400);

  // Pesquisa
  assert.equal((await ana('GET', '/api/items?q=novo')).data.items.length, 1);

  // Link público
  const pub = await ana('POST', `/api/items/${file.id}/public`, { enabled: true });
  const pr = await fetch(`${base}/s/${pub.data.publicToken}`);
  assert.equal(await pr.text(), 'conteúdo');

  // Lixo e restauro
  await ana('DELETE', `/api/items/${folder.id}`);
  assert.equal((await ana('GET', '/api/items?view=mydrive')).data.items.length, 0);
  assert.equal((await fetch(`${base}/s/${pub.data.publicToken}`)).status, 404);
  assert.equal((await rui('GET', '/api/items?view=shared')).data.items.length, 0);
  await ana('POST', `/api/items/${folder.id}/restore`);
  assert.equal((await ana('GET', '/api/items?view=mydrive')).data.items.length, 1);

  // Eliminar para sempre liberta espaço
  const before = (await ana('GET', '/api/me')).data.usage;
  assert.ok(before > 0);
  await ana('DELETE', `/api/items/${folder.id}`);
  await ana('DELETE', '/api/trash');
  assert.equal((await ana('GET', '/api/me')).data.usage, 0);

  // Logout
  await ana('POST', '/api/logout');
  assert.equal((await ana('GET', '/api/me')).status, 401);
  assert.equal((await ana('POST', '/api/login', { email: 'ana@x.pt', password: 'errada12' })).status, 401);
  assert.equal((await ana('POST', '/api/login', { email: 'ANA@x.pt', password: '12345678' })).status, 200);
});
