// Capítulo 2 — "Teste 8". Oito setores na Ala Espelho do LAB-7.
// Cada setor 1–6 guarda uma "memória" (um dígito); o setor 8 pede as seis por ordem.

const rnd = (n) => Math.floor(Math.random() * n);
let A = null; // api do setor ativo

// ---------- pequenos ajudantes ----------
function note(x, y, z, prompt, text, rot) {
  const n = A.box(0.3, 0.01, 0.4, 0xf4efe1, x, y, z); n.rotation.y = rot || 0;
  A.interact(n, () => prompt, () => A.showNote(text));
  return n;
}
function desk(x, z, w, d) {
  w = w || 1.4; d = d || 0.7;
  A.box(w, 0.06, d, 0x6d5844, x, 0.76, z, true); A.box(w - 0.1, 0.72, d - 0.1, 0x4a3d31, x, 0.37, z);
}
function bed(x, z, alongX) {
  const w = alongX ? 2.0 : 1.0, d = alongX ? 1.0 : 2.0;
  A.box(w + 0.1, 0.45, d + 0.1, 0x6a737d, x, 0.25, z, true);
  A.box(w, 0.12, d, 0x8f969c, x, 0.53, z);
}
function wallBoard(text, x, y, z, rotY, w, prompt, content, bg, fg) {
  const t = A.textTex(512, 256, bg || '#e9e4d6', (c) => {
    c.fillStyle = fg || '#1b1b1b'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
    text.split('\n').forEach((l, i) => c.fillText(l, 256, 60 + i * 44));
  });
  const m = A.plane(w || 1.4, (w || 1.4) / 2, new A.THREE.MeshLambertMaterial({ map: t }), x, y, z, rotY || 0);
  if (prompt) A.interact(m, () => prompt, () => A.showNote(content));
  return m;
}
function elevatorDoors(x, z, rotY, label) {
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  A.box(along ? 0.08 : 2.2, 2.6, along ? 2.2 : 0.08, A.mat(0x5b636c, { metalness: 0.8, roughness: 0.35 }), x, 1.3, z);
  A.sign(label || 'ELEVADOR', x + (along ? Math.sign(Math.sin(rotY)) * 0.06 : 0), 2.75, z + (along ? 0 : Math.sign(Math.cos(rotY)) * 0.06), rotY, '#3a2a10', '#ffd27a', 1.1);
}
function photo(x, y, z, rot, pos, digit) {
  const t = A.textTex(128, 96, '#d8d0bc', (c) => {
    c.fillStyle = '#3d4a52'; c.fillRect(8, 8, 112, 70);
    for (let k = 0; k < 5; k++) { c.fillStyle = '#e9e4d6'; c.beginPath(); c.arc(24 + k * 20, 40, 7, 0, 7); c.fill(); c.fillRect(17 + k * 20, 48, 14, 24); }
  });
  const m = A.box(0.2, 0.01, 0.15, new A.THREE.MeshLambertMaterial({ map: t }), x, y, z); m.rotation.y = rot || 0;
  A.interact(m, () => 'Ver a fotografia', () => A.showNote(
    'Fotografia de grupo: cinco pessoas de bata branca à frente da entrada do LAB-7. Uma das caras foi riscada com caneta.\n\n' +
    'No verso, à mão:\n\n' + '●'.repeat(pos) + '   ' + digit));
}
function grate(x, z) { A.box(1.2, 0.04, 1.2, A.mat(0x2a2e33, { metalness: 0.7 }), x, 0.02, z); }

// ---------------------------------------------------------------------------
// 1 — DORMITÓRIOS
// ---------------------------------------------------------------------------
const s1 = {
  title: 'SETOR 1 — DORMITÓRIOS', subtitle: 'CAPÍTULO 2 · TESTE 8', frag: 1,
  intro: 'Acordas noutra cama. Este quarto é parecido com o da quarentena… mas não é o mesmo.',
  map: [
    '#################',
    '#...#...#...#...#',
    '#...#...#...#...#',
    '##D###D###D###K##',
    '#...............X',
    '##D###D###D######',
    '#...#...#...#    ',
    '#...#...#...#    ',
    '#############    '
  ],
  rooms: [['n1', 1, 1, 3, 2], ['n2', 5, 1, 7, 2], ['n3', 9, 1, 11, 2], ['n4', 13, 1, 15, 2], ['s1', 1, 6, 3, 7], ['s2', 5, 6, 7, 7], ['s3', 9, 6, 11, 7]],
  start: [2.5, 1.8, Math.PI], ambient: 0.4, power: true,
  doors: {
    K: { label: 'QUARTO 4', color: '#8a5cff', prompt() { return 'Teclado do quarto 4 (3 dígitos)'; }, use(d) { A.openKeypad({ code: A.G.s.code, onOk() { A.openDoor(d); A.toast('A porta do quarto 4 destrancou.'); } }); } },
    X: { label: 'SAÍDA ALA', color: '#2ecc71', lock: 'green', exit: true }
  },
  objective(G) {
    if (!G.doors.find((d) => d.ch === 'K').open) return 'O quarto 4 está trancado. Procura nos outros quartos os números do teclado.';
    if (!G.s.clock) return 'Há um relógio parado no quarto 4. Descobre a que horas o deves acertar.';
    if (!G.inv.green) return 'Apanha o que estava escondido atrás do relógio.';
    return 'Sai da ala dos dormitórios pela porta verde ao fundo do corredor.';
  },
  build(api) {
    A = api; const { S, G } = api;
    const digits = [rnd(10), rnd(10), rnd(10)];
    G.s.code = digits.join('');
    const H = 1 + rnd(12), M = 5 * (1 + rnd(11));
    G.s.time = [H, M];
    // luzes
    api.addLight(2 * S + 1.25, 1.5 * S + 1.25, 0xdfe8ff, 1.3, 'n1');
    api.addLight(6.5 * S, 2 * S, 0xdfe8ff, 0.9, 'n2', { flicker: true });
    api.addLight(10.5 * S, 2 * S, 0xdfe8ff, 0.9, 'n3');
    api.addLight(14.5 * S, 2 * S, 0xdfe8ff, 1.2, 'n4');
    api.addLight(2.5 * S, 7 * S, 0xdfe8ff, 1.0, 's1');
    api.addLight(10.5 * S, 7 * S, 0xb8ffd8, 0.9, 's3', { flicker: true });
    api.addLight(8.5 * S, 4.5 * S, 0xdfe8ff, 1.2, 'c');
    [[2, 'QUARTO 1'], [6, 'QUARTO 2'], [10, 'QUARTO 3'], [14, 'QUARTO 4']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 4 * S + 0.02, 0, '#1c2630', '#cfe3f3', 0.9));
    [[2, 'QUARTO 5'], [6, 'QUARTO 6'], [10, 'BALNEÁRIO']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S - 0.02, Math.PI, '#1c2630', '#cfe3f3', 0.9));
    api.pipe('x', 2.5, 40, 2.7, 4 * S + 0.3, 0.12);
    // quarto 1 (o teu)
    bed(1.6 * S, 1.6 * S); api.sign('SUJEITO 12 · TESTE 8', 1.6 * S, 1.5, 1 * S + 0.03, 0, '#5a1414', '#ffd0d0', 0.9);
    note(2.5 * S, 0.01, 2.8 * S, 'Ler o papel enfiado por baixo da porta',
      'Sujeito 12,\n\nnão estás sozinho. Sou a Marta, Sujeito 11. Também acordei aqui.\n\n' +
      'Os quartos 2, 3 e 6 têm fotografias com números escritos no verso. O teclado do quarto 4 aceita-os pela ordem dos pontos.\n\n' +
      'Rasga este papel depois de leres. Eles veem tudo.\n\n— M.', 0.3);
    // quartos 2, 3 e 6: fotografias
    const order = api.shuffle([0, 1, 2]);
    bed(5.6 * S, 1.6 * S); api.box(0.4, 0.5, 0.4, 0x4a3d31, 7.3 * S, 0.25, 1.4 * S, true); photo(7.3 * S, 0.51, 1.4 * S, 0.4, order[0] + 1, digits[order[0]]);
    bed(9.6 * S, 1.6 * S); desk(11 * S, 2.6 * S, 1.2, 0.6); photo(11 * S, 0.8, 2.6 * S, -0.3, order[1] + 1, digits[order[1]]);
    bed(5.6 * S, 7.4 * S); api.box(0.4, 0.5, 0.4, 0x4a3d31, 7.3 * S, 0.25, 7.6 * S, true); photo(7.3 * S, 0.51, 7.6 * S, 1.2, order[2] + 1, digits[order[2]]);
    api.box(0.9, 0.04, 0.6, 0xc8c2b0, 10 * S, 0.02, 1.6 * S).rotation.y = 0.4;
    // quarto 5: diário da Marta (hora do relógio)
    bed(1.6 * S, 7.4 * S); desk(3.2 * S, 6.4 * S, 1.2, 0.6);
    note(3.2 * S, 0.8, 6.4 * S, 'Ler o diário da Marta',
      'DIÁRIO — M.\n\nTodas as noites, às ' + H + ':' + String(M).padStart(2, '0') + ', as portas dos quartos destrancam-se sozinhas.\n\n' +
      'Levam um de nós. Quem volta já não se lembra de nada.\n\nNo quarto 4 há um relógio que está sempre parado. Acho que esconde alguma coisa.');
    // balneário
    for (let k = 0; k < 3; k++) { api.box(0.45, 0.85, 0.6, 0xb8bec4, 9 * S + 0.25, 0.43, (6.4 + k * 0.6) * S, true); }
    wallBoard('ELES VEEM\nTUDO', 9 * S + 0.03, 1.8, 7 * S, Math.PI / 2, 1.6, null, null, '#1d2a2a', '#b31313');
    api.box(0.9, 0.02, 0.7, 0x2a2e33, 10.5 * S, 0.01, 7.5 * S); api.steamVent(10.5 * S, 7.4 * S, 's3');
    // quarto 4: relógio e compartimento escondido
    bed(15.4 * S, 1.6 * S);
    const ct = api.textTex(128, 128, '#e9e4d6', (c) => {
      c.strokeStyle = '#222'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.stroke();
      c.lineWidth = 5; c.beginPath(); c.moveTo(64, 64); c.lineTo(64, 24); c.moveTo(64, 64); c.lineTo(92, 74); c.stroke();
    });
    const clk = api.plane(0.6, 0.6, new api.THREE.MeshLambertMaterial({ map: ct }), 13.6 * S, 1.9, 1 * S + 0.03, 0);
    const panel = api.box(0.7, 0.6, 0.06, 0x5a626b, 14.6 * S, 1.2, 1 * S + 0.03);
    api.interact(clk, () => G.s.clock ? 'Relógio' : 'Acertar o relógio parado', () => {
      if (G.s.clock) return;
      api.openClock({
        target: G.s.time, onWin() {
          G.s.clock = true; api.snd.locker(14.6 * S, 1 * S); api.anim(panel, 'x', -1.4);
          panel.position.y = 0.2;
          api.addItem('green', 14.6 * S, 1.2, 1 * S + 0.2);
          api.fragment(1, 14.3 * S, 0.95, 1 * S + 0.3, 'Atrás do relógio, uma fotografia antiga: tu, de bata branca, a sorrir ao lado da Dra. Moura.\n\nNo bordado da bata: «T. Reis».\n\nNão te lembras de a ter vestido. Mas a bata serve-te.');
          api.box(0.8, 0.04, 0.4, 0x3a3f45, 14.6 * S, 0.9, 1 * S + 0.25);
          api.toast('Ouviste um clique. Um painel abriu-se na parede.');
        }
      });
    });
    elevatorDoors(17 * S - 0.6, 4.5 * S, -Math.PI / 2, 'ALA ESPELHO');
  }
};

// ---------------------------------------------------------------------------
// 2 — REFEITÓRIO
// ---------------------------------------------------------------------------
const s2 = {
  title: 'SETOR 2 — REFEITÓRIO', subtitle: 'NÍVEL −3', frag: 2,
  intro: 'O refeitório está vazio, mas as mesas ainda têm tabuleiros.',
  map: [
    '#################',
    '#.......#.......#',
    '#.......#.......#',
    '#.......D.......#',
    '#.......#.......#',
    '#.......####F####',
    'X.......#.......#',
    '#.......#.......#',
    '#.......#.......#',
    '#################'
  ],
  rooms: [['r', 1, 1, 7, 8], ['k', 9, 1, 15, 4], ['f', 9, 6, 15, 8]],
  start: [4.5, 8.2, 0], ambient: 0.45, power: false,
  doors: {
    F: { label: 'CÂMARA FRIGORÍFICA', color: '#4fc3f7', check() { return A.G.power ? null : 'A porta da câmara frigorífica não tem energia.'; } },
    X: {
      label: 'MONTA-CARGAS', color: '#ffb02e', exit: true,
      prompt() { return 'Teclado do monta-cargas (4 dígitos)'; },
      use(d) { A.openKeypad({ code: A.G.s.morse, onOk() { A.openDoor(d); A.toast('O monta-cargas abriu.'); } }); }
    }
  },
  objective(G) {
    if (!G.power) return 'A cozinha está sem energia. Repara o painel lógico na cozinha.';
    if (!G.s.seenMorse) return 'A câmara frigorífica abriu. Vê o que lá está dentro.';
    return 'O monta-cargas (parede oeste do refeitório) pede um código de 4 dígitos.';
  },
  update() { const G = A.G; if (!G.s.seenMorse && G.x > 22.5 && G.z > 15) G.s.seenMorse = true; },
  build(api) {
    A = api; const { S, G } = api;
    G.s.morse = [0, 1, 2, 3].map(() => rnd(10)).join('');
    api.addLight(4.5 * S, 3 * S, 0xfff1dc, 1.6, 'r'); api.addLight(4.5 * S, 7 * S, 0xfff1dc, 1.4, 'r', { flicker: true });
    api.addLight(12 * S, 2.5 * S, 0xff2a1a, 1.3, 'k', { emerg: true });
    api.addLight(12 * S, 7 * S, 0x9fd8ff, 0.9, 'f');
    // mesas do refeitório
    [[2.6, 2.4], [5.4, 2.4], [2.6, 5.2], [5.4, 5.2]].forEach(([c, r]) => {
      api.box(2.2, 0.06, 0.9, 0x8a8f96, c * S, 0.76, r * S, true); api.box(0.1, 0.72, 0.1, 0x3a3f45, c * S, 0.37, r * S);
      api.box(2.2, 0.05, 0.35, 0x5b636c, c * S, 0.45, r * S - 0.75, true); api.box(2.2, 0.05, 0.35, 0x5b636c, c * S, 0.45, r * S + 0.75, true);
      for (let k = 0; k < 3; k++) api.box(0.35, 0.02, 0.25, 0x9aa3ad, c * S - 0.7 + k * 0.7, 0.8, r * S + (k % 2 ? 0.2 : -0.2));
    });
    wallBoard('MENU · SEMANA 8\nSopa de legumes\nPeixe grelhado\nGelatina (sujeitos)', 4.5 * S, 1.8, 1 * S + 0.03, 0, 1.8, 'Ler o menu',
      'MENU — SEMANA 8\n\nSopa de legumes · Peixe grelhado · Gelatina\n\nNota manuscrita no canto: «Gelatina SÓ para os sujeitos. A equipa come à parte.»');
    elevatorDoors(4.5 * S, 9 * S - 0.06, Math.PI, 'ELEVADOR');
    api.sign('MONTA-CARGAS ←', 1 * S + 0.05, 2.6, 6.5 * S, Math.PI / 2, '#3a2a10', '#ffd27a', 1.1);
    note(5.4 * S + 0.6, 0.8, 5.2 * S, 'Ler o bilhete num tabuleiro',
      'Cozinha: depois do apagão, o painel lógico ao pé da câmara frigorífica tem de acender as DUAS lâmpadas ao mesmo tempo.\n\n' +
      'O código do monta-cargas? Pergunta à luz que pisca lá dentro. Ela fala em Morse.\n\n— turno da noite');
    // cozinha
    api.box(4.0, 0.9, 0.8, api.mat(0x9aa3ad, { metalness: 0.7 }), 12 * S, 0.45, 1 * S + 0.45, true);
    api.box(0.8, 0.9, 3.0, api.mat(0x9aa3ad, { metalness: 0.7 }), 15.5 * S, 0.45, 2.5 * S, true);
    api.box(2.4, 0.9, 1.0, api.mat(0x7f8890, { metalness: 0.6 }), 12 * S, 0.45, 3 * S, true);
    for (let k = 0; k < 4; k++) api.box(0.3, 0.2, 0.3, 0x3a3f45, (10.8 + k * 0.6) * S, 1.0, 1 * S + 0.45);
    // tabela de Morse
    const mt = api.textTex(256, 512, '#e9e4d6', (c) => {
      c.fillStyle = '#1b1b1b'; c.font = 'bold 26px sans-serif'; c.fillText('CÓDIGO MORSE', 20, 40);
      const M = ['-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.'];
      M.forEach((m, i) => {
        c.font = 'bold 30px monospace'; c.fillText(String(i), 30, 90 + i * 42);
        [...m].forEach((s, k) => { if (s === '.') { c.beginPath(); c.arc(90 + k * 32, 80 + i * 42, 6, 0, 7); c.fill(); } else c.fillRect(78 + k * 32, 76 + i * 42, 26, 8); });
      });
    });
    const mp = api.plane(0.9, 1.8, new api.THREE.MeshLambertMaterial({ map: mt }), 9 * S + 0.03, 1.5, 2 * S, Math.PI / 2);
    api.interact(mp, () => 'Ver a tabela de código Morse', () => api.toast('Ponto = sinal curto · Traço = sinal longo. Cada número tem cinco sinais.'));
    // painel lógico
    api.box(0.8, 0.9, 0.1, api.mat(0x2b3036, { metalness: 0.6 }), 14 * S, 1.4, 5 * S - 0.05);
    const lp = api.box(0.5, 0.4, 0.05, api.mat(0x111418), 14 * S, 1.45, 5 * S - 0.12);
    api.sign('PAINEL LÓGICO', 14 * S, 2.0, 5 * S - 0.11, Math.PI, '#0b1a22', '#7dffcf', 0.8);
    api.interact(lp, () => G.power ? 'Painel lógico (ok)' : 'Reparar o painel lógico', () => {
      if (G.power) return;
      api.openLogic({ onWin() { api.powerOn('⚡ A cozinha voltou a ter energia.'); api.openDoor('F'); } });
    });
    // câmara frigorífica
    for (let k = 0; k < 3; k++) api.crate((10 + k * 2.2) * S, 8.5 * S, 0.9, k * 0.3);
    api.box(0.8, 2.0, 2.6, api.mat(0x9aa3ad, { metalness: 0.6 }), 15.5 * S, 1.0, 7 * S, true);
    api.morseLight(12 * S, 2.3, 9 * S - 0.2, G.s.morse);
    api.box(0.4, 0.2, 0.15, api.mat(0x2b3036), 12 * S, 2.3, 9 * S - 0.1);
    api.fragment(2, 10 * S, 1.0, 8.5 * S, 'Uma etiqueta de congelação, com a tua letra:\n\n«Amostra pessoal — T. R. — NÃO DESCONGELAR antes do Teste 8.»\n\nLembras-te do frio nas mãos ao escrevê-la.');
    api.steamVent(12 * S, 7 * S, 'f');
  }
};

// ---------------------------------------------------------------------------
// 3 — ALA MÉDICA
// ---------------------------------------------------------------------------
const s3 = {
  title: 'SETOR 3 — ALA MÉDICA', subtitle: 'NÍVEL −3', frag: 3,
  intro: 'Cheira a desinfetante. As camas da enfermaria ainda estão desfeitas.',
  map: [
    '###################',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '###D#####D#####M###',
    '#.................#',
    '#.................X',
    '#########D#########',
    '      #.....#      ',
    '      #.....#      ',
    '      #######      '
  ],
  rooms: [['e', 1, 1, 5, 3], ['x', 7, 1, 11, 3], ['f', 13, 1, 17, 3], ['g', 7, 8, 11, 9]],
  start: [1.6, 5.6, -Math.PI / 2], ambient: 0.45, power: true,
  doors: {
    M: { label: 'FARMÁCIA', color: '#43a047', prompt() { return 'Teclado da farmácia (4 dígitos)'; }, use(d) { A.openKeypad({ code: A.G.s.xcode, onOk() { A.openDoor(d); A.toast('A farmácia abriu.'); } }); } },
    X: { label: 'SEGURANÇA', color: '#3b82f6', lock: 'blue', exit: true }
  },
  objective(G) {
    if (!G.inv.contrast && !G.s.xray) return 'A máquina de raio-X precisa de contraste. Prepara-o no misturador da enfermaria (a receita está no gabinete médico).';
    if (!G.s.xray) return 'Leva o contraste à máquina de raio-X.';
    if (!G.doors.find((d) => d.ch === 'M').open) return 'Lê os números na radiografia e abre a farmácia.';
    if (!G.inv.blue) return 'Procura na farmácia o cartão de acesso à Segurança.';
    return 'Segue para a Segurança pela porta azul ao fundo do corredor.';
  },
  build(api) {
    A = api; const { S, G } = api;
    const pool = [0, 1, 2, 3, 4]; // sem preto, para a receita ser justa
    const target = api.shuffle(pool.slice()).slice(0, 3);
    G.s.xcode = [0, 1, 2, 3].map(() => rnd(10)).join('');
    api.addLight(3 * S, 2 * S, 0xe8fff6, 1.4, 'e'); api.addLight(9.5 * S, 2.5 * S, 0x9fb8ff, 0.8, 'x');
    api.addLight(15.5 * S, 2.5 * S, 0xe8fff6, 1.3, 'f'); api.addLight(9.5 * S, 9 * S, 0xfff1dc, 1.2, 'g');
    api.addLight(5 * S, 6 * S, 0xe8fff6, 1.2, 'c'); api.addLight(14 * S, 6 * S, 0xe8fff6, 1.0, 'c', { flicker: true });
    [[3, 'ENFERMARIA'], [9, 'RAIO-X'], [15, 'FARMÁCIA']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0));
    api.sign('GABINETE MÉDICO', 10 * S + 0.5, 2.2, 7 * S - 0.02, Math.PI);
    elevatorDoors(1 * S + 0.06, 5.5 * S + 0.6, Math.PI / 2, 'MONTA-CARGAS');
    api.pipe('x', 2.5, 45, 2.7, 5 * S + 0.3, 0.12);
    // enfermaria: camas e misturador
    [1.6, 3, 4.4].forEach((c) => bed(c * S, 1.7 * S));
    api.box(1.2, 1.0, 0.6, api.mat(0x3c434b, { metalness: 0.5 }), 5.3 * S, 0.5, 3.3 * S, true);
    const mixer = api.box(0.6, 0.5, 0.4, api.mat(0x9fd3ff, { transparent: true, opacity: 0.5 }), 5.3 * S, 1.25, 3.3 * S);
    api.sign('MISTURADOR', 5.3 * S, 1.75, 3.3 * S + 0.31, 0, '#0b1a22', '#9fd8ff', 0.7);
    api.interact(mixer, () => G.s.mixed ? 'Misturador (vazio)' : 'Usar o misturador', () => {
      if (G.s.mixed) return;
      api.openMix({ target, onWin() { G.s.mixed = true; api.addItem('contrast', 5.3 * S - 0.9, 1.1, 3.3 * S); api.toast('O misturador encheu um frasco de contraste.'); } });
    });
    // gabinete: receita
    desk(9.5 * S, 8.4 * S, 1.8, 0.8);
    note(9.5 * S, 0.8, 8.4 * S, 'Ler a receita',
      'RECEITA — CONTRASTE RADIOLÓGICO (n.º 3)\n\nMisturar TRÊS componentes no misturador da enfermaria até a cor ficar igual à da amostra.\n\n' +
      '• Um dos componentes é o ' + api.VIALS[target[0]][0] + '.\n• Nunca usar o preto.\n\nO misturador mostra a cor da amostra ao lado.');
    api.box(0.5, 1.8, 1.6, 0x5a4a3c, 7 * S + 0.3, 0.9, 8.5 * S, true);
    note(10.8 * S, 0.01, 9.2 * S, 'Apanhar uma folha do chão',
      'Ficha clínica — Sujeito 11 (Marta Vaz)\n\nReação adversa à memória induzida. Recordou o nome de um investigador: «Tomás».\n\nAumentar dose.');
    // raio-X: máquina e caixa de luz
    api.box(1.0, 0.8, 2.0, 0x6a737d, 9.5 * S, 0.4, 2.2 * S, true);
    api.box(0.3, 1.6, 0.3, 0x9aa3ad, 9.5 * S, 1.6, 1.4 * S);
    const head = api.box(0.6, 0.3, 0.6, api.mat(0xd8dde2), 9.5 * S, 2.2, 2 * S);
    api.interact(head, () => G.s.xray ? 'Máquina de raio-X' : (G.inv.contrast ? 'Pôr o contraste na máquina' : 'Máquina de raio-X (precisa de contraste)'), () => {
      if (G.s.xray) return;
      if (!G.inv.contrast) { api.snd.deny(); api.toast('Sem contraste a máquina não mostra nada.'); return; }
      G.inv.contrast = false; G.s.xray = true; api.renderInv(); api.snd.powerOn();
      lb.material = new api.THREE.MeshBasicMaterial({ map: xtex });
      api.toast('A caixa de luz acendeu com uma radiografia.');
    });
    const xtex = api.textTex(256, 384, '#0a1418', (c) => {
      c.strokeStyle = '#cfe3f3'; c.lineWidth = 6; c.beginPath(); c.moveTo(128, 30); c.lineTo(128, 360); c.stroke();
      c.lineWidth = 4;
      for (let k = 0; k < 8; k++) { const y = 70 + k * 34; c.beginPath(); c.moveTo(128, y); c.quadraticCurveTo(60, y + 10, 40, y + 34); c.moveTo(128, y); c.quadraticCurveTo(196, y + 10, 216, y + 34); c.stroke(); }
      c.fillStyle = '#ffd27a'; c.font = 'bold 30px monospace';
      [...G.s.xcode].forEach((d, i) => { c.fillText(['I', 'II', 'III', 'IV'][i] + ':' + d, i % 2 ? 160 : 20, 100 + i * 70); });
    });
    const lb = api.plane(0.9, 1.35, new api.THREE.MeshBasicMaterial({ color: 0x111418 }), 7 * S + 0.04, 1.6, 2 * S, Math.PI / 2);
    api.interact(lb, () => G.s.xray ? 'Ver a radiografia' : 'Caixa de luz (apagada)', () => {
      if (G.s.xray) api.toast('Na radiografia há números junto às costelas: I, II, III e IV.');
    });
    // farmácia
    for (let k = 0; k < 2; k++) {
      api.box(3.6, 2.0, 0.5, api.mat(0xb8bec4, { metalness: 0.4 }), 15.5 * S, 1.0, (1.2 + k * 2.4) * S, true);
      for (let i = 0; i < 10; i++) api.box(0.12, 0.2, 0.12, [0xffffff, 0xffd27a, 0x9fd8ff][i % 3], 15.5 * S - 1.5 + i * 0.33, 1.1 + (i % 2) * 0.5, (1.2 + k * 2.4) * S + (k ? -0.27 : 0.27));
    }
    api.addItem('blue', 13.6 * S, 1.0, 2.4 * S);
    api.box(0.6, 0.9, 0.6, 0x3a3f45, 13.6 * S, 0.45, 2.4 * S, true);
    api.fragment(3, 17.2 * S, 1.0, 2.4 * S, 'Uma receita antiga, passada em teu nome:\n\n«Dr. Tomás Reis — Supressor de memória Ω-1. Dose: a que for necessária.»\n\nAssinada por ti.');
    api.box(0.6, 0.9, 0.6, 0x3a3f45, 17.2 * S, 0.45, 2.4 * S, true);
  }
};

// ---------------------------------------------------------------------------
// 4 — SEGURANÇA (drones)
// ---------------------------------------------------------------------------
const s4 = {
  title: 'SETOR 4 — SEGURANÇA', subtitle: 'NÍVEL −4', frag: 4,
  intro: 'Ouves hélices no corredor. Drones de patrulha. Não te deixes ver pela luz deles.',
  map: [
    '#####################',
    '#...#...........#...#',
    '#...#...........#...#',
    '#...#...........#...#',
    '##D###D######D###D###',
    '#...................#',
    '#....#....#....#....#',
    '#...................X',
    '##########S##########',
    '        #...#        ',
    '        #...#        ',
    '        #####        '
  ],
  rooms: [['i', 1, 1, 3, 3], ['a', 5, 1, 15, 3], ['cam', 17, 1, 19, 3], ['of', 9, 9, 11, 10]],
  start: [2, 1.8, Math.PI], ambient: 0.35, power: true,
  doors: {
    S: { label: 'GABINETE', color: '#8f9aa6', check() { return A.G.s.laser ? null : 'Trancada pelo sistema ótico (sala das câmaras).'; } },
    X: { label: 'COMUNICAÇÕES', color: '#ef4444', lock: 'red', exit: true }
  },
  objective(G) {
    if (!G.s.laser) return 'Chega à sala das câmaras sem seres visto e desliga o sistema ótico. (O armazém tem uma segunda porta…)';
    if (!G.inv.red) return 'Os drones caíram. Entra no gabinete de segurança.';
    return 'Segue para as Comunicações pela porta vermelha.';
  },
  update() {
    const G = A.G, c = Math.floor(G.x / A.S), r = Math.floor(G.z / A.S);
    if (r >= 1 && r <= 3 && c >= 5 && c <= 15 && !G.s.cp1) { G.s.cp1 = true; A.setCheckpoint(G.x, G.z, G.yaw); A.toast('Ponto seguro: armazém.'); }
    if (r >= 1 && r <= 3 && c >= 17 && !G.s.cp2) { G.s.cp2 = true; A.setCheckpoint(G.x, G.z, G.yaw); }
  },
  build(api) {
    A = api; const { S, G } = api;
    api.addLight(2 * S, 2 * S, 0xdfe8ff, 1.2, 'i'); api.addLight(7 * S, 2 * S, 0xfff1dc, 0.9, 'a'); api.addLight(13 * S, 2 * S, 0xfff1dc, 0.9, 'a', { flicker: true });
    api.addLight(18 * S, 2 * S, 0x9fb8ff, 1.0, 'cam'); api.addLight(6 * S, 6.5 * S, 0xffd0a0, 0.9, 'c'); api.addLight(15 * S, 6.5 * S, 0xffd0a0, 0.9, 'c');
    api.addLight(10.5 * S, 10 * S, 0xfff1dc, 1.0, 'of');
    elevatorDoors(1 * S + 0.06, 2 * S, Math.PI / 2, 'MONTA-CARGAS');
    note(3.4 * S, 0.01, 3.4 * S, 'Ler o registo de turno',
      'REGISTO DE TURNO — SEGURANÇA\n\n03:00 Drones de patrulha ativos no corredor principal. Cone de visão de 7 m à frente.\n\n' +
      '03:10 Os drones não veem através de paredes, pilares nem estantes. Esconde-te e espera que passem.\n\n' +
      '03:12 INCIDENTE. O sistema ótico da sala das câmaras desliga os drones e o trinco do gabinete.');
    // armazém com estantes altas
    for (let k = 0; k < 3; k++) { api.box(3.0, 2.2, 0.6, api.mat(0x4a525a, { metalness: 0.5 }), (7 + k * 3.5) * S, 1.1, 2 * S, true); api.crate((8.2 + k * 3.5) * S, 3.4 * S, 0.8, k); }
    api.sign('ARMAZÉM', 6.5 * S + 0.6, 2.2, 4 * S + 0.02, 0); api.sign('ARMAZÉM', 13.5 * S + 0.6, 2.2, 4 * S + 0.02, 0); api.sign('CÂMARAS', 18 * S, 2.2, 4 * S + 0.02, 0);
    // drones no corredor (dois, em sentidos opostos)
    const z5 = 5.5 * S, z7 = 7.5 * S;
    api.addDrone([[19.4 * S, z5], [19.4 * S, z7], [2.6 * S, z7], [2.6 * S, z5]], 1.7);
    api.addDrone([[19.4 * S, z7], [11.5 * S, z7], [11.5 * S, z5], [19.4 * S, z5]], 1.5);
    // sala das câmaras: monitores e laser
    for (let k = 0; k < 3; k++) {
      const t = api.textTex(128, 96, '#0b1210', (c) => { for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(180,220,200,' + Math.random() * 0.5 + ')'; c.fillRect(Math.random() * 128, Math.random() * 96, 2, 2); } c.fillStyle = '#7dffcf'; c.font = '12px monospace'; c.fillText('CAM 0' + (k + 1), 6, 14); });
      api.plane(0.7, 0.5, new api.THREE.MeshBasicMaterial({ map: t }), (17.4 + k * 0.9) * S, 1.9, 1 * S + 0.04, 0);
    }
    desk(18 * S, 1.6 * S, 2.6, 0.8);
    const lc = api.box(0.6, 0.35, 0.05, api.mat(0x111418), 18 * S, 1.05, 1.6 * S - 0.25);
    api.interact(lc, () => G.s.laser ? 'Sistema ótico (desligado)' : 'Consola do sistema ótico', () => {
      if (G.s.laser) return;
      api.openLaser({ onWin() { G.s.laser = true; api.dronesOff(); api.openDoor('S'); api.snd.powerOn(); api.toast('Os drones caíram. O gabinete destrancou.'); } });
    });
    // gabinete de segurança
    desk(10.5 * S, 9.6 * S, 1.6, 0.7);
    api.addItem('red', 10.5 * S - 0.3, 0.86, 9.6 * S);
    api.fragment(4, 10.5 * S + 0.4, 0.86, 9.6 * S, 'Um cartão de identificação, já sem fita:\n\n«LAB-7 · Acesso total · Dr. Tomás Reis».\n\nA foto foi arrancada. Mas o código de acesso escrito por trás é a tua data de nascimento. Sabes isso sem saber como.');
    api.box(0.5, 1.8, 1.0, 0x3a3f45, 9 * S + 0.3, 0.9, 9.6 * S, true);
  }
};

// ---------------------------------------------------------------------------
// 5 — COMUNICAÇÕES
// ---------------------------------------------------------------------------
const s5 = {
  title: 'SETOR 5 — COMUNICAÇÕES', subtitle: 'NÍVEL −4', frag: 5,
  intro: 'Rádios, servidores e uma antena. Talvez consigas falar com alguém lá fora.',
  map: [
    '###################',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '###D#####R#####C###',
    '#.................X',
    '###################'
  ],
  rooms: [['r', 1, 1, 5, 3], ['s', 7, 1, 11, 3], ['a', 13, 1, 17, 3]],
  start: [1.6, 5.5, -Math.PI / 2], ambient: 0.4, power: true,
  doors: {
    R: { label: 'SERVIDORES', color: '#8f9aa6', check() { return A.G.s.radio ? null : 'Trancada à distância. Talvez alguém a possa abrir… pelo rádio.'; } },
    C: { label: 'ANTENA', color: '#8f9aa6', check() { return A.G.s.cables ? null : 'A sala da antena só abre com os cabos ligados (servidores).'; } },
    X: { label: 'ESTUFA', color: '#43a047', exit: true, check() { return A.G.s.antenna ? null : 'A porta só destranca com a antena alinhada.'; } }
  },
  objective(G) {
    if (!G.s.radio) return 'Encontra a frequência de emergência no registo da sala de rádio e sintoniza-a.';
    if (!G.s.cables) return 'Liga os cabos no painel da sala dos servidores.';
    if (!G.s.antenna) return 'Alinha a antena: azimute ' + G.s.az + '°, elevação ' + G.s.el + '°.';
    return 'A porta para a Estufa destrancou.';
  },
  build(api) {
    A = api; const { S, G, THREE } = api;
    const freqs = []; while (freqs.length < 6) { const f = (880 + rnd(200)) / 10; if (!freqs.some((g) => Math.abs(g - f) < 1)) freqs.push(f); }
    G.s.freq = freqs[3];
    G.s.az = 45 * (1 + rnd(7)); G.s.el = 15 * (1 + rnd(5)); G.s.a = [0, 0];
    api.addLight(3 * S, 2.5 * S, 0xfff1dc, 1.3, 'r'); api.addLight(9.5 * S, 2.5 * S, 0x9fb8ff, 1.0, 's');
    api.addLight(15 * S, 2.5 * S, 0xdfe8ff, 1.2, 'a'); api.addLight(5 * S, 5.5 * S, 0xdfe8ff, 1.0, 'c'); api.addLight(14 * S, 5.5 * S, 0xdfe8ff, 1.0, 'c', { flicker: true });
    elevatorDoors(1 * S + 0.06, 5.5 * S, Math.PI / 2, 'MONTA-CARGAS');
    [[3, 'RÁDIO'], [9, 'SERVIDORES'], [15, 'ANTENA']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0));
    api.pipe('x', 2.5, 45, 2.7, 5 * S + 0.3, 0.14);
    // sala de rádio
    desk(3.5 * S, 1.45 * S, 2.2, 0.8);
    const rad = api.box(0.7, 0.35, 0.35, api.mat(0x3a3020, { metalness: 0.4 }), 3.5 * S, 0.97, 1.45 * S);
    for (let k = 0; k < 3; k++) api.box(0.08, 0.08, 0.04, 0xd8c8a0, -0.2 + k * 0.2, 0.03, 0.19, false, rad);
    api.interact(rad, () => 'Usar o rádio', () => {
      const msg = '«…Sujeito 12? Aqui Marta. Consegui abrir-te a porta dos servidores. Liga os cabos e depois alinha a antena: azimute ' + G.s.az + '°, elevação ' + G.s.el + '°. Depois sobe para a estufa. Depressa, eles já sabem que estás acordado.»';
      api.openRadio({ freq: G.s.freq, start: G.s.radio ? G.s.freq : 95, message: msg, onWin() { if (!G.s.radio) { G.s.radio = true; api.openDoor('R'); } } });
    });
    desk(1.8 * S, 3.4 * S, 1.2, 0.7);
    const times = ['23:40', '01:05', '02:31', '03:12', '04:50', '05:15'], ops = ['Silva', 'Rocha', 'Vaz', 'Moura', 'Pinto', 'Reis'];
    note(1.8 * S, 0.8, 3.4 * S, 'Ler o registo de comunicações',
      'REGISTO DE COMUNICAÇÕES — NOITE DO INCIDENTE\n\n' + times.map((t, i) => t + '   ' + freqs[i].toFixed(1) + ' MHz   op. ' + api.shuffle(ops.slice())[0]).join('\n') +
      '\n\nA frequência de emergência é a que foi usada à hora exata do incidente.');
    wallBoard('INCIDENTE\n03:12\nNUNCA ESQUECER', 1 * S + 0.03, 1.8, 2.5 * S, Math.PI / 2, 1.4, null, null, '#5a1414', '#ffd0d0');
    // servidores
    api.setServer(9.5 * S, 1.2, 1.5 * S, 's');
    const rackMat = new THREE.MeshStandardMaterial({ map: api.TEX.rack, emissive: 0xffffff, emissiveMap: api.TEX.rack, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.5 });
    [7.6, 8.4, 10.6, 11.4].forEach((c) => api.box(0.75, 2.2, 0.9, rackMat, c * S, 1.1, 3 * S, true));
    api.box(1.2, 0.9, 0.1, api.mat(0x2b3036, { metalness: 0.6 }), 9.5 * S, 1.4, 1 * S + 0.05);
    const pp = api.box(0.9, 0.6, 0.05, api.mat(0x111418), 9.5 * S, 1.4, 1 * S + 0.12);
    api.sign('PAINEL DE CABOS', 9.5 * S, 2.0, 1 * S + 0.11, 0, '#0b1a22', '#7dffcf', 0.9);
    api.interact(pp, () => G.s.cables ? 'Painel de cabos (ligado)' : 'Ligar os cabos', () => {
      if (G.s.cables) return;
      api.openPipes({ n: 6, title: 'PAINEL DE CABOS', text: 'Roda as ligações até o sinal chegar a todos os cabos.', onWin() { G.s.cables = true; api.openDoor('C'); api.toast('Sinal estabelecido. A sala da antena abriu.'); } });
    });
    // antena
    const scr = document.createElement('canvas'); scr.width = 512; scr.height = 160;
    const st = new THREE.CanvasTexture(scr); st.colorSpace = THREE.SRGBColorSpace;
    const AZ = () => G.s.a[0] * 45, EL = () => G.s.a[1] * 15;
    const drawScr = () => {
      const c = scr.getContext('2d'); c.fillStyle = '#061510'; c.fillRect(0, 0, 512, 160);
      c.fillStyle = '#7dffcf'; c.font = 'bold 40px monospace'; c.fillText('AZ ' + String(AZ()).padStart(3, '0') + '°   EL ' + String(EL()).padStart(2, '0') + '°', 20, 64);
      const sig = Math.max(0, 6 - Math.abs(AZ() - G.s.az) / 45 - Math.abs(EL() - G.s.el) / 15);
      c.font = 'bold 30px monospace'; c.fillText('SINAL ' + '▮'.repeat(Math.round(sig)) + '▯'.repeat(6 - Math.round(sig)), 20, 130); st.needsUpdate = true;
    };
    drawScr();
    api.plane(1.6, 0.5, new THREE.MeshBasicMaterial({ map: st }), 15 * S, 2.1, 1 * S + 0.04, 0);
    [['AZIMUTE', 14 * S, 0, 8], ['ELEVAÇÃO', 16 * S, 1, 6]].forEach(([n, x, i, nmax]) => {
      const g = new THREE.Group(); g.position.set(x, 1.25, 1 * S + 0.16); api.scene.add(g);
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24), api.mat(0xc62828, { metalness: 0.5 })); g.add(w);
      for (let k = 0; k < 2; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03), api.mat(0xc62828)); sp.rotation.z = k * Math.PI / 2; g.add(sp); }
      api.sign(n, x, 0.8, 1 * S + 0.03, 0, '#ffd600', '#111111', 0.7);
      api.hitbox(g, 0.6, 0.6, 0.4);
      api.interact(g, () => 'Rodar ' + n.toLowerCase() + ' (' + (i ? EL() : AZ()) + '°)', () => {
        if (G.s.antenna) return;
        G.s.a[i] = (G.s.a[i] + 1) % nmax; w.rotation.z -= Math.PI / 4; api.snd.valve(x, 1 * S); drawScr();
        if (AZ() === G.s.az && EL() === G.s.el) {
          G.s.antenna = true; api.snd.powerOn(); api.toast('Antena alinhada! Uma impressora começou a imprimir.');
          api.fragment(5, 17 * S - 0.25, 1.1, 3 * S, 'A impressora cospe uma única folha, impressa com a tua assinatura:\n\n«Protocolo Ómega aprovado. Sujeitos voluntários: nenhum. Sujeitos disponíveis: todos.»\n\nLembras-te de carregar no botão «aprovar».');
        }
      });
    });
    desk(17 * S, 3 * S, 1.0, 0.7); api.box(0.5, 0.25, 0.4, 0xd8dde2, 17 * S - 0.25, 0.92, 3 * S);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 10, 0, Math.PI * 2, 0, 0.9), api.mat(0xb8bec4, { metalness: 0.6, side: THREE.DoubleSide }));
    dish.position.set(14 * S, 1.8, 3.2 * S); dish.rotation.x = -1.0; api.scene.add(dish);
    api.box(0.15, 1.6, 0.15, 0x3a3f45, 14 * S, 0.8, 3.2 * S, true);
  }
};

// ---------------------------------------------------------------------------
// 6 — HIDROPONIA (estufa vigiada por drones)
// ---------------------------------------------------------------------------
const s6 = {
  title: 'SETOR 6 — HIDROPONIA', subtitle: 'NÍVEL −5', frag: 6,
  intro: 'Uma estufa enorme, iluminada a rosa. Os drones de rega também vigiam.',
  map: [
    '#################',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '#...............#',
    '###D#######H#####',
    '#.....#          ',
    '#.....#          ',
    '#######          '
  ],
  rooms: [['g', 1, 1, 15, 7], ['e', 1, 9, 5, 10]],
  start: [3, 10, 0], ambient: 0.3, fogDensity: 0.05, power: true, creepy: 1.3,
  doors: {
    H: { label: 'ESCOTILHA', color: '#4fc3f7', exit: true, check() { return A.G.s.pump ? null : 'A escotilha só abre com a bomba de rega a funcionar.'; } }
  },
  objective(G) {
    if (!G.inv.uv) return 'Procura na entrada alguma coisa que mostre o que está escondido.';
    if (!G.s.pump) return 'Encontra com a luz UV os números das válvulas A, B e C (nas estantes) e liga a bomba na parede norte. Evita os drones.';
    return 'Desce pela escotilha que abriu na parede sul.';
  },
  update() { const G = A.G; if (!G.s.cp && G.z < 20 && G.z > 17) { G.s.cp = true; A.setCheckpoint(G.x, G.z, G.yaw); } },
  build(api) {
    A = api; const { S, G, THREE } = api;
    G.s.v = [0, 0, 0]; G.s.t = [1 + rnd(4), 1 + rnd(4), 1 + rnd(4)];
    api.addLight(3 * S, 10 * S, 0xfff1dc, 1.2, 'e');
    [8, 20, 32].forEach((x) => api.addLight(x, 4.5 * S, 0xff5ad2, 1.0, 'g'));
    // entrada
    api.crate(4.6 * S, 9.4 * S); api.addItem('uv', 4.6 * S, 0.95, 9.4 * S);
    note(1.8 * S, 0.01, 10.2 * S, 'Ler o aviso da entrada',
      'ESTUFA — AVISO AOS TÉCNICOS\n\nOs drones de rega patrulham os corredores entre as estantes. A luz deles vê tudo à frente. As estantes altas tapam-te.\n\n' +
      'Válvulas da bomba (parede norte): A, B e C. As posições certas estão marcadas nas estantes com tinta UV.\n\nA bomba abre a escotilha de serviço.');
    elevatorDoors(3 * S, 11 * S - 0.06, Math.PI, 'ESCADA');
    // estantes de cultivo (altas: tapam a visão dos drones)
    const frame = api.mat(0x3a3f45, { metalness: 0.6 }), leaf = api.mat(0x3f8f3a, { emissive: 0x0d2a0a });
    const grow = new THREE.MeshBasicMaterial({ color: 0xff7ae0 });
    const racks = [];
    [6.25, 11.25, 16.25].forEach((z) => [[5.5, 17.5], [22.5, 35.5]].forEach(([x0, x1]) => {
      const x = (x0 + x1) / 2, w = x1 - x0;
      api.box(w, 2.2, 0.9, frame, x, 1.1, z, true).visible = false;
      for (let k = 0; k < 3; k++) {
        api.box(w, 0.05, 0.9, frame, x, 0.4 + k * 0.65, z);
        api.box(w - 0.2, 0.22, 0.6, leaf, x, 0.55 + k * 0.65, z);
        api.box(w - 0.4, 0.03, 0.08, grow, x, 0.95 + k * 0.65, z);
      }
      [x0, x1].forEach((xx) => api.box(0.08, 2.2, 0.9, frame, xx, 1.1, z));
      racks.push([x, z, w]);
    }));
    // marcas UV com as posições das válvulas
    const spots = api.shuffle([[8, 6.25 + 0.47, 0], [14, 6.25 - 0.47, Math.PI], [26, 11.25 + 0.47, 0], [32, 11.25 - 0.47, Math.PI], [10, 16.25 - 0.47, Math.PI], [30, 16.25 + 0.47, 0], [15, 11.25 + 0.47, 0], [25, 6.25 - 0.47, Math.PI]]);
    ['A', 'B', 'C'].forEach((n, i) => api.uvMark(n + ' · ' + G.s.t[i], spots[i][0], 1.5, spots[i][1], spots[i][2], 0.9));
    // bomba e válvulas na parede norte
    const pump = api.box(2.6, 1.2, 0.5, api.mat(0x2b3036, { metalness: 0.7 }), 8 * S, 0.6, 1 * S + 0.3, true);
    void pump;
    api.sign('BOMBA DE REGA', 8 * S, 2.3, 1 * S + 0.03, 0, '#0b1a22', '#4fc3f7', 1.1);
    ['A', 'B', 'C'].forEach((n, i) => {
      const x = (7.2 + i * 0.8) * S;
      const g = new THREE.Group(); g.position.set(x, 1.6, 1 * S + 0.18); api.scene.add(g);
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 24), api.mat(0x1e88e5, { metalness: 0.5 })); g.add(w);
      for (let k = 0; k < 2; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.03), api.mat(0x1e88e5)); sp.rotation.z = k * Math.PI / 2; g.add(sp); }
      api.sign('VÁLVULA ' + n, x, 2.0, 1 * S + 0.03, 0, '#ffd600', '#111111', 0.6);
      api.hitbox(g, 0.5, 0.5, 0.4);
      api.interact(g, () => 'Válvula ' + n + ' (posição ' + G.s.v[i] + ')', () => {
        if (G.s.pump) return;
        G.s.v[i] = (G.s.v[i] + 1) % 5; w.rotation.z -= Math.PI / 5; api.snd.valve(x, 1 * S);
        if (G.s.v.join() === G.s.t.join()) {
          G.s.pump = true; api.snd.flow(); api.toast('A bomba arrancou. Ouves a escotilha a abrir.');
          setTimeout(() => api.openDoor('H'), 2200);
        }
      });
    });
    api.crate(15.4 * S, 4.5 * S); api.fragment(6, 15.4 * S, 0.95, 4.5 * S, 'Uma etiqueta de semente, num tabuleiro só teu:\n\n«Linha Ω-12. Cultura de memória. Doador: T. Reis.»\n\nForam as tuas memórias que fizeram crescer tudo isto.');
    // drones de rega
    api.addDrone([[38, 8.75], [4, 8.75]], 1.4);
    api.addDrone([[4, 13.75], [38, 13.75]], 1.6);
    api.addDrone([[6, 4], [34, 4]], 1.2);
    api.steamVent(20, 11.25, 'g'); api.steamVent(30, 16.5, 'g');
  }
};

// ---------------------------------------------------------------------------
// 7 — BIBLIOTECA
// ---------------------------------------------------------------------------
const TITLES = ['A Maré', 'O Silêncio', 'O Farol', 'A Cinza', 'O Inverno', 'A Ponte', 'O Relógio', 'A Raiz', 'O Eco', 'A Lâmina', 'O Vidro', 'A Névoa'];
const s7 = {
  title: 'SETOR 7 — BIBLIOTECA', subtitle: 'NÍVEL −5',
  intro: 'Estantes até ao teto. Alguém deixou um poema em cima do atril.',
  map: [
    '#################',
    '#.......#.......#',
    '#.......#.......Y',
    '#.......#.......#',
    '#.......V.......#',
    '#.......#.......#',
    '#.......#########',
    '#.......#        ',
    '#########        '
  ],
  rooms: [['b', 1, 1, 7, 7], ['v', 9, 1, 15, 5]],
  start: [4.5, 7.3, 0], ambient: 0.4, power: true,
  doors: {
    V: { label: 'COFRE', color: '#c9a227', prompt() { return 'Teclado do cofre (4 dígitos)'; }, use(d) { A.openKeypad({ code: A.G.s.code, onOk() { A.openDoor(d); A.toast('O cofre da biblioteca abriu.'); } }); } },
    Y: { label: 'OBSERVAÇÃO', color: '#c0c6cc', lock: 'key', exit: true }
  },
  objective(G) {
    if (!G.doors.find((d) => d.ch === 'V').open) return 'Lê o poema no atril e encontra os quatro livros nas estantes. Cada um esconde um número.';
    if (!G.inv.key) return 'No cofre há uma fotografia rasgada. Recompõe-na.';
    return 'Usa a chave na porta de serviço do cofre.';
  },
  build(api) {
    A = api; const { S, G, THREE } = api;
    const titles = api.shuffle(TITLES.slice()), poem = titles.slice(0, 4), dig = {};
    titles.forEach((t) => { dig[t] = rnd(10); });
    G.s.code = poem.map((t) => dig[t]).join('');
    api.addLight(3 * S, 3 * S, 0xffd9a0, 1.2, 'b'); api.addLight(6 * S, 6 * S, 0xffd9a0, 1.2, 'b', { flicker: true }); api.addLight(12 * S, 3 * S, 0xfff1dc, 1.3, 'v');
    elevatorDoors(4.5 * S, 8 * S - 0.06, Math.PI, 'ESCADA');
    // estantes com lombadas
    const spines = api.canvasTex(512, 128, (c) => {
      let x = 0; while (x < 512) { const w = 10 + Math.random() * 16; c.fillStyle = ['#6b2a2a', '#2a3f6b', '#3d5a2a', '#6b5a2a', '#4a2a5a', '#2a2a2a', '#7a6a50'][Math.floor(Math.random() * 7)]; c.fillRect(x, 10 + Math.random() * 20, w - 1, 118); c.fillStyle = 'rgba(255,220,150,.4)'; c.fillRect(x + 2, 50, w - 5, 3); x += w; }
    });
    spines.wrapS = THREE.RepeatWrapping;
    const wood = api.mat(0x4a3424);
    const slots = [];
    const shelf = (x, z, len, alongX) => {
      const w = alongX ? len : 0.45, d = alongX ? 0.45 : len;
      api.box(w, 2.6, d, wood, x, 1.3, z, true).material = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 });
      for (let k = 0; k < 4; k++) {
        const t = spines.clone(); t.repeat.set(len / 1.6, 1); t.needsUpdate = true;
        const bm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
        api.box(alongX ? len - 0.1 : 0.5, 0.32, alongX ? 0.5 : len - 0.1, bm, x, 0.35 + k * 0.6, z);
        for (let q = 0; q < Math.floor(len / 2); q++) slots.push([x, z, len, alongX, k, q]);
      }
    };
    shelf(4.5 * S, 1 * S + 0.25, 14, true); shelf(1 * S + 0.25, 5 * S, 9, false);
    shelf(3.2 * S, 5.5 * S, 6, false); shelf(5.8 * S, 5.5 * S, 6, false);
    const pickSlots = api.shuffle(slots).slice(0, titles.length);
    titles.forEach((t, i) => {
      const [x, z, len, alongX, k, q] = pickSlots[i];
      const along = -len / 2 + 1 + q * 2 + Math.random() * 0.8;
      const tex = api.textTex(64, 256, ['#8a2a2a', '#2a4f8a', '#4d7a2a', '#8a7a2a', '#5a2a7a'][i % 5], (c) => {
        c.save(); c.translate(40, 240); c.rotate(-Math.PI / 2); c.fillStyle = '#ffe9b0'; c.font = 'bold 26px serif'; c.fillText(t, 0, 0); c.restore();
      });
      const bx = alongX ? x + along : x, bz = alongX ? z : z + along;
      const b = api.box(alongX ? 0.09 : 0.56, 0.34, alongX ? 0.56 : 0.09, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), bx, 0.37 + k * 0.6, bz);
      api.interact(b, () => 'Livro «' + t + '»', () => api.showNote('«' + t + '»\n\nFolheias até ao fim. Na última página, alguém escreveu a lápis:\n\n' + dig[t]));
    });
    // atril com o poema
    api.box(0.6, 1.1, 0.5, wood, 4.5 * S, 0.55, 3.6 * S, true);
    note(4.5 * S, 1.12, 3.6 * S, 'Ler o poema no atril',
      'Para abrir o cofre, ouve a bibliotecária:\n\nPrimeiro chega «' + poem[0] + '»,\nquando tudo cai, «' + poem[1] + '».\nSó «' + poem[2] + '» te mostra o caminho,\ne no fim resta «' + poem[3] + '».\n\n(Cada livro guarda um número na última página.)', 0.2);
    desk(6.5 * S, 7.4 * S, 1.6, 0.7);
    note(6.5 * S, 0.8, 7.4 * S, 'Ler a nota da bibliotecária',
      'Dr. Reis,\n\nescondi a chave da sala de observação na gaveta do cofre, como pediu. A fotografia rasgada mostra qual é a gaveta.\n\n' +
      'Não percebo porque quer esquecer-se de tudo outra vez.\n\n— A bibliotecária');
    // cofre: fotografia rasgada
    desk(12 * S, 3 * S, 2.0, 0.9);
    const ph = api.box(0.3, 0.01, 0.3, api.mat(0xd8d0bc), 12 * S, 0.8, 3 * S);
    const drawer = api.box(0.6, 0.2, 0.5, api.mat(0x3a2a1c), 12 * S + 0.5, 0.55, 3 * S + 0.25);
    api.interact(ph, () => G.inv.key ? 'Fotografia (recomposta)' : 'Recompor a fotografia rasgada', () => {
      if (G.s.photo) return;
      api.openSlide({
        draw(c, s) {
          c.fillStyle = '#e9e4d6'; c.fillRect(0, 0, s, s);
          c.strokeStyle = '#2a4f8a'; c.lineWidth = 3; c.strokeRect(20, 20, s - 40, s - 40);
          c.strokeRect(20, 20, 120, 100); c.strokeRect(160, 20, 120, 160); c.strokeRect(20, 140, 120, 140);
          c.fillStyle = '#2a4f8a'; c.font = 'bold 18px sans-serif'; c.fillText('OBSERVAÇÃO', 172, 60); c.fillText('ARQUIVO', 34, 60); c.fillText('COFRE', 40, 175);
          c.fillStyle = '#b71c1c'; c.font = 'bold 26px sans-serif'; c.fillText('✕ GAVETA', 40, 240);
          c.fillStyle = 'rgba(0,0,0,.25)'; c.font = 'bold 14px sans-serif';
          for (let i = 0; i < 8; i++) c.fillText(String(i + 1), (i % 3) * 100 + 8, Math.floor(i / 3) * 100 + 18);
        },
        onWin() {
          G.s.photo = true; drawer.position.x += 0.4; api.snd.locker(12 * S, 3 * S);
          api.addItem('key', 12 * S + 0.6, 0.86, 3 * S + 0.2);
          note(12 * S - 0.4, 0.8, 3 * S + 0.1, 'Ler o dossier na gaveta', 'DOSSIER — DR. TOMÁS REIS\n\nCriador do Projeto Ómega.\n\nPediu para ser o primeiro sujeito. «Se vou apagar a memória dos outros, tenho de saber o que se sente.»\n\nTeste 1 a Teste 8: o próprio Dr. Reis.', 0);
          api.toast('A gaveta abriu-se sozinha.');
        }
      });
    });
    for (let k = 0; k < 2; k++) api.box(0.5, 1.9, 1.6, api.mat(0x4a525a, { metalness: 0.6 }), 15.6 * S, 0.95, (4.4 + k * 0.8) * S, true);
  }
};

// ---------------------------------------------------------------------------
// 8 — OBSERVAÇÃO (final)
// ---------------------------------------------------------------------------
const s8 = {
  title: 'SETOR 8 — OBSERVAÇÃO', subtitle: 'NÍVEL −6',
  intro: 'A sala de observação está do outro lado destes corredores. A porta pede seis números.',
  map: [
    '#################',
    '#...#...#.......#',
    '#...O...#.##.##.#',
    '#...#.#.....#...#',
    '#####.#.###.#.#.#',
    '    #.#...#...#.#',
    '    #######.###.#',
    '    #...........Z',
    '    #############'
  ],
  rooms: [['a', 1, 1, 3, 3]],
  start: [2, 2, -Math.PI / 2], ambient: 0.35, power: true,
  doors: {
    O: { label: 'ALA DE OBSERVAÇÃO', color: '#ffb070', prompt() { return 'Teclado da ala de observação (6 dígitos)'; }, use(d) { A.openKeypad({ code: A.CH.frags.join(''), onOk() { s8.chase(d); } }); } },
    Z: { label: 'OBSERVAÇÃO', color: '#ffb070', exit: true, check() { return A.G.s.chase ? null : 'Trancada.'; } }
  },
  objective(G) {
    if (!G.s.chase) return 'Introduz as tuas seis memórias, pela ordem, no teclado da porta.';
    return 'ALARME! Atravessa os corredores sem seres visto e chega à sala de observação (sudeste).';
  },
  onExit() { A.playEnding(); },
  chase(d) {
    const G = A.G, S = A.S;
    A.openDoor(d); A.openDoor('Z'); G.s.chase = true; A.snd.sting();
    G.lights.forEach((l) => { l.light.color.set(0xff2a1a); l.panel.material.color.set(0xff2a1a); l.halo.material.color.set(0xff2a1a); G.emergency.push(l); });
    A.setCheckpoint(5.5 * S, 2.5 * S, -Math.PI / 2);
    A.toast('ALARME! A ala vai ser selada.');
    A.startCountdown(120, () => {
      A.toast('A ala foi selada…');
      setTimeout(() => { A.CH.time += G.time; G.time = 0; G.done = true; A.enterSector(7); }, 1500);
    });
  },
  build(api) {
    A = api; const { S, G } = api;
    api.addLight(2 * S, 2 * S, 0xfff1dc, 1.2, 'a');
    [[6, 2], [11.5, 3.5], [10, 7.5], [15.5, 4.5]].forEach(([c, r]) => api.addLight(c * S, r * S, 0xdfe8ff, 1.0, 'c'));
    elevatorDoors(1 * S + 0.06, 2 * S, Math.PI / 2, 'ESCADA');
    desk(2 * S, 3.4 * S, 1.6, 0.7);
    note(2 * S - 0.3, 0.8, 3.4 * S, 'Ler o bilhete da Marta',
      'Tomás (agora sei o teu nome),\n\nas tuas memórias são o código. Seis números, pela ordem em que os recordaste.\n\n' +
      'Do outro lado há drones e o alarme vai disparar. Não pares.\n\n— Marta');
    const t = api.textTex(256, 160, '#061510', (c) => {
      c.fillStyle = '#7dffcf'; c.font = 'bold 18px monospace'; c.fillText('REGISTO DE ACESSO', 12, 30);
      c.font = '15px monospace'; c.fillText('Dr. T. Reis', 12, 70); c.fillText('último acesso:', 12, 96); c.fillText('há 413 dias', 12, 122);
    });
    api.plane(0.7, 0.44, new api.THREE.MeshBasicMaterial({ map: t }), 2 * S + 0.4, 1.1, 3.4 * S - 0.36, Math.PI);
    api.addDrone([[13.75, 18.75], [38.75, 18.75]], 1.7);
    api.addDrone([[18.75, 8.75], [28.75, 8.75], [28.75, 13.75], [28.75, 8.75]], 1.5);
    api.addDrone([[23.75, 3.75], [38.75, 3.75]], 1.6);
    api.box(0.1, 3, S, api.mat(0x2a3036, { metalness: 0.8 }), 17 * S + 0.05, 1.5, 7.5 * S);
    api.glowSprite(17 * S - 0.3, 2.2, 7.5 * S, 0xffb070, 1.4, 0.6);
    api.pipe('x', 12.5, 40, 2.7, 7 * S + 0.6, 0.14);
  }
};

export const SECTORS2 = [s1, s2, s3, s4, s5, s6, s7, s8];
