// Os cinco setores do Capítulo 1 — "Protocolo Ómega".
// Cada setor define: mapa (cada casa = 2,5 m), salas (para o som), portas, início, objetivo e build(api).
// '#' parede · '.' chão · 'D' porta automática · outras letras = portas definidas em `doors`.

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

// ---------------------------------------------------------------------------
// SETOR A — QUARENTENA
// ---------------------------------------------------------------------------
const sectorA = {
  title: 'SETOR A — QUARENTENA', subtitle: 'CAPÍTULO 1 · PROTOCOLO ÓMEGA',
  intro: 'Arrasta à esquerda para andar e à direita para olhar.',
  map: [
    '###################',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '###G#####D#####B###',
    '#.................X',
    '#########D#########',
    '      #.....#      ',
    '      #.....#      ',
    '      #.....#      ',
    '      #######      '
  ],
  rooms: [['q', 1, 1, 5, 3], ['o', 7, 1, 11, 3], ['s', 13, 1, 17, 3], ['l', 7, 7, 11, 9]],
  start: [3.5, 2.5, Math.PI],
  doors: {
    G: { label: 'ACESSO VERDE', color: '#2ecc71', lock: 'green' },
    B: { label: 'ACESSO AZUL', color: '#3b82f6', lock: 'blue' },
    X: { label: 'ELEVADOR', color: '#ef4444', lock: 'red', exit: true, check() { return A.G.power ? null : 'O painel do elevador não tem energia.'; } }
  },
  objective(G) {
    const d = (ch) => G.doors.find((x) => x.ch === ch);
    if (!d('G').open) return G.inv.green ? 'Usa o cartão verde na porta da quarentena.' : 'Encontra uma forma de sair da sala de quarentena.';
    if (!G.inv.blue) return 'Explora o escritório e o laboratório. A sala dos servidores precisa do cartão azul.';
    if (!d('B').open) return 'Abre a sala dos servidores com o cartão azul.';
    if (!G.power) return 'Repõe a energia no quadro de disjuntores.';
    if (!G.inv.red) return 'Com energia, o cacifo eletrónico já abre.';
    return 'Apanha o elevador de serviço ao fundo do corredor.';
  },
  update() {
    const G = A.G;
    if (G.s.serverLight && !G.power) G.s.serverLight.light.intensity = 1.8 * (Math.random() < 0.04 ? 0.2 : 1);
  },
  onPower() {
    const G = A.G;
    G.s.lockerLed.material.color.set(0x33ff88);
    G.s.exitLed.material.color.set(0xff3333);
  },
  build(api) {
    A = api;
    const { THREE, S, WH, G } = api;
    const scn = api.scene;
    const { box, plane, mat, hollowBox, interact, hitbox, textTex, addLight, addItem, fragment, showNote, toast, snd } = api;
    // puzzles sorteados
    const colors = [
      { name: 'vermelho', css: '#e53935', hex: 0xe53935 }, { name: 'azul', css: '#1e88e5', hex: 0x1e88e5 },
      { name: 'verde', css: '#43a047', hex: 0x43a047 }, { name: 'amarelo', css: '#fdd835', hex: 0xfdd835 }
    ];
    const digits = colors.map(() => 1 + rnd(9));
    const order = api.shuffle([0, 1, 2, 3]);
    const odd = Math.random() < 0.5;
    const target = odd ? [true, false, true, false] : [false, true, false, true];
    let breakers;
    do { breakers = [0, 1, 2, 3].map(() => Math.random() < 0.5); } while (breakers.join() === target.join());
    Object.assign(G.s, { code: order.map((i) => digits[i]).join(''), breakers });

    // ----- Quarentena -----
    addLight(3.5 * S, 2.5 * S, 0xdfe8ff, 2.2, 'q');
    box(1.1, 0.45, 2.1, 0x8a96a3, 1.9 * S, 0.3, 1.9 * S, true);
    box(1.0, 0.12, 2.0, 0x8f969c, 1.9 * S, 0.58, 1.9 * S);
    box(0.8, 0.12, 0.4, 0xffffff, 1.9 * S, 0.68, 1.9 * S - 0.75);
    box(1.6, 0.06, 0.8, 0x6d5844, 5.1 * S, 0.76, 1.45 * S, true);
    [[-0.7, -0.33], [0.7, -0.33], [-0.7, 0.33], [0.7, 0.33]].forEach(([a, b]) => box(0.06, 0.74, 0.06, 0x3d3229, 5.1 * S + a, 0.37, 1.45 * S + b));
    const note = box(0.32, 0.01, 0.42, 0xf4efe1, 5.1 * S - 0.2, 0.8, 1.45 * S);
    note.rotation.y = 0.3;
    interact(note, () => 'Ler o diário', () => showNote(
      'DIÁRIO — DIA 12\n\nAcordei outra vez nesta sala. Na pulseira diz "SUJEITO 12". Não me lembro de mais nada.\n\n' +
      'Ouvi alarmes e gritos no corredor, depois silêncio. Selaram o laboratório inteiro.\n\n' +
      'O Dr. Vasco passou por aqui e esqueceu-se do cartão verde no carrinho médico. Com ele consigo abrir a porta.\n\nTenho de sair daqui.'));
    box(0.7, 0.06, 1.0, 0x7f8890, 5.4 * S, 0.9, 3.3 * S, true);
    box(0.7, 0.06, 1.0, 0x7f8890, 5.4 * S, 0.35, 3.3 * S);
    [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]].forEach(([a, b]) => box(0.04, 0.9, 0.04, 0x9aa3ad, 5.4 * S + a, 0.45, 3.3 * S + b));
    box(0.2, 0.25, 0.2, 0xffffff, 5.4 * S + 0.15, 1.05, 3.3 * S - 0.3);
    addItem('green', 5.4 * S - 0.1, 0.95, 3.3 * S + 0.15);
    box(1.6, 1.0, 0.4, 0x5f676f, 3.5 * S, 1.9, 1 * S + 0.2);
    const hz = textTex(128, 128, '#ffd600', (x, w, h) => {
      x.fillStyle = '#111'; x.beginPath(); x.moveTo(w / 2, 14); x.lineTo(w - 12, h - 16); x.lineTo(12, h - 16); x.closePath(); x.fill();
      x.fillStyle = '#ffd600'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.fillText('!', w / 2, h - 30);
    });
    plane(0.6, 0.6, new THREE.MeshLambertMaterial({ map: hz }), 1 * S + 0.02, 1.6, 2.5 * S, Math.PI / 2);

    // ----- Escritório -----
    addLight(9.5 * S, 2.5 * S, 0xfff1dc, 2.0, 'o');
    const cx = 9.5 * S;
    box(2.2, 0.06, 0.9, 0x7a6450, cx, 0.76, 1.55 * S, true);
    box(0.06, 0.74, 0.86, 0x4a3d31, cx - 1.05, 0.37, 1.55 * S); box(0.06, 0.74, 0.86, 0x4a3d31, cx + 1.05, 0.37, 1.55 * S);
    box(0.5, 0.05, 0.5, 0x222831, cx, 0.5, 1.55 * S + 0.8, true); box(0.5, 0.6, 0.06, 0x222831, cx, 0.8, 1.55 * S + 1.05);
    const screen = textTex(256, 160, '#06231a', (x) => {
      x.fillStyle = '#7dffcf'; x.font = 'bold 18px monospace'; x.fillText('LAB-OS v3.1', 12, 26);
      x.font = '15px monospace'; x.fillText('! ENERGIA PRINCIPAL OFF', 12, 60); x.fillText('> 2 emails por ler', 12, 86);
      x.fillText('> toque para abrir', 12, 112);
    });
    box(0.7, 0.45, 0.05, 0x111418, cx, 1.08, 1.55 * S - 0.2);
    const scr = plane(0.64, 0.4, new THREE.MeshBasicMaterial({ map: screen }), cx, 1.08, 1.55 * S - 0.17, 0);
    box(0.08, 0.25, 0.08, 0x111418, cx, 0.9, 1.55 * S - 0.22);
    interact(scr, () => 'Ler os emails no computador', () => showNote(
      'DE: Dra. Inês Moura\nASSUNTO: Cofre do escritório\n\n' +
      'O código do cofre já não está escrito em lado nenhum. Sigam o protocolo de cores do quadro no laboratório: ' +
      'cada cor corresponde ao número no rótulo do frasco da mesma cor. O cartão azul (servidores) fica no cofre.\n\n' +
      '———\n\nDE: Dr. Vasco Teixeira\nASSUNTO: Protocolo Ómega\n\n' +
      'O núcleo Ómega mantém a instalação selada até ordem minha. Ninguém sai. Os sujeitos continuam em observação.', true));
    const safeX = 11.35 * S, safeZ = 1.6 * S;
    hollowBox(0.9, 1.0, 0.8, 0x3a4048, safeX, 0.5, safeZ, '+z');
    const spivot = new THREE.Group(); spivot.position.set(safeX - 0.45, 0.5, safeZ + 0.41); scn.add(spivot);
    const sdoor = box(0.9, 0.96, 0.05, 0x4b535d, 0.45, 0, 0, false, spivot);
    box(0.25, 0.32, 0.02, 0x0f1418, 0.62, 0.15, 0.03, false, spivot);
    box(0.06, 0.2, 0.06, 0xb0b8c0, 0.2, 0, 0.05, false, spivot);
    interact(sdoor, () => G.s.safeOpen ? 'Cofre aberto' : 'Usar o teclado do cofre', () => {
      if (G.s.safeOpen) return;
      api.openKeypad({
        code: G.s.code, onOk() {
          snd.safe(safeX, safeZ); G.s.safeOpen = true;
          api.anim(spivot, 'y', -Math.PI * 0.55);
          addItem('blue', safeX, 0.06, safeZ + 0.05);
          toast('O cofre abriu!');
        }
      });
    });
    box(0.45, 2.1, 2.2, 0x5a4a3c, 7 * S + 0.25, 1.05, 3 * S, true);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 7; k++) {
      if (Math.random() < 0.25) continue;
      box(0.25, 0.32, 0.06 + Math.random() * 0.06, [0x8e3b3b, 0x2f5f8a, 0x4f7a3a, 0xc9a227, 0x6b4c8a][rnd(5)], 7 * S + 0.55, 0.3 + i * 0.5, 3 * S - 0.9 + k * 0.28);
    }

    // ----- Laboratório -----
    addLight(9.5 * S, 8.5 * S, 0xe8fff6, 2.3, 'l');
    const tz = 8.3 * S;
    [8.3 * S, 10.7 * S].forEach((x) => {
      box(2.4, 0.08, 1.0, 0x9aa2a9, x, 0.92, tz, true);
      box(2.3, 0.86, 0.9, mat(0x3c434b, { metalness: 0.4, roughness: 0.55 }), x, 0.44, tz);
      api.hazardBand(2.3, 0.9, x, 0.1, tz);
    });
    colors.forEach((col, i) => {
      const x = 8.3 * S - 0.75 + i * 0.5;
      const flask = new THREE.Group(); flask.position.set(x, 0.96, tz);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.28, 16),
        new THREE.MeshLambertMaterial({ color: col.hex, emissive: col.hex, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }));
      glass.position.y = 0.14; flask.add(glass);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0xdde6ee, transparent: true, opacity: 0.6 }));
      neck.position.y = 0.34; flask.add(neck);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), new THREE.MeshBasicMaterial({
        map: textTex(64, 48, '#ffffff', (c) => { c.fillStyle = '#111'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText(String(digits[i]), 32, 38); })
      }));
      label.position.set(0, 0.12, 0.13); flask.add(label);
      const back = label.clone(); back.position.z = -0.13; back.rotation.y = Math.PI; flask.add(back);
      scn.add(flask);
      hitbox(flask, 0.3, 0.5, 0.3).position.y = 0.2;
      interact(flask, () => 'Examinar o frasco ' + col.name, () => toast('Frasco ' + col.name + '. O rótulo diz: <b>' + digits[i] + '</b>'));
    });
    const board = textTex(512, 256, '#f7f9fb', (x) => {
      x.fillStyle = '#1b2733'; x.font = 'bold 30px sans-serif'; x.fillText('PROTOCOLO DO COFRE', 24, 46);
      x.font = '20px sans-serif'; x.fillStyle = '#516070'; x.fillText('Ler da esquerda para a direita', 24, 76);
      order.forEach((ci, k) => {
        x.fillStyle = colors[ci].css; x.beginPath(); x.arc(80 + k * 115, 150, 38, 0, Math.PI * 2); x.fill();
        x.strokeStyle = '#1b2733'; x.lineWidth = 3; x.stroke();
        if (k < 3) { x.fillStyle = '#1b2733'; x.font = 'bold 34px sans-serif'; x.fillText('→', 128 + k * 115, 162); }
      });
      x.fillStyle = '#7a8896'; x.font = 'italic 18px sans-serif'; x.fillText('cor = n.º do frasco  ·  ΔT = 4,2 K  ·  pH 7?', 24, 226);
    });
    box(3.2, 1.7, 0.06, 0x9aa3ad, 9.5 * S, 1.65, 10 * S - 0.04);
    const wb = plane(3.0, 1.5, new THREE.MeshLambertMaterial({ map: board }), 9.5 * S, 1.65, 10 * S - 0.08, Math.PI);
    interact(wb, () => 'Ver o quadro', () => toast('Quatro cores por ordem: ' + order.map((i) => colors[i].name).join(', ') + '.'));
    const sticky = box(0.22, 0.01, 0.22, 0xffeb7a, 10.7 * S + 0.6, 0.97, tz + 0.1);
    sticky.rotation.y = -0.4;
    interact(sticky, () => 'Ler a nota da manutenção', () => showNote(
      'MANUTENÇÃO\n\nSe a energia falhar, na sala dos servidores ligar APENAS os disjuntores ' +
      (odd ? 'ÍMPARES (1 e 3).' : 'PARES (2 e 4).') + '\n\nOs outros ficam desligados, senão o quadro volta a disparar!\n\n— Rui'));
    box(1.8, 2.2, 0.6, 0x6c757e, 7 * S + 0.9, 1.1, 7 * S + 0.35, true);
    box(1.7, 0.9, 0.04, 0x9fd3ff, 7 * S + 0.9, 1.6, 7 * S + 0.66).material = mat(0x9fd3ff, { transparent: true, opacity: 0.35 });
    box(0.6, 1.8, 0.6, 0x7a838b, 12 * S - 0.35, 0.9, 9.4 * S, true);

    // ----- Servidores -----
    G.s.serverLight = addLight(15.5 * S, 2.5 * S, 0x7fb2ff, 0.6, 's');
    api.setServer(15.5 * S, 1.5, 1.8 * S, 's');
    const rackMat = new THREE.MeshStandardMaterial({ map: api.TEX.rack, emissive: 0xffffff, emissiveMap: api.TEX.rack, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.5 });
    [13.6, 14.3, 16.7, 17.4].forEach((c) => box(0.75, 2.2, 0.9, rackMat, c * S, 1.1, 1 * S + 0.5, true));
    const px = 18 * S - 0.06, pz = 2.5 * S;
    box(0.1, 1.1, 1.8, 0x5d6670, px, 1.5, pz);
    const lbl = textTex(256, 64, '#ffd600', (x) => { x.fillStyle = '#111'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('⚡ DISJUNTORES', 128, 42); });
    plane(1.2, 0.3, new THREE.MeshLambertMaterial({ map: lbl }), px - 0.06, 2.25, pz, -Math.PI / 2);
    const levers = breakers.map((on, i) => {
      const z = pz - 0.6 + i * 0.4;
      const g = new THREE.Group(); g.position.set(px - 0.08, 1.45, z); scn.add(g);
      const handle = box(0.2, 0.06, 0.07, 0xdedede, -0.1, 0, 0, false, g);
      const led = box(0.04, 0.06, 0.06, 0x111111, -0.02, 0.3, 0, false, g);
      led.material = new THREE.MeshBasicMaterial({ color: 0x330000 });
      const num = textTex(64, 64, '#5d6670', (x) => { x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText(String(i + 1), 32, 46); });
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: num }));
      n.position.set(-0.01, -0.28, 0); n.rotation.y = -Math.PI / 2; g.add(n);
      hitbox(g, 0.3, 0.5, 0.3).position.x = -0.12;
      const lever = { g, handle, led, i };
      interact(g, () => 'Disjuntor ' + (i + 1) + (G.s.breakers[i] ? ' (ligado)' : ' (desligado)'), () => {
        if (G.power) { toast('A energia já está ligada.'); return; }
        G.s.breakers[i] = !G.s.breakers[i]; snd.breaker(px, pz, G.s.breakers[i]); upd(lever);
        if (G.s.breakers.join() === target.join()) api.powerOn();
      });
      return lever;
    });
    function upd(l) { const on = G.s.breakers[l.i]; l.handle.rotation.z = on ? 0.7 : -0.7; l.led.material.color.set(on ? 0x33ff88 : 0x551111); }
    levers.forEach(upd);
    const lx = 13 * S + 0.35, lz = 3 * S;
    hollowBox(0.7, 2.0, 0.9, 0x6f7b88, lx, 1.0, lz, '+x');
    box(0.62, 0.03, 0.82, 0x6f7b88, lx, 0.95, lz);
    const lpivot = new THREE.Group(); lpivot.position.set(lx + 0.36, 1.0, lz - 0.45); scn.add(lpivot);
    const ldoor = box(0.04, 1.96, 0.9, 0x7f8c99, 0, 0, 0.45, false, lpivot);
    for (let i = 0; i < 5; i++) box(0.02, 0.03, 0.5, 0x4a545e, 0.03, 0.6 + i * 0.07, 0.45, false, lpivot);
    G.s.lockerLed = box(0.02, 0.08, 0.08, 0x111111, 0.03, 0.1, 0.8, false, lpivot);
    G.s.lockerLed.material = new THREE.MeshBasicMaterial({ color: 0x441111 });
    interact(ldoor, () => G.s.lockerOpen ? 'Cacifo aberto' : 'Abrir o cacifo eletrónico', () => {
      if (G.s.lockerOpen) return;
      if (!G.power) { snd.deny(lx, lz); toast('O cacifo eletrónico não tem energia.'); return; }
      G.s.lockerOpen = true; snd.locker(lx, lz);
      api.anim(lpivot, 'y', Math.PI * 0.6);
      addItem('red', lx, 0.92, lz);
      fragment(1, lx, 0.1, lz, 'Um bilhete escrito à mão, agrafado ao documento:\n\n«Se estás a ler isto, Sujeito 12, ainda és tu. O núcleo Ómega mantém o LAB-7 selado. ' +
        'Espalhei o código de desativação pelos setores, um dígito em cada um. Desce até ao núcleo. E não confies nos altifalantes.»\n\n— I. M.');
      toast('O cacifo abriu. Há um cartão e um documento lá dentro!');
    });

    // ----- Corredor -----
    [3, 9, 15].forEach((c) => addLight(c * S, 5.5 * S, 0xff2a1a, 1.6, 'c', { emerg: true }));
    api.sign('ELEVADOR ➜', 17.5 * S, 2.6, 5 * S + 0.03, 0, '#0c7a3e', '#ffffff', 1.0);
    // interior do elevador para lá da porta
    box(0.1, WH, S, mat(0x2a3036, { metalness: 0.8, roughness: 0.3 }), 19 * S - 0.05, WH / 2, 5.5 * S);
    api.glowSprite(19 * S - 0.4, WH - 0.3, 5.5 * S, 0xfff1dc, 1.2, 0.5);
    G.s.exitLed = box(0.05, 0.2, 0.3, new THREE.MeshBasicMaterial({ color: 0x222222 }), 18.5 * S - 0.14, 2.75, 5.5 * S);
    api.crate(1.5 * S, 5.25 * S); api.crate(1.5 * S + 0.1, 5.25 * S, 0.7, 0.4, 0.9);
    [[3, 'QUARENTENA'], [9, 'ESCRITÓRIO'], [15, 'SERVIDORES']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0));
    api.sign('LABORATÓRIO', 10 * S + 0.4, 2.2, 6 * S - 0.02, Math.PI);

    // ----- Pormenores -----
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.1), new THREE.MeshStandardMaterial({ map: api.TEX.asphalt.map.clone(), normalMap: api.TEX.asphalt.normalMap, roughness: 0.9 }));
    walk.material.map.repeat.set(30, 1); walk.material.map.needsUpdate = true;
    walk.rotation.x = -Math.PI / 2; walk.position.set(25, 0.004, 5.5 * S); scn.add(walk);
    [-0.58, 0.58].forEach((dz) => {
      const t = api.TEX.hazard.clone(); t.repeat.set(160, 1); t.needsUpdate = true;
      const st = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.07), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
      st.rotation.x = -Math.PI / 2; st.position.set(25, 0.006, 5.5 * S + dz); scn.add(st);
    });
    api.pipe('x', 2.5, 45, 2.62, 5 * S + 0.35, 0.16);
    api.pipe('x', 2.5, 45, 2.8, 5 * S + 0.85, 0.09);
    api.pipe('x', 2.5, 47.5, 2.58, 6 * S - 0.4, 0.22);
    api.pipe('x', 2.5, 15, 2.75, 1 * S + 0.3, 0.12);
    api.pipe('x', 17.5, 30, 2.7, 1 * S + 0.3, 0.14);
    api.pipe('x', 17.5, 30, 2.7, 10 * S - 0.35, 0.16);
    api.pipe('z', 2.5, 10, 2.72, 18 * S - 0.3, 0.13);
    [6 * S, 12 * S].forEach((x) => {
      box(0.5, WH, 0.3, mat(0x3a3f45, { metalness: 0.5, roughness: 0.6 }), x, WH / 2, 5 * S + 0.15, true);
      box(0.5, WH, 0.3, mat(0x3a3f45, { metalness: 0.5, roughness: 0.6 }), x, WH / 2, 6 * S - 0.15, true);
      api.hazardBand(0.5, 0.3, x, 0.1, 5 * S + 0.15); api.hazardBand(0.5, 0.3, x, 0.1, 6 * S - 0.15);
    });
    api.tank(16.6 * S, 6 * S - 0.45, 0xff6a1a, 1.9, 0.32, 2.2);
    api.tank(17.15 * S, 6 * S - 0.45, 0xff7a22, 1.9, 0.32, 0);
    api.tank(7 * S + 0.6, 8.7 * S, 0x4dff6a, 2.3, 0.42, 2.6);
    api.tank(7 * S + 0.6, 9.55 * S, 0x56ff74, 2.3, 0.42, 0);
    api.tank(1 * S + 0.5, 3.7 * S, 0x48ff8a, 1.7, 0.3, 1.2);
    api.barrel(2.2 * S, 6 * S - 0.4, 0.3); api.barrel(2.5 * S, 6 * S - 0.35, 2.1);
    api.barrel(17.6 * S, 5 * S + 0.4, 1.2); api.barrel(17.6 * S, 3.8 * S, 0.7);
    api.barrel(7 * S + 0.4, 3.75 * S, 2.6); api.barrel(11.6 * S, 9.6 * S, 1.6);
  }
};
let A = null; // api do setor ativo (para callbacks que não recebem argumentos)

// ---------------------------------------------------------------------------
// SETOR B — ARQUIVO
// ---------------------------------------------------------------------------
const sectorB = {
  title: 'SETOR B — ARQUIVO', subtitle: 'NÍVEL −2',
  intro: 'O elevador de serviço só desceu até aqui. Procura outra forma de continuar.',
  map: [
    '#######################',
    '#.....#.......#.......#',
    '#.....#.......#.......#',
    '#.....#.......#.......#',
    '###D#####D#######D#####',
    '#.....................X',
    '###D#######P###########',
    '#.....#  #.......#     ',
    '#.....#  #.......#     ',
    '#.....#  #.......#     ',
    '#######  #########     '
  ],
  rooms: [['a1', 1, 1, 5, 3], ['a2', 7, 1, 13, 3], ['k', 15, 1, 21, 3], ['e', 1, 7, 5, 9], ['cr', 10, 7, 16, 9]],
  start: [3.5, 8.6, 0], power: true, ambient: 0.45,
  doors: {
    P: { label: 'CRIOGENIA', color: '#4fc3f7', check() { const G = A.G; return G.s.pressure === G.s.target ? null : 'Porta selada. Pressão necessária: <b>' + G.s.target + ' bar</b> (atual: ' + G.s.pressure + ' bar).'; } },
    X: {
      label: 'CARGA', color: '#f5a623', exit: true,
      prompt() { return 'Elevador de carga'; },
      check() { const G = A.G; if (!G.s.fuseIn) return 'O elevador de carga não tem fusível.'; if (!G.s.auth) return 'Falta autorizar o elevador no terminal da sala de controlo.'; return null; }
    }
  },
  objective(G) {
    const need = [];
    if (!G.s.fuseIn) need.push(G.inv.fuse ? 'instalar o fusível no painel do elevador' : 'encontrar um fusível');
    if (!G.s.auth) need.push('autorizar o elevador no terminal de controlo');
    if (need.length) return 'Elevador de carga: ' + need.join(' e ') + '.' + (!G.inv.fuse && !G.s.fuseIn ? ' A criogenia abre com a pressão certa.' : '');
    return 'Entra no elevador de carga ao fundo do corredor.';
  },
  build(api) {
    A = api;
    const { THREE, S, WH, G } = api;
    const scn = api.scene;
    const { box, plane, mat, interact, textTex, canvasTex, addLight, addItem, fragment, showNote, toast, snd } = api;
    // ----- lógica: quem pode autorizar o elevador -----
    const pool = ['Ana Ramos', 'Bruno Costa', 'Carla Neves', 'Diogo Pires', 'Eva Lopes', 'Filipe Matos', 'Gil Santos', 'Helena Rocha'];
    const staff = api.shuffle(pool.slice()).slice(0, 5);
    const night = [staff[0], staff[1]], suspended = [staff[1], staff[3]], answer = staff[0];
    G.s.answer = answer;
    G.s.target = 5 + rnd(15); G.s.pressure = 0; G.s.valves = [0, 0, 0];

    // ----- chegada -----
    addLight(3.5 * S, 8.5 * S, 0xdfe8ff, 1.8, 'e');
    box(2.2, 2.6, 0.08, mat(0x5b636c, { metalness: 0.8, roughness: 0.35 }), 3.5 * S, 1.3, 10 * S - 0.05);
    box(0.04, 2.6, 0.1, 0x111111, 3.5 * S, 1.3, 10 * S - 0.1);
    api.sign('ELEVADOR DE SERVIÇO · AVARIADO', 3.5 * S, 2.75, 10 * S - 0.1, Math.PI, '#5a1414', '#ffd0d0', 1.6);
    api.crate(5.2 * S, 7.5 * S); api.crate(5.2 * S, 8.2 * S, 0.7); api.barrel(1.4 * S, 7.4 * S, 0.5);
    const n0 = box(0.3, 0.01, 0.4, 0xf4efe1, 5.2 * S, 0.91, 7.5 * S); n0.rotation.y = 0.5;
    interact(n0, () => 'Ler a nota', () => showNote(
      'Nota presa a um caixote:\n\n«O elevador de serviço avariou neste piso. Para desceres à Genética usa o elevador de CARGA, ao fundo do corredor.\n\n' +
      'Precisa de duas coisas: um fusível novo (a manutenção guardava-os na criogenia) e a autorização de um funcionário no terminal da sala de controlo.\n\n' +
      'Os registos do pessoal estão nos arquivos.»\n\n— I. M.'));

    // ----- arquivos -----
    const shelf = (x, z, w, rotY) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0; scn.add(g);
      const metal = mat(0x4a525a, { metalness: 0.6, roughness: 0.5 });
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.5), metal); b.position.y = 0.2 + k * 0.6; g.add(b); }
      [-w / 2, w / 2].forEach((dx) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.5), metal); p.position.set(dx, 1.05, 0); g.add(p); });
      for (let k = 0; k < 3; k++) for (let i = 0; i < Math.floor(w / 0.38); i++) {
        if (Math.random() < 0.2) continue;
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.4), mat([0xb79a6a, 0xa88a5c, 0x8c7a5a][rnd(3)]));
        f.position.set(-w / 2 + 0.22 + i * 0.38, 0.38 + k * 0.6, 0); g.add(f);
      }
      const hw = rotY ? 0.25 : w / 2, hd = rotY ? w / 2 : 0.25;
      G.colliders.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd });
    };
    addLight(3.5 * S, 2.5 * S, 0xfff1dc, 1.6, 'a1');
    shelf(3.5 * S, 1 * S + 0.35, 3.6); shelf(2.5 * S, 2.6 * S, 2.4, Math.PI / 2); shelf(4.5 * S, 2.6 * S, 2.4, Math.PI / 2);
    const desk = (x, z) => { box(1.4, 0.06, 0.7, 0x6d5844, x, 0.76, z, true); box(1.3, 0.72, 0.6, 0x4a3d31, x, 0.37, z); };
    desk(5.3 * S, 3.4 * S);
    const turns = api.shuffle(staff.slice());
    const d1 = box(0.3, 0.01, 0.4, 0xf4efe1, 5.3 * S, 0.8, 3.4 * S); d1.rotation.y = -0.3;
    interact(d1, () => 'Ler a escala de turnos', () => showNote(
      'ESCALA DE TURNOS — SEMANA 41\n\n' + turns.map((n) => n.padEnd(15, ' ') + (night.includes(n) ? 'NOITE' : 'DIA')).join('\n')));
    const d1b = box(0.3, 0.01, 0.4, 0xe8e2d0, 1.6 * S, 0.81, 3.6 * S);
    box(0.7, 0.8, 0.5, 0x3a3f45, 1.6 * S, 0.4, 3.6 * S, true);
    interact(d1b, () => 'Ler o relatório do incidente', () => showNote(
      'RELATÓRIO DO INCIDENTE — CONFIDENCIAL\n\nÀs 03:12 o núcleo Ómega entrou em modo de contenção. Todas as saídas foram seladas.\n\n' +
      'Três sujeitos fora das cápsulas. O Sujeito 12 foi visto no setor A.\n\nO Dr. Vasco proibiu a evacuação: «a observação continua».'));
    addLight(10.5 * S, 2.5 * S, 0xfff1dc, 1.6, 'a2');
    shelf(9 * S, 1 * S + 0.35, 3.6); shelf(12 * S, 1 * S + 0.35, 3.6); shelf(10.5 * S, 2.8 * S, 4.4);
    desk(12.6 * S, 3.5 * S);
    const d2 = box(0.3, 0.01, 0.4, 0xf4efe1, 12.6 * S, 0.8, 3.5 * S); d2.rotation.y = 0.2;
    interact(d2, () => 'Ler a lista de suspensões', () => showNote(
      'RECURSOS HUMANOS — CREDENCIAIS SUSPENSAS\n\nApós o incidente, as credenciais seguintes foram revogadas e não são aceites por nenhum terminal:\n\n' +
      api.shuffle(suspended.slice()).map((n) => '• ' + n).join('\n')));
    const cork = textTex(256, 192, '#8a6a44', (x) => {
      x.fillStyle = '#f4efe1'; x.fillRect(30, 24, 120, 150); x.fillStyle = '#ffeb7a'; x.fillRect(165, 40, 70, 70);
      x.fillStyle = '#c62828'; x.beginPath(); x.arc(90, 30, 6, 0, 7); x.fill();
      x.fillStyle = '#333'; for (let i = 0; i < 8; i++) x.fillRect(40, 50 + i * 14, 90 - (i % 3) * 15, 4);
    });
    const board = plane(1.4, 1.05, new THREE.MeshLambertMaterial({ map: cork }), 7 * S + 0.03, 1.6, 2.5 * S, Math.PI / 2);
    interact(board, () => 'Ler o memorando', () => showNote(
      'MEMORANDO DE SEGURANÇA\n\nO elevador de carga só pode ser autorizado por funcionários do turno da NOITE.\n\n' +
      'Credenciais suspensas não são aceites. Qualquer tentativa inválida bloqueia o terminal durante alguns segundos.'));

    // ----- sala de controlo: terminal e válvulas -----
    addLight(18.5 * S, 2.5 * S, 0xdfe8ff, 1.8, 'k');
    api.setServer(16 * S, 1.2, 1.4 * S, 'k');
    box(2.2, 0.06, 0.8, 0x3a4048, 16.4 * S, 0.76, 1.45 * S, true); box(2.1, 0.72, 0.7, 0x2b3036, 16.4 * S, 0.37, 1.45 * S);
    const tscr = textTex(256, 160, '#061510', (x) => {
      x.fillStyle = '#7dffcf'; x.font = 'bold 18px monospace'; x.fillText('CARGA-CTRL', 12, 28);
      x.font = '15px monospace'; x.fillText('Elevador: BLOQUEADO', 12, 64); x.fillText('> requer autorização', 12, 92); x.fillText('> toque para entrar', 12, 120);
    });
    box(0.7, 0.45, 0.05, 0x111418, 16.4 * S, 1.08, 1.45 * S - 0.2);
    const term = plane(0.64, 0.4, new THREE.MeshBasicMaterial({ map: tscr }), 16.4 * S, 1.08, 1.45 * S - 0.17, 0);
    interact(term, () => G.s.auth ? 'Terminal (autorizado)' : 'Usar o terminal de autorização', () => {
      if (G.s.auth) { toast('O elevador de carga já está autorizado.'); return; }
      const opts = api.shuffle(staff.slice());
      api.openTerminal({
        title: 'AUTORIZAÇÃO — ELEVADOR DE CARGA', text: 'Selecione o funcionário que autoriza a descida:', options: opts,
        onPick(i) {
          const n = opts[i];
          if (n === answer) { G.s.auth = true; return { ok: true, msg: 'AUTORIZADO: ' + n + '. Elevador de carga desbloqueado.' }; }
          return { ok: false, msg: 'ACESSO NEGADO — ' + (suspended.includes(n) ? 'credencial suspensa.' : 'funcionário do turno de dia.') + ' Terminal bloqueado 6 s.' };
        }
      });
    });
    // válvulas na parede este: cada volta soma o valor da etiqueta; a 4.ª volta fecha-a
    const gaugeCv = document.createElement('canvas'); gaugeCv.width = 512; gaugeCv.height = 160;
    const gaugeTex = new THREE.CanvasTexture(gaugeCv); gaugeTex.colorSpace = THREE.SRGBColorSpace;
    const drawGauge = () => {
      const x = gaugeCv.getContext('2d');
      x.fillStyle = '#0b1210'; x.fillRect(0, 0, 512, 160);
      x.fillStyle = '#7dffcf'; x.font = 'bold 34px monospace'; x.fillText('PRESSÃO DA LINHA', 24, 52);
      x.font = 'bold 64px monospace'; x.fillStyle = G.s.pressure === G.s.target ? '#7dffcf' : '#ffb02e';
      x.fillText(String(G.s.pressure).padStart(2, '0') + ' bar', 24, 130);
      gaugeTex.needsUpdate = true;
    };
    drawGauge();
    plane(1.5, 0.47, new THREE.MeshBasicMaterial({ map: gaugeTex }), 22 * S - 0.06, 2.35, 2.5 * S, -Math.PI / 2);
    const weights = [1, 2, 4];
    weights.forEach((w, i) => {
      const z = 1.8 * S + i * 0.7 * S;
      const g = new THREE.Group(); g.position.set(22 * S - 0.18, 1.3, z); scn.add(g);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24), mat(0xc62828, { metalness: 0.5 }));
      wheel.rotation.y = Math.PI / 2; g.add(wheel);
      for (let k = 0; k < 2; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), mat(0xc62828)); sp.rotation.x = k * Math.PI / 2; g.add(sp); }
      box(0.3, 0.08, 0.08, mat(0x3a3f45, { metalness: 0.7 }), 0.12, 0, 0, false, g);
      api.pipe('z', z - 0.01, z + 0.01, 2.0, 22 * S - 0.25, 0.06);
      box(0.1, 0.7, 0.1, mat(0x3a3f45, { metalness: 0.7 }), 22 * S - 0.1, 1.75, z);
      const tag = textTex(128, 96, '#ffd600', (x) => { x.fillStyle = '#111'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.fillText('×' + w, 64, 62); x.font = 'bold 20px sans-serif'; x.fillText('bar / volta', 64, 88); });
      plane(0.42, 0.32, new THREE.MeshBasicMaterial({ map: tag }), 22 * S - 0.05, 0.85, z, -Math.PI / 2);
      api.hitbox(g, 0.4, 0.6, 0.6);
      interact(g, () => 'Rodar a válvula ×' + w + ' (posição ' + G.s.valves[i] + '/3)', () => {
        G.s.valves[i] = (G.s.valves[i] + 1) % 4;
        G.s.pressure = G.s.valves.reduce((s, v, k) => s + v * weights[k], 0);
        wheel.rotation.x += Math.PI / 2; snd.valve(g.position.x, z); drawGauge();
        if (G.s.pressure === G.s.target) toast('A pressão estabilizou nos <b>' + G.s.target + ' bar</b>. Ouves a criogenia a destrancar.');
      });
    });
    const vn = box(0.25, 0.01, 0.25, 0xffeb7a, 20.5 * S, 0.81, 1.45 * S);
    box(1.2, 0.06, 0.6, 0x3a4048, 20.5 * S, 0.76, 1.45 * S, true);
    interact(vn, () => 'Ler o post-it', () => showNote('Cada volta numa válvula soma à pressão o valor da etiqueta.\nA quarta volta fecha-a outra vez.\n\nA pressão que a criogenia pede está escrita junto à porta.'));

    // ----- corredor -----
    addLight(3.5 * S, 5.5 * S, 0xdfe8ff, 1.4, 'c');
    addLight(10 * S, 5.5 * S, 0xdfe8ff, 1.4, 'c', { flicker: true });
    addLight(17 * S, 5.5 * S, 0xdfe8ff, 1.4, 'c');
    api.pipe('x', 2.5, 55, 2.65, 5 * S + 0.3, 0.15); api.pipe('x', 2.5, 55, 2.7, 6 * S - 0.35, 0.2);
    const tgt = textTex(512, 128, '#0b1a22', (x) => {
      x.fillStyle = '#4fc3f7'; x.font = 'bold 34px sans-serif'; x.fillText('CRIOGENIA', 20, 48);
      x.fillStyle = '#ffffff'; x.font = '30px sans-serif'; x.fillText('Pressão necessária: ' + G.s.target + ' bar', 20, 100);
    });
    plane(1.6, 0.4, new THREE.MeshBasicMaterial({ map: tgt }), 12.2 * S + 0.6, 2.0, 6 * S - 0.03, Math.PI);
    [[3, 'ARQUIVO 1'], [9, 'ARQUIVO 2'], [17, 'CONTROLO']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0));
    api.barrel(7 * S, 6 * S - 0.4, 1); api.barrel(14.5 * S, 5 * S + 0.4, 2); api.crate(20 * S, 6 * S - 0.5);
    // painel do fusível do elevador
    box(0.6, 0.8, 0.12, mat(0x3a4048, { metalness: 0.6 }), 21.3 * S, 1.4, 5 * S + 0.06);
    const fled = box(0.08, 0.08, 0.05, new THREE.MeshBasicMaterial({ color: 0x661111 }), 21.3 * S, 1.7, 5 * S + 0.14);
    const fslot = box(0.3, 0.12, 0.06, 0x111418, 21.3 * S, 1.35, 5 * S + 0.14);
    interact(fslot, () => G.s.fuseIn ? 'Fusível instalado' : (G.inv.fuse ? 'Instalar o fusível' : 'Painel do elevador (falta o fusível)'), () => {
      if (G.s.fuseIn) return;
      if (!G.inv.fuse) { snd.deny(); toast('O painel do elevador está sem fusível.'); return; }
      G.inv.fuse = false; G.s.fuseIn = true; api.renderInv(); snd.breaker(21.3 * S, 5 * S, true);
      fled.material.color.set(0x33ff88); toast('Fusível instalado. O painel do elevador acendeu.');
    });
    box(0.1, WH, S, mat(0x2a3036, { metalness: 0.8, roughness: 0.3 }), 23 * S - 0.05, WH / 2, 5.5 * S);
    api.glowSprite(23 * S - 0.4, WH - 0.3, 5.5 * S, 0xffd27a, 1.2, 0.5);

    // ----- criogenia -----
    addLight(13 * S, 8.5 * S, 0x9fd8ff, 1.6, 'cr');
    const pods = [['08', 0x7fd6ff], ['09', 0x7fd6ff], ['10', 0x6fd0ff], ['11', 0x7fd6ff], ['12', 0x0b1820]];
    pods.forEach(([n, col], i) => {
      const x = 11 * S + i * 1.15 * S, z = 10 * S - 0.6;
      api.tank(x, z, col, 2.2, 0.42, i === 2 ? 1.8 : 0);
      api.sign('SUJEITO ' + n, x, 2.75, z - 0.6, 0, n === '12' ? '#5a1414' : '#0b1a22', n === '12' ? '#ff8a8a' : '#9fd8ff', 0.9);
      if (n === '12') {
        const hb = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
        hb.position.set(x, 1.1, z - 0.4); scn.add(hb);
        interact(hb, () => 'Examinar a cápsula 12', () => showNote('A cápsula está vazia e ainda húmida por dentro.\n\nA etiqueta tem o teu número.\n\nNo vidro, alguém riscou sete traços por dentro.'));
      }
    });
    box(0.7, 0.06, 1.0, 0x7f8890, 10.6 * S, 0.9, 7.6 * S, true); box(0.7, 0.06, 1.0, 0x7f8890, 10.6 * S, 0.35, 7.6 * S);
    [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]].forEach(([a, b]) => box(0.04, 0.9, 0.04, 0x9aa3ad, 10.6 * S + a, 0.45, 7.6 * S + b));
    addItem('fuse', 10.6 * S, 0.97, 7.6 * S);
    box(1.4, 0.06, 0.7, 0x3a4048, 16 * S, 0.76, 7.6 * S, true); box(1.3, 0.72, 0.6, 0x2b3036, 16 * S, 0.37, 7.6 * S);
    fragment(2, 16 * S, 0.82, 7.6 * S, 'Registo criogénico, assinado pelo Dr. Vasco:\n\n«Sujeito 12 retirado da cápsula para o Teste 7. Memória limpa com sucesso.\n\n' +
      'A Dra. Moura anda a fazer perguntas a mais. Vigiar.»');
    api.steamVent(14 * S, 8 * S, 'cr');
  }
};

// ---------------------------------------------------------------------------
// SETOR C — GENÉTICA
// ---------------------------------------------------------------------------
const sectorC = {
  title: 'SETOR C — GENÉTICA', subtitle: 'NÍVEL −4',
  intro: 'A energia aqui está a falhar. Mantém a lanterna apontada.',
  map: [
    '###################',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '#.....#.....#.....#',
    '###D#####S#####K###',
    '#.................#',
    '#.................#',
    '#########H#########'
  ],
  rooms: [['inc', 1, 1, 5, 3], ['gen', 7, 1, 11, 3], ['cof', 13, 1, 17, 3]],
  start: [1.6, 6, -Math.PI / 2], power: false, ambient: 0.38, fogDensity: 0.06, creepy: 2.5, flash: 10, wallTint: 0xc8d0c0,
  doors: {
    S: { label: 'GENÉTICA', color: '#e53935', check() { return A.G.s.simon ? null : 'Porta selada. Usa o painel de segurança ao lado da porta.'; } },
    K: {
      label: 'AMOSTRAS', color: '#8a5cff',
      prompt() { return 'Usar o teclado do cofre de amostras'; },
      use(d) { A.openKeypad({ code: A.G.s.code, onOk() { A.openDoor(d); A.toast('Código aceite.'); } }); }
    },
    H: { label: 'VENTILAÇÃO', color: '#c0c6cc', lock: 'key', exit: true, prompt() { return A.G.inv.key ? 'Abrir a escotilha com a chave' : 'Escotilha de ventilação (trancada)'; } }
  },
  objective(G) {
    if (!G.s.simon) return 'Desbloqueia a porta da Genética no painel de segurança.';
    if (!G.inv.uv) return 'Procura no laboratório de Genética alguma coisa útil.';
    if (!G.doors.find((d) => d.ch === 'K').open) return 'Usa a lâmpada UV (botão UV) para encontrares o código do cofre de amostras: I, II, III, IV.';
    if (!G.inv.key) return 'Procura no cofre de amostras uma forma de sair do setor.';
    return 'Abre a escotilha de ventilação no corredor e desce.';
  },
  update(dt) {
    const G = A.G;
    if (G.s.blackout > 0) {
      G.s.blackout -= dt;
      G.lights.forEach((l) => { l.light.intensity = 0; l.halo.material.opacity = 0; });
    }
  },
  build(api) {
    A = api;
    const { THREE, S, G } = api;
    const scn = api.scene;
    const { box, plane, mat, interact, textTex, addLight, addItem, fragment, showNote, toast, snd } = api;
    const digits = [0, 1, 2, 3].map(() => rnd(10));
    G.s.code = digits.join('');

    // ----- corredor -----
    addLight(4 * S, 5.5 * S, 0xcfe0d0, 1.0, 'c', { flicker: true });
    addLight(10 * S, 6 * S, 0xff2a1a, 1.3, 'c', { emerg: true });
    addLight(15 * S, 5.5 * S, 0xcfe0d0, 1.0, 'c', { flicker: true });
    box(0.08, 2.6, 2.2, mat(0x5b636c, { metalness: 0.8, roughness: 0.35 }), 1 * S + 0.05, 1.3, 6 * S);
    api.sign('ELEVADOR DE CARGA', 1 * S + 0.08, 2.75, 6 * S, Math.PI / 2, '#3a2a10', '#ffd27a', 1.2);
    api.pipe('x', 2.5, 45, 2.7, 5 * S + 0.3, 0.18); api.pipe('x', 2.5, 45, 2.55, 7 * S - 0.3, 0.12);
    [[3, 'INCUBADORAS'], [9, 'GENÉTICA'], [15, 'AMOSTRAS']].forEach(([c, n]) => api.sign(n, (c + 1) * S + 0.4, 2.2, 5 * S + 0.02, 0));
    api.barrel(6 * S, 7 * S - 0.4, 0.4); api.barrel(13 * S, 5 * S + 0.4, 1.4); api.crate(17 * S, 7 * S - 0.5, 0.9, 0.3);
    api.steamVent(12 * S, 6 * S);
    // painel de memória junto à porta da Genética
    box(0.7, 0.9, 0.1, mat(0x2b3036, { metalness: 0.6 }), 10.6 * S, 1.45, 5 * S + 0.05);
    const pads = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835];
    const pg = new THREE.Group(); pg.position.set(10.6 * S, 1.45, 5 * S + 0.12); scn.add(pg);
    pads.forEach((c, i) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.03), new THREE.MeshBasicMaterial({ color: c }));
      p.position.set((i % 2 ? 0.13 : -0.13), (i < 2 ? 0.13 : -0.13), 0); pg.add(p);
    });
    api.hitbox(pg, 0.7, 0.8, 0.3);
    interact(pg, () => G.s.simon ? 'Painel de segurança (desbloqueado)' : 'Usar o painel de segurança', () => {
      if (G.s.simon) return;
      api.openSimon({ rounds: [4, 5, 6], onWin() { G.s.simon = true; api.openDoor('S'); toast('Porta da Genética desbloqueada.'); } });
    });

    // ----- incubadoras -----
    addLight(3.5 * S, 2.5 * S, 0xb8ffcc, 0.8, 'inc', { flicker: true });
    [[1.6, 1.6], [1.6, 2.6], [1.6, 3.5], [3.4, 1.4]].forEach(([c, r], i) => api.tank(c * S, r * S, 0x5dff8a, 1.4, 0.3, i === 1 ? 1.2 : 0));
    box(1.8, 0.9, 0.8, mat(0x3c434b, { metalness: 0.4 }), 4.6 * S, 0.45, 3.4 * S, true);
    const inc = box(0.3, 0.01, 0.4, 0xf4efe1, 4.6 * S, 0.91, 3.4 * S);
    interact(inc, () => 'Ler o registo das incubadoras', () => showNote(
      'REGISTO DAS INCUBADORAS\n\nAs culturas ÓMEGA reagem à memória dos sujeitos. Quanto mais esquecem, melhor crescem.\n\n' +
      'Nota da enfermeira-chefe: o código do cofre de amostras está escrito pelo setor, com tinta UV, por ordem I, II, III e IV. Só com a lâmpada UV se vê.'));

    // ----- laboratório de Genética -----
    addLight(9.5 * S, 2.5 * S, 0xe0f0ff, 1.0, 'gen', { flicker: true });
    [[8.3, 1.8], [10.7, 1.8], [9.5, 3.2]].forEach(([c, r]) => {
      box(2.0, 0.08, 0.9, 0x9aa2a9, c * S, 0.92, r * S, true);
      box(1.9, 0.86, 0.8, mat(0x3c434b, { metalness: 0.4, roughness: 0.55 }), c * S, 0.44, r * S);
    });
    for (let i = 0; i < 6; i++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), new THREE.MeshBasicMaterial({ color: [0x5dff8a, 0xff5d8a, 0x5dc8ff][i % 3] }));
      tube.position.set(10.7 * S - 0.6 + i * 0.2, 1.05, 1.8 * S); scn.add(tube);
    }
    addItem('uv', 8.3 * S, 1.0, 1.8 * S, () => {
      // apagão assustador ao apanhar a lâmpada
      G.s.blackout = 3.2; snd.sting();
      setTimeout(() => toast('Usa o botão <b>UV</b> (ou a tecla U) para ligar a luz ultravioleta.'), 3400);
    });
    const gl = box(0.3, 0.01, 0.4, 0xf4efe1, 9.5 * S, 0.97, 3.2 * S); gl.rotation.y = 0.4;
    interact(gl, () => 'Ler o caderno de laboratório', () => showNote(
      'CADERNO DE LABORATÓRIO — DIA 40\n\nO Vasco já não chama "doentes" aos sujeitos. Chama-lhes "atores".\n\n' +
      'Hoje perguntei-lhe para que serve o Teste 7. Respondeu: «Para ver se acreditam que estão a fugir.»\n\nNão percebi. Ainda.'));

    // ----- cofre de amostras -----
    addLight(15.5 * S, 2.5 * S, 0xd8c8ff, 1.2, 'cof');
    for (let k = 0; k < 2; k++) {
      const z = (1.2 + k * 2.2) * S;
      box(4.2, 0.05, 0.5, mat(0x4a525a, { metalness: 0.6 }), 15.5 * S, 1.0, z, true);
      box(4.2, 0.05, 0.5, mat(0x4a525a, { metalness: 0.6 }), 15.5 * S, 1.6, z);
      for (let i = 0; i < 9; i++) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 10), new THREE.MeshBasicMaterial({ color: [0x7dffb0, 0xb07dff, 0xffd27a][rnd(3)], transparent: true, opacity: 0.8 }));
        jar.position.set(15.5 * S - 1.8 + i * 0.45, 1.14, z); scn.add(jar);
      }
    }
    addItem('key', 16.2 * S, 1.1, 1.2 * S);
    fragment(3, 14.5 * S, 1.07, 3.4 * S, 'Etiqueta de uma amostra, com caligrafia apressada:\n\n«Amostra Ω-12. Origem: Sujeito 12.\n\nSe a memória volta, o teste falha. Se não volta, o teste repete-se.» — I. M.');

    // ----- tinta invisível: código I, II, III, IV -----
    const spots = api.shuffle([
      [1 * S + 0.03, 1.7, 2.5 * S, Math.PI / 2],
      [4.6 * S, 1.6, 1 * S + 0.03, 0],
      [9.5 * S, 1.8, 1 * S + 0.03, 0],
      [16 * S, 1.4, 7 * S - 0.03, Math.PI]
    ]);
    ['I', 'II', 'III', 'IV'].forEach((r, i) => api.uvMark(r + ' · ' + digits[i], spots[i][0], spots[i][1], spots[i][2], spots[i][3], 1.1));
  }
};

// ---------------------------------------------------------------------------
// SETOR D — MANUTENÇÃO (labirinto gerado em cada partida)
// ---------------------------------------------------------------------------
const MW = 7, MH = 5;
const sectorD = {
  title: 'SETOR D — MANUTENÇÃO', subtitle: 'NÍVEL −6',
  intro: 'Túneis de manutenção. É fácil perderes-te aqui em baixo.',
  map: [], start: [1.5, 1.5, -Math.PI / 2], power: false, ambient: 0.3, fogDensity: 0.065, creepy: 1.8, flash: 11, wallTint: 0x9aa0a8,
  rooms: [['p', 15, 8, 19, 10]],
  doors: {
    B: { label: 'COMPORTA', color: '#4fc3f7', check() { return A.G.s.cool ? null : 'A comporta só abre com a refrigeração restabelecida (painel ao lado).'; } },
    X: { label: 'NÚCLEO', color: '#7dffcf', exit: true, prompt() { return 'Chamar o elevador do núcleo'; } }
  },
  // gera o labirinto antes de construir o setor
  prepare() {
    const M = []; for (let r = 0; r < 12; r++) M.push(new Array(21).fill(' '));
    for (let r = 0; r <= 10; r++) for (let c = 0; c <= 14; c++) M[r][c] = '#';
    const seen = new Set(), adj = {}, key = (i, j) => i + ',' + j;
    const stack = [[0, 0]]; seen.add(key(0, 0)); M[1][1] = '.';
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [i + a, j + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < MW && b < MH && !seen.has(key(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [a, b] = pick(nb);
      seen.add(key(a, b)); M[2 * b + 1][2 * a + 1] = '.'; M[j + b + 1][i + a + 1] = '.';
      (adj[key(i, j)] = adj[key(i, j)] || []).push([a, b]); (adj[key(a, b)] = adj[key(a, b)] || []).push([i, j]);
      stack.push([a, b]);
    }
    // sala das bombas a este, com a comporta e o elevador
    for (let c = 14; c <= 20; c++) { M[7][c] = '#'; M[11][c] = '#'; }
    for (let r = 8; r <= 10; r++) { for (let c = 15; c <= 19; c++) M[r][c] = '.'; M[r][20] = '#'; }
    M[9][14] = 'B'; M[9][20] = 'X';
    this.map = M.map((row) => row.join(''));
    // distâncias desde a entrada para escolher os becos mais escondidos
    const dist = { [key(0, 0)]: 0 }, q = [[0, 0]];
    while (q.length) { const [i, j] = q.shift(); for (const [a, b] of adj[key(i, j)] || []) if (dist[key(a, b)] == null) { dist[key(a, b)] = dist[key(i, j)] + 1; q.push([a, b]); } }
    this.dead = Object.keys(adj).filter((k) => adj[k].length === 1 && k !== key(0, 0) && k !== key(MW - 1, MH - 1))
      .map((k) => k.split(',').map(Number)).sort((p, q2) => dist[key(q2[0], q2[1])] - dist[key(p[0], p[1])]);
    this.adj = adj;
    this.start = [1.5, 1.5, M[1][2] === '.' ? -Math.PI / 2 : Math.PI];
  },
  objective(G) {
    if (!G.inv.valve && !G.s.valveIn) return 'Encontra no labirinto o manípulo da válvula de refrigeração.';
    if (!G.s.cool) return 'Leva o manípulo ao painel junto à comporta (canto sudeste) e restabelece a refrigeração.';
    return 'Atravessa a comporta e chama o elevador do núcleo.';
  },
  build(api) {
    A = api;
    const { THREE, S, G } = api;
    const { box, mat, interact, addLight, addItem, fragment, showNote, toast, snd } = api;
    const cc = ([i, j]) => [(2 * i + 1.5) * S, (2 * j + 1.5) * S];
    const dead = this.dead.slice();
    // objetos nos becos mais afastados
    const put = (cell, fn) => { const [x, z] = cc(cell); api.crate(x, z, 0.8); fn(x, z); };
    put(dead[0], (x, z) => addItem('valve', x, 0.95, z));
    if (dead[1]) put(dead[1], (x, z) => fragment(4, x, 0.86, z, 'Uma folha de manutenção, manchada de óleo (Rui):\n\n«Esta noite vi a Dra. Moura a falar com o Vasco. Pareciam amigos. Riam-se.\n\n' +
      'Disseram que o Sujeito 12 "está a seguir o guião na perfeição".»'));
    if (dead[2]) put(dead[2], (x, z) => {
      const n = box(0.3, 0.01, 0.4, 0xf4efe1, x, 0.81, z);
      interact(n, () => 'Ler a nota', () => showNote('Rabiscado na parede e num papel:\n\n«O elevador do núcleo fica depois da comporta, no canto sudeste.\nA comporta só abre com a refrigeração a funcionar.\nO manípulo da válvula caiu num destes túneis…»'));
    });
    for (let k = 3; k < Math.min(dead.length, 6); k++) { const [x, z] = cc(dead[k]); api.barrel(x, z, k); }
    // luzes fracas espalhadas
    const cells = []; for (let i = 0; i < MW; i++) for (let j = 0; j < MH; j++) cells.push([i, j]);
    api.shuffle(cells).slice(0, 3).forEach((c, k) => { const [x, z] = cc(c); addLight(x, z, 0xffb070, 0.8, 'c', { flicker: k !== 0 }); });
    api.shuffle(cells).slice(0, 4).forEach((c) => { const [x, z] = cc(c); api.steamVent(x, z, 'c'); });
    for (let j = 0; j < MH; j += 2) api.pipe('x', 2.5, 35, 2.72, (2 * j + 1.3) * S, 0.14);
    for (let i = 1; i < MW; i += 3) api.pipe('z', 2.5, 25, 2.6, (2 * i + 1.7) * S, 0.18);
    // painel de refrigeração ao lado da comporta
    const px = 13.5 * S, pz = 10 * S - 0.06;
    box(0.9, 1.0, 0.12, mat(0x2b3036, { metalness: 0.6 }), px, 1.4, pz);
    const led = box(0.1, 0.1, 0.05, new THREE.MeshBasicMaterial({ color: 0x661111 }), px + 0.3, 1.75, pz - 0.08);
    const sock = box(0.3, 0.3, 0.08, mat(0x111418), px - 0.1, 1.35, pz - 0.08);
    api.sign('REFRIGERAÇÃO', px, 2.05, pz - 0.07, Math.PI, '#0b1a22', '#4fc3f7', 0.9);
    addLight(13.5 * S, 9 * S, 0xff2a1a, 1.2, 'c', { emerg: true });
    interact(sock, () => G.s.cool ? 'Refrigeração a funcionar' : (G.s.valveIn ? 'Abrir o circuito de refrigeração' : 'Painel de refrigeração'), () => {
      if (G.s.cool) return;
      if (!G.s.valveIn) {
        if (!G.inv.valve) { snd.deny(); toast('Falta o manípulo da válvula neste painel.'); return; }
        G.inv.valve = false; G.s.valveIn = true; api.renderInv(); snd.valve(px, pz);
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 20), mat(0x4fc3f7)); w.position.set(px - 0.1, 1.35, pz - 0.15); api.scene.add(w);
        toast('Manípulo instalado. Agora alinha o circuito.');
      }
      api.openPipes({
        n: 5, onWin() {
          G.s.cool = true; snd.flow(); led.material.color.set(0x33ff88);
          setTimeout(() => { api.openDoor('B'); toast('A comporta está a abrir.'); }, 2200);
        }
      });
    });
    // sala das bombas e elevador
    addLight(17 * S, 9 * S, 0x9fd8ff, 1.6, 'p');
    api.tank(16 * S, 8.4 * S, 0x4fc3f7, 2.0, 0.35, 1.2); api.tank(18.4 * S, 8.4 * S, 0x4fc3f7, 2.0, 0.35, 0);
    api.pipe('x', 37.5, 50, 2.6, 10.6 * S, 0.22);
    box(0.1, 3, S, mat(0x2a3036, { metalness: 0.8, roughness: 0.3 }), 21 * S - 0.05, 1.5, 9.5 * S);
    api.glowSprite(21 * S - 0.4, 2.7, 9.5 * S, 0x7dffcf, 1.2, 0.5);
  }
};

// ---------------------------------------------------------------------------
// SETOR E — NÚCLEO (final do capítulo)
// ---------------------------------------------------------------------------
const sectorE = {
  title: 'SETOR E — NÚCLEO ÓMEGA', subtitle: 'NÍVEL −7',
  intro: 'O núcleo Ómega. Desliga-o e a instalação abre-se.',
  map: [
    '###############',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#.............#',
    '#######X#######',
    '      #.#      ',
    '      #.#      ',
    '      #.#      ',
    '      #.#      ',
    '      #.#      ',
    '      #Y#      '
  ],
  rooms: [['n', 1, 1, 13, 5]],
  start: [7.5, 1.6, Math.PI], power: true, ambient: 0.4,
  doors: {
    X: { label: 'EVACUAÇÃO', color: '#ef4444', check() { return A.G.s.shutdown ? null : 'Porta selada pelo núcleo Ómega.'; } },
    Y: { label: 'SUPERFÍCIE', color: '#7dffcf', exit: true, check() { return A.G.s.shutdown ? null : 'O elevador para a superfície está bloqueado pelo núcleo.'; } }
  },
  objective(G) {
    if (!G.s.rodsDone) return 'Estabiliza o núcleo: baixa as três barras de controlo pela ordem indicada no monitor.';
    if (!G.s.shutdown) return 'Introduz o código Ómega (os quatro fragmentos, por ordem) no terminal de desativação.';
    return 'EVACUA! Corre para o elevador da superfície!';
  },
  onExit() { A.playEnding(); },
  build(api) {
    A = api;
    const { THREE, S, G, CH } = api;
    const scn = api.scene;
    const { box, mat, interact, textTex, addLight, showNote, toast, snd } = api;
    const order = api.shuffle(['A', 'B', 'C']);
    G.s.rodIdx = 0; G.s.order = order;

    const lights = [[4, 2.5], [11, 2.5], [4, 4.5], [11, 4.5]].map(([c, r]) => addLight(c * S, r * S, 0xe8f0ff, 1.7, 'n'));
    lights.push(addLight(7.5 * S, 9.5 * S, 0xe8f0ff, 1.2, 'c'));
    box(2.2, 2.6, 0.08, mat(0x5b636c, { metalness: 0.8, roughness: 0.35 }), 7.5 * S, 1.3, 1 * S + 0.05);
    // reator
    const cx = 7.5 * S, cz = 3.4 * S;
    api.setCore(cx, 1.5, cz);
    api.tank(cx, cz, 0xff8a2a, 2.7, 1.0, 3.5);
    box(3.2, 0.25, 3.2, mat(0x2b3036, { metalness: 0.7 }), cx, 0.12, cz);
    api.hazardBand(3.2, 3.2, cx, 0.3, cz);
    G.colliders.push({ x0: cx - 1.6, x1: cx + 1.6, z0: cz - 1.6, z1: cz + 1.6 });
    for (let k = 0; k < 4; k++) api.pipe('z', cz + 1.6, 15, 2.5 - k * 0.15, cx - 1.2 + k * 0.8, 0.12);
    // barras de controlo
    const rods = { A: [cx - 3.2, cz], B: [cx + 3.2, cz], C: [cx, cz - 3.0] };
    const handles = {};
    Object.entries(rods).forEach(([k, [x, z]]) => {
      box(0.6, 1.0, 0.6, mat(0x3a3f45, { metalness: 0.6 }), x, 0.5, z, true);
      const h = new THREE.Group(); h.position.set(x, 1.0, z); scn.add(h);
      const bar = box(0.1, 0.8, 0.1, mat(0xffd600), 0, 0.4, 0, false, h);
      box(0.25, 0.12, 0.25, mat(0xc62828), 0, 0.85, 0, false, h);
      handles[k] = h; void bar;
      api.sign('BARRA ' + k, x, 2.1, z, Math.atan2(x - cx, z - cz), '#2b3036', '#ffd600', 0.7);
      api.hitbox(h, 0.6, 1.4, 0.6).position.y = 0.4;
      interact(h, () => G.s.rodsDone || G.s.down?.[k] ? 'Barra ' + k + ' (em baixo)' : 'Baixar a barra de controlo ' + k, () => {
        G.s.down = G.s.down || {};
        if (G.s.rodsDone || G.s.down[k]) return;
        if (order[G.s.rodIdx] !== k) {
          snd.deny(x, z); G.s.rodIdx = 0;
          Object.keys(G.s.down).forEach((kk) => { if (G.s.down[kk]) { G.s.down[kk] = false; handles[kk].position.y = 1.0; } });
          toast('Sequência errada! As barras voltaram a subir.'); return;
        }
        G.s.down[k] = true; G.s.rodIdx++; handles[k].position.y = 0.45; snd.breaker(x, z, true);
        if (G.s.rodIdx === 3) { G.s.rodsDone = true; snd.powerOn(); toast('Núcleo estabilizado. O terminal Ómega já aceita o código.'); }
      });
    });
    // monitor com a ordem
    const mon = textTex(512, 192, '#061510', (x) => {
      x.fillStyle = '#7dffcf'; x.font = 'bold 30px monospace'; x.fillText('ESTABILIZAÇÃO DO NÚCLEO', 20, 46);
      x.font = 'bold 56px monospace'; x.fillStyle = '#ffd600'; x.fillText(order.join('  →  '), 40, 140);
    });
    api.plane(1.8, 0.68, new THREE.MeshBasicMaterial({ map: mon }), 12 * S, 1.9, 1 * S + 0.04, 0);
    // terminal de desativação
    const tx = 2.2 * S, tz = 5.3 * S;
    box(1.6, 1.0, 0.7, mat(0x2b3036, { metalness: 0.6 }), tx, 0.5, tz, true);
    const ts = textTex(256, 160, '#1a0606', (x) => {
      x.fillStyle = '#ff6b6b'; x.font = 'bold 22px monospace'; x.fillText('Ω DESATIVAÇÃO', 12, 34);
      x.font = '16px monospace'; x.fillText('Introduzir código', 12, 74); x.fillText('de 4 dígitos', 12, 98); x.fillText('(fragmentos 1-4)', 12, 122);
    });
    const tscr = api.plane(0.7, 0.44, new THREE.MeshBasicMaterial({ map: ts }), tx, 1.25, tz - 0.36, Math.PI);
    tscr.rotation.x = 0.35;
    interact(tscr, () => G.s.shutdown ? 'Núcleo desligado' : 'Terminal de desativação Ω', () => {
      if (G.s.shutdown) return;
      if (!G.s.rodsDone) { snd.deny(); toast('O terminal recusa: primeiro estabiliza o núcleo com as barras de controlo.'); return; }
      api.openKeypad({ code: CH.frags.join(''), onOk: shutdown });
    });
    function shutdown() {
      G.s.shutdown = true; snd.sting();
      toast('NÚCLEO DESATIVADO. Evacuação imediata!');
      lights.forEach((l) => {
        l.light.color.set(0xff2a1a); l.panel.material.color.set(0xff2a1a); l.halo.material.color.set(0xff2a1a);
        l.base = 5; G.emergency.push(l);
      });
      api.openDoor('X'); api.openDoor('Y');
      api.startCountdown(50, () => {
        toast('O núcleo voltou a selar a instalação…');
        setTimeout(() => { CH.time += G.time; G.time = 0; G.done = true; api.enterSector(4); }, 1500);
      });
    }
    // diário do Vasco (opcional) — prenúncio do final
    box(1.2, 0.06, 0.6, 0x3a4048, 12.4 * S, 0.76, 4.8 * S, true); box(1.1, 0.72, 0.5, 0x2b3036, 12.4 * S, 0.37, 4.8 * S);
    const vn = box(0.3, 0.01, 0.4, 0xf4efe1, 12.4 * S, 0.8, 4.8 * S); vn.rotation.y = -0.3;
    interact(vn, () => 'Ler o diário do Dr. Vasco', () => showNote(
      'DIÁRIO DO DR. VASCO TEIXEIRA\n\nTeste 7, dia 1. O sujeito acredita que está a fugir.\n\n' +
      'Os "fragmentos" que a Inês espalhou estão a funcionar: segue cada pista como previsto. ' +
      'Quando chegar ao núcleo, vai desligá-lo por vontade própria.\n\nÉ exatamente isso que queremos medir.'));
    // corredor de evacuação e elevador
    api.sign('EVACUAÇÃO ↓', 7.5 * S, 2.6, 6 * S - 0.05, Math.PI, '#0c7a3e', '#ffffff', 1.0);
    box(S, 3, 0.1, mat(0x2a3036, { metalness: 0.8, roughness: 0.3 }), 7.5 * S, 1.5, 13 * S + 0.05);
    api.glowSprite(7.5 * S, 2.7, 13 * S - 0.3, 0xe8f4ff, 1.4, 0.6);
  }
};

export const SECTORS = [sectorA, sectorB, sectorC, sectorD, sectorE];
