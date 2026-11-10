/* Gerador: transforma a descrição escrita pela pessoa numa configuração de jogo.
   Funciona sem internet: procura palavras-chave (tipo de jogo, tema, velocidade, dificuldade) e completa o resto com variações. */
(function (root) {
  'use strict';
  const THEMES = {
    fantasia: { label: 'Fantasia', bg1: '#3b1d6e', bg2: '#d9739b', ground: '#5a3d8a', top: '#c79bff', accent: '#ffd23a', juice: '#ff7ad9', hue: 285, heroes: ['🧙', '🧚', '🦄', '🐉'], enemy: '👻', coin: '⭐', fruit: ['🔮', '💎', '🍄', '🌟'], deco: ['🏰', '✨', '🌙', '☁️'], traffic: ['🐉', '🦇', '🪨'] },
    espaco: { label: 'Espaço', bg1: '#05061a', bg2: '#25124d', ground: '#3a3a5e', top: '#8fa3ff', accent: '#5ef0ff', juice: '#7cf3ff', hue: 230, heroes: ['🚀', '👩‍🚀', '🛸', '👽'], enemy: '👾', coin: '💠', fruit: ['🪐', '🌍', '☄️', '🌕'], deco: ['🪐', '🌑', '☄️', '⭐'], traffic: ['☄️', '🛸', '🛰️'] },
    cidade: { label: 'Cidade', bg1: '#1f5fa8', bg2: '#ffb36b', ground: '#3b3f4a', top: '#ffe066', accent: '#ffe066', juice: '#ff9a3a', hue: 40, heroes: ['🏎️', '🛹', '🛵', '🚲'], enemy: '🚧', coin: '🪙', fruit: ['🍔', '🍕', '🌭', '🥤'], deco: ['🏢', '🏙️', '🌳', '🚦'], traffic: ['🚗', '🚕', '🚌', '🚙'] },
    floresta: { label: 'Floresta', bg1: '#174d2a', bg2: '#9ad66b', ground: '#5b3a1e', top: '#6fd16b', accent: '#ffe14a', juice: '#c6ff5e', hue: 110, heroes: ['🦊', '🐸', '🐿️', '🦉'], enemy: '🐝', coin: '🍀', fruit: ['🍎', '🍐', '🌰', '🍓'], deco: ['🌲', '🌳', '🍄', '🌿'], traffic: ['🪵', '🐗', '🪨'] },
    oceano: { label: 'Oceano', bg1: '#0a3d6b', bg2: '#2bc3d1', ground: '#d9b77a', top: '#fff0c2', accent: '#ffe066', juice: '#7af2ff', hue: 190, heroes: ['🐠', '🐬', '🐙', '🐢'], enemy: '🦈', coin: '🐚', fruit: ['🦀', '🐡', '🦑', '🫧'], deco: ['🪸', '🐚', '🌊', '🫧'], traffic: ['🦈', '🐡', '⚓'] },
    doces: { label: 'Doces', bg1: '#ff8ab8', bg2: '#ffe2a8', ground: '#a0522d', top: '#fff2f8', accent: '#ff3d8b', juice: '#ff6fb0', hue: 330, heroes: ['🧁', '🐻', '🍭', '🦄'], enemy: '🦷', coin: '🍬', fruit: ['🍩', '🍪', '🍫', '🍰', '🍦'], deco: ['🍭', '🍬', '🧁', '🎀'], traffic: ['🍩', '🎂', '🍫'] },
    terror: { label: 'Mistério', bg1: '#0b0b14', bg2: '#3d1a3a', ground: '#2a2433', top: '#8b6bb3', accent: '#ff7b2e', juice: '#a6ff4d', hue: 270, heroes: ['🎃', '🦇', '🧛', '💀'], enemy: '👻', coin: '🕯️', fruit: ['🎃', '🍬', '🧪', '🦴'], deco: ['🕸️', '🌕', '🪦', '🦇'], traffic: ['⚰️', '🦇', '🕷️'] },
    gelo: { label: 'Gelo', bg1: '#2b5f9e', bg2: '#d8f3ff', ground: '#9cc9e8', top: '#ffffff', accent: '#5ee7ff', juice: '#bff6ff', hue: 200, heroes: ['🐧', '⛄', '🐻‍❄️', '🦭'], enemy: '❄️', coin: '💎', fruit: ['🧊', '🍧', '🐟', '❄️'], deco: ['🏔️', '❄️', '🌨️', '🌲'], traffic: ['🧊', '⛄', '🛷'] },
    deserto: { label: 'Deserto', bg1: '#f08a3c', bg2: '#ffe0a3', ground: '#c47a3a', top: '#ffd18a', accent: '#fff07a', juice: '#ffb347', hue: 30, heroes: ['🐪', '🤠', '🦎', '🐫'], enemy: '🦂', coin: '🏺', fruit: ['🌵', '🥥', '🍉', '🫒'], deco: ['🌵', '🏜️', '☀️', '🦴'], traffic: ['🌵', '🪨', '🦂'] },
    robos: { label: 'Robôs', bg1: '#11202e', bg2: '#2e5b6b', ground: '#4a5868', top: '#7affc4', accent: '#7affc4', juice: '#7affc4', hue: 160, heroes: ['🤖', '🦾', '🚁', '🛰️'], enemy: '⚙️', coin: '🔋', fruit: ['💾', '🔩', '🔧', '💡'], deco: ['🏭', '⚡', '📡', '🔌'], traffic: ['🚜', '🦿', '⚙️'] },
    quinta: { label: 'Quinta', bg1: '#6ec6ff', bg2: '#c8f08f', ground: '#7a5230', top: '#8be06a', accent: '#ffe14a', juice: '#ffcf4a', hue: 90, heroes: ['🐷', '🐔', '🐮', '🐑'], enemy: '🐺', coin: '🥚', fruit: ['🥕', '🌽', '🍅', '🍓'], deco: ['🌻', '🚜', '🌾', '🏡'], traffic: ['🚜', '🐄', '🌾'] },
    dinos: { label: 'Dinossauros', bg1: '#2f5d3a', bg2: '#f2c46b', ground: '#6b4a2b', top: '#a7d36b', accent: '#ffcc33', juice: '#ff9440', hue: 70, heroes: ['🦖', '🦕', '🐊', '🥚'], enemy: '🌋', coin: '🦴', fruit: ['🥚', '🍖', '🌿', '🍈'], deco: ['🌋', '🌴', '🪨', '🌿'], traffic: ['🦕', '🪨', '🌋'] }
  };
  const TEMPLATE_WORDS = {
    plataforma: ['salt', 'plataform', 'corre', 'correr', 'aventura', 'pul', 'jump', 'mario', 'mundo', 'herói', 'heroi'],
    corrida: ['corrida', 'carro', 'pista', 'estrada', 'condu', 'race', 'racer', 'mota', 'trânsito', 'transito', 'faixa', 'skate', 'bicicleta'],
    espaco: ['nave', 'dispar', 'tiro', 'atira', 'shoot', 'invas', 'alien', 'asteroid', 'meteor', 'laser', 'batalha', 'guerra'],
    masmorra: ['labirint', 'masmorra', 'dungeon', 'calabouço', 'calabouco', 'tesouro', 'gema', 'caverna', 'fantasma', 'maze', 'fuga', 'escape', 'escapar'],
    torre: ['torre', 'empilh', 'bloco', 'constr', 'stack', 'prédio', 'predio', 'arranha', 'equilíbr', 'equilibr'],
    cortar: ['cort', 'fatia', 'ninja', 'espada', 'slice', 'fruta', 'lâmina', 'lamina', 'katana', 'samurai'],
    bolhas: ['bolha', 'rebent', 'pop', 'balão', 'balao', 'toca', 'tocar', 'relax', 'calm', 'bubble', 'confet']
  };
  const THEME_WORDS = {
    fantasia: ['fantasia', 'mago', 'magia', 'dragão', 'dragao', 'castelo', 'feiti', 'unicórnio', 'unicornio', 'fada', 'reino', 'princes', 'cavaleiro'],
    espaco: ['espaço', 'espaco', 'galáx', 'galax', 'planeta', 'estrela', 'nave', 'alien', 'lua', 'cosm', 'astron', 'foguet', 'space', 'sky'],
    cidade: ['cidade', 'rua', 'carro', 'estrada', 'urban', 'trânsito', 'transito', 'táxi', 'taxi', 'skate', 'pixel', 'racer'],
    floresta: ['floresta', 'bosque', 'selva', 'árvore', 'arvore', 'raposa', 'sapo', 'natureza', 'jardim', 'folha', 'fruta', 'pomar'],
    oceano: ['oceano', 'mar', 'peixe', 'praia', 'tubarão', 'tubarao', 'água', 'agua', 'subaqu', 'pirata', 'golfinho', 'polvo'],
    doces: ['doce', 'bolo', 'chocolate', 'gomas', 'açúcar', 'acucar', 'gelado', 'candy', 'rebuçado', 'rebucado', 'caramelo', 'cupcake'],
    terror: ['terror', 'medo', 'assust', 'fantasma', 'zombie', 'zombi', 'halloween', 'vampir', 'noite', 'abóbora', 'abobora', 'escuro', 'mistério', 'misterio', 'dungeon', 'masmorra', 'calabouço'],
    gelo: ['gelo', 'neve', 'inverno', 'pinguim', 'polar', 'frio', 'natal', 'glaciar', 'boneco de neve', 'ártico', 'artico'],
    deserto: ['deserto', 'areia', 'camelo', 'pirâmide', 'piramide', 'egipt', 'cowboy', 'oeste', 'cacto', 'faraó', 'farao'],
    robos: ['robô', 'robo', 'robot', 'máquina', 'maquina', 'futur', 'ciber', 'cyber', 'tecnolog', 'mecân', 'mecan', 'laborat', 'cientista'],
    quinta: ['quinta', 'fazenda', 'animais', 'porco', 'galinha', 'vaca', 'ovelha', 'campo', 'trator', 'agricult'],
    dinos: ['dinossaur', 'dino', 'jurássic', 'jurassic', 'pré-hist', 'pre-hist', 'vulcão', 'vulcao', 't-rex', 'trex']
  };
  const HERO_WORDS = { '🐱': ['gato', 'gatinho'], '🐶': ['cão', 'cao', 'cachorro', 'cãozinho'], '🐰': ['coelho'], '🐼': ['panda'], '🦁': ['leão', 'leao'], '🐵': ['macaco'], '🐝': ['abelha'], '🦋': ['borboleta'], '🐢': ['tartaruga'], '🐧': ['pinguim'], '🦊': ['raposa'], '🐸': ['sapo'], '🦖': ['t-rex', 'trex', 'dinossauro'], '🐉': ['dragão', 'dragao'], '🦄': ['unicórnio', 'unicornio'], '🤖': ['robô', 'robo', 'robot'], '🚀': ['foguete', 'foguetão', 'foguetao'], '🛸': ['ovni', 'disco voador'], '🏎️': ['carro de corrida', 'fórmula', 'formula'], '🚗': ['carro'], '🛵': ['mota', 'scooter'], '🐙': ['polvo'], '🐬': ['golfinho'], '🦈': ['tubarão', 'tubarao'], '🧙': ['mago', 'feiticeiro'], '🧚': ['fada'], '🥷': ['ninja'], '👸': ['princesa'], '🤴': ['príncipe', 'principe'], '🦸': ['super-herói', 'super herói', 'superheroi', 'super-heroi'], '🐷': ['porco', 'porquinho'], '🐔': ['galinha'], '🐻': ['urso'], '🦉': ['coruja'], '🐿️': ['esquilo'], '🐞': ['joaninha'], '👻': ['fantasma'], '🎃': ['abóbora', 'abobora'], '⛄': ['boneco de neve'], '🐪': ['camelo'], '🧁': ['cupcake', 'queque'], '👽': ['alien', 'extraterrestre'] };
  const NAME_A = { plataforma: ['Aventura', 'Salto', 'Corrida', 'Jornada', 'Viagem'], corrida: ['Turbo', 'Corrida', 'Rally', 'Pista', 'Acelera'], espaco: ['Batalha', 'Invasão', 'Esquadrão', 'Patrulha', 'Missão'], masmorra: ['Labirinto', 'Tesouro', 'Masmorra', 'Fuga', 'Segredo'], torre: ['Torre', 'Pilha', 'Construtor', 'Arranha-Céus', 'Equilíbrio'], cortar: ['Corte', 'Fatia', 'Lâmina', 'Golpe', 'Ninja'], bolhas: ['Bolhas', 'Pop', 'Rebenta', 'Chuva', 'Festa'] };
  const NAME_B = { fantasia: ['Mágica', 'do Reino', 'Encantada', 'do Dragão'], espaco: ['Galáctica', 'Estelar', 'Cósmica', 'Lunar'], cidade: ['Urbana', 'da Cidade', 'Noturna', 'Pixel'], floresta: ['da Floresta', 'Selvagem', 'Verde', 'do Bosque'], oceano: ['Submarina', 'do Oceano', 'Azul', 'das Marés'], doces: ['Doce', 'de Açúcar', 'de Chocolate', 'Gulosa'], terror: ['Sombria', 'Assombrada', 'da Meia-Noite', 'Misteriosa'], gelo: ['Gelada', 'Polar', 'de Cristal', 'do Inverno'], deserto: ['das Dunas', 'do Deserto', 'Dourada', 'do Sol'], robos: ['Robótica', 'Neon', 'Cibernética', 'Mecânica'], quinta: ['na Quinta', 'do Campo', 'Animal', 'Feliz'], dinos: ['Jurássica', 'Pré-Histórica', 'do Vulcão', 'Dino'] };

  function norm(s) { return ' ' + String(s || '').toLowerCase() + ' '; }
  function score(text, words) { let n = 0; for (const w of words) if (text.includes(w)) n += w.length > 4 ? 2 : 1; return n; }
  function best(text, table, fallback, r) {
    let top = 0, win = [];
    for (const k of Object.keys(table)) { const s = score(text, table[k]); if (s > top) { top = s; win = [k]; } else if (s === top && s > 0) win.push(k); }
    if (!win.length) return fallback;
    return win[Math.floor(r() * win.length)];
  }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // gera um jogo completo a partir de uma frase
  function generate(desc, extra) {
    const text = norm(desc), seed = (hash(text) ^ Date.now()) >>> 0 || 1, r = MDJ.rng(seed);
    const pickR = (a) => a[Math.floor(r() * a.length)];
    const tkeys = Object.keys(TEMPLATE_WORDS), thkeys = Object.keys(THEMES);
    const template = best(text, TEMPLATE_WORDS, pickR(tkeys), r);
    const themeKey = best(text, THEME_WORDS, pickR(thkeys), r);
    const theme = THEMES[themeKey];
    let hero = null;
    for (const [e, ws] of Object.entries(HERO_WORDS)) if (score(text, ws)) { hero = e; break; }
    if (!hero) hero = template === 'espaco' ? (themeKey === 'espaco' ? '🚀' : pickR(theme.heroes)) : template === 'corrida' && themeKey === 'cidade' ? '🏎️' : pickR(theme.heroes);
    let speed = 1, difficulty = 1;
    if (/rápid|rapid|veloz|turbo|depressa|frenétic|frenetic|acelera/.test(text)) speed = 1.3;
    if (/devagar|lent|calm|relax|tranquil|zen/.test(text)) speed = 0.8;
    if (/difícil|dificil|hardcore|desafi|impossível|impossivel|extrem/.test(text)) difficulty = 2;
    if (/fácil|facil|crianç|crianc|bebé|bebe|simples|relax|calm/.test(text)) difficulty = 0;
    let name = titleFrom(desc);
    if (!name) name = pickR(NAME_A[template]) + ' ' + pickR(NAME_B[themeKey]);
    return Object.assign({ id: 'g' + seed.toString(36) + Math.floor(r() * 1e4).toString(36), name, desc: String(desc || '').trim(), template, themeKey, hero, speed, difficulty, seed, music: true, sound: true, hueShift: 0, created: Date.now() }, extra || {});
  }
  // se a pessoa escreveu "chamado X" ou pôs o nome entre aspas, usa esse nome
  function titleFrom(desc) {
    const s = String(desc || '');
    const q = s.match(/["“«']([^"”»']{2,26})["”»']/); if (q) return q[1].trim();
    const m = s.match(/(?:chamad[oa]|com o nome(?: de)?|nome[: ]+)\s+([A-ZÀ-Ý0-9][\wÀ-ÿ' -]{1,24})/i); if (m) return m[1].trim().replace(/[.,!?]+$/, '');
    return null;
  }
  // configuração final que o motor recebe (com o tema "aplicado" e a cor ajustada)
  function resolve(game) {
    const base = THEMES[game.themeKey] || THEMES.fantasia, h = game.hueShift || 0;
    const shift = (c) => (h ? hueRotate(c, h) : c);
    const theme = Object.assign({}, base, { bg1: shift(base.bg1), bg2: shift(base.bg2), ground: shift(base.ground), top: shift(base.top), accent: shift(base.accent), juice: shift(base.juice), hue: (base.hue + h + 360) % 360 });
    if (game.coin) theme.coin = game.coin; if (game.enemy) theme.enemy = game.enemy;
    return { id: game.id, name: game.name, template: game.template, theme, hero: game.hero, speed: game.speed, difficulty: game.difficulty, seed: game.seed, music: game.music, sound: game.sound };
  }
  function hueRotate(hex, deg) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
    hh = (hh + deg + 360) % 360;
    const f = (k) => { const a = s * Math.min(l, 1 - l), kk = (k + hh / 30) % 12; return l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)); };
    return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  }
  const IDEAS = ['Um gato ninja que corta frutas muito depressa', 'Corrida de carros na cidade à noite', 'Uma nave a defender a galáxia de aliens', 'Um labirinto assombrado cheio de tesouros', 'Torre de doces até às nuvens', 'Rebentar bolhas no fundo do mar, relaxante', 'Um dinossauro a saltar entre vulcões', 'Pinguim aventureiro no gelo', 'Robô a fugir de uma fábrica', 'Raposa a correr pela floresta mágica'];
  root.MDJGen = { THEMES, generate, resolve, IDEAS, TEMPLATES_PT: { plataforma: 'Plataformas', corrida: 'Corrida', espaco: 'Nave', masmorra: 'Labirinto', torre: 'Torre', cortar: 'Cortar', bolhas: 'Bolhas' } };
})(window);
