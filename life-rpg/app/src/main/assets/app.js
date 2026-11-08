/*
 * Life RPG: transforma a vida real num RPG.
 * Todo o estado vive num único objeto guardado no localStorage.
 */
(function () {
  "use strict";

  // =====================================================================
  // Dados fixos
  // =====================================================================
  const ATRIBUTOS = {
    forca:      { nome: "Força",      emoji: "💪", cor: "#ff4d6d", desc: "Saúde e exercício" },
    mente:      { nome: "Mente",      emoji: "🧠", cor: "#19b8ff", desc: "Estudo e aprendizagem" },
    carisma:    { nome: "Carisma",    emoji: "💬", cor: "#c26bff", desc: "Relações e vida social" },
    disciplina: { nome: "Disciplina", emoji: "🛡️", cor: "#ff9a3c", desc: "Trabalho e organização" },
    espirito:   { nome: "Espírito",   emoji: "🧘", cor: "#2bff88", desc: "Bem-estar e descanso" }
  };

  const CLASSES = {
    guerreiro: { nome: "Guerreiro(a)", emoji: "🗡️", atr: "forca" },
    mago:      { nome: "Mago(a)",      emoji: "🔮", atr: "mente" },
    bardo:     { nome: "Bardo",        emoji: "🎻", atr: "carisma" },
    paladino:  { nome: "Paladino",     emoji: "🛡️", atr: "disciplina" },
    druida:    { nome: "Druida",       emoji: "🌿", atr: "espirito" }
  };

  const AVATARES = ["🧙", "🧝", "🦸", "🥷", "🧛", "🧜", "🧚", "🤴", "👸", "🧑‍🚀", "🦊", "🐉"];

  const DIFICULDADES = {
    facil:   { nome: "Fácil",   xp: 10, cor: "#2bff88" },
    media:   { nome: "Média",   xp: 20, cor: "#19b8ff" },
    dificil: { nome: "Difícil", xp: 40, cor: "#ff9a3c" },
    epica:   { nome: "Épica",   xp: 80, cor: "#ff4d8d" }
  };

  const TAMANHOS = {
    pequeno:  { nome: "Pequeno",  bonus: 100 },
    grande:   { nome: "Grande",   bonus: 250 },
    lendario: { nome: "Lendário", bonus: 500 }
  };

  const XP_PASSO = 25;
  const PENALIZACAO_HP = 10;
  const POCAO = { titulo: "Poção de Vida", custo: 25, cura: 30 };

  const TITULOS = [
    [1, "Recruta"], [3, "Aprendiz"], [5, "Viajante"], [8, "Veterano(a)"],
    [12, "Campeão(ã)"], [16, "Mestre"], [20, "Lenda Viva"], [30, "Imortal"]
  ];

  // Cada conquista: [id, emoji, nome, descrição, condição(ctx)]
  const CONQUISTAS = [
    ["primeiro",    "🐣", "Primeiro Passo",      "Completa a tua primeira missão.",             (c) => c.s.concluidas >= 1],
    ["cacador",     "⚔️", "Caçador de Missões",  "Completa 10 missões ou diárias.",              (c) => c.s.concluidas >= 10],
    ["matador",     "🗡️", "Matador de Tarefas",  "Completa 50 missões ou diárias.",              (c) => c.s.concluidas >= 50],
    ["lendatarefas","🐉", "Lenda das Tarefas",   "Completa 200 missões ou diárias.",             (c) => c.s.concluidas >= 200],
    ["chamas",      "🔥", "Em Chamas",           "Faz um hábito 3 dias seguidos.",               (c) => c.s.maxSequencia >= 3],
    ["imparavel",   "🌋", "Imparável",           "Faz um hábito 7 dias seguidos.",               (c) => c.s.maxSequencia >= 7],
    ["inabalavel",  "☄️", "Inabalável",          "Faz um hábito 30 dias seguidos.",              (c) => c.s.maxSequencia >= 30],
    ["nivel2",      "⭐", "Subida de Nível",      "Chega ao nível 2.",                            (c) => c.nivel >= 2],
    ["nivel5",      "🌟", "Viajante",             "Chega ao nível 5.",                            (c) => c.nivel >= 5],
    ["nivel10",     "💫", "Campeão",              "Chega ao nível 10.",                           (c) => c.nivel >= 10],
    ["objetivo1",   "🎯", "Objetivo Cumprido",    "Conclui o teu primeiro objetivo.",             (c) => c.s.objetivos >= 1],
    ["objetivo5",   "🏰", "Conquistador(a)",      "Conclui 5 objetivos.",                         (c) => c.s.objetivos >= 5],
    ["pedemeia",    "🪙", "Pé-de-Meia",           "Junta 100 moedas de ouro.",                    (c) => c.e.ouro >= 100],
    ["merecido",    "🎁", "Merecido!",            "Compra a tua primeira recompensa.",            (c) => c.s.compras >= 1],
    ["perfeito",    "✅", "Dia Perfeito",         "Completa todas as diárias num dia.",           (c) => c.s.diasPerfeitos >= 1],
    ["madrugador",  "🌅", "Madrugador(a)",        "Completa uma missão antes das 8h.",            (c) => c.s.madrugador >= 1],
    ["coruja",      "🦉", "Coruja",               "Completa uma missão depois das 23h.",          (c) => c.s.coruja >= 1],
    ["epico",       "💎", "Feito Épico",          "Completa uma missão épica.",                   (c) => c.s.epicas >= 1],
    ["equilibrio",  "☯️", "Equilíbrio",           "Leva todos os atributos ao nível 3.",          (c) => c.atrMin >= 3],
    ["assiduo",     "📅", "Assíduo(a)",           "Ganha XP 7 dias seguidos.",                    (c) => c.diasSeguidos >= 7]
  ];
  const OURO_CONQUISTA = 25;

  // =====================================================================
  // Utilitários
  // =====================================================================
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function chave(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function hoje() { return chave(new Date()); }
  function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return chave(d); }
  function ontem() { return diasAtras(1); }
  function dataCurta(k) { const [a, m, d] = k.split("-"); return d + "/" + m + "/" + a; }

  function xpParaSubir(n) { return 100 + (n - 1) * 40; }
  function infoNivel(xp) {
    let n = 1, r = xp;
    while (r >= xpParaSubir(n)) { r -= xpParaSubir(n); n++; }
    return { nivel: n, atual: r, precisa: xpParaSubir(n) };
  }
  function infoNivelAtr(xp) {
    let n = 1, r = xp;
    while (r >= 50 * n) { r -= 50 * n; n++; }
    return { nivel: n, atual: r, precisa: 50 * n };
  }
  function titulo(nivel) {
    let t = TITULOS[0][1];
    TITULOS.forEach(([n, nome]) => { if (nivel >= n) t = nome; });
    return t;
  }
  function hpMax() { return 100 + (infoNivel(estado.xp).nivel - 1) * 5; }

  // =====================================================================
  // Estado
  // =====================================================================
  const CHAVE_STORAGE = "liferpg.estado";
  let estado = null;

  function estadoNovo(heroi) {
    const h = hoje();
    const d = (titulo, dif, atr) => ({ id: id(), titulo, dif, atr, sequencia: 0, ultimo: null, feitos: [], criada: h });
    return {
      versao: 1,
      heroi,
      xp: 0,
      ouro: 0,
      hp: 100,
      atr: { forca: 0, mente: 0, carisma: 0, disciplina: 0, espirito: 0 },
      diarias: [
        d("Beber 2 litros de água", "facil", "espirito"),
        d("30 minutos de exercício", "media", "forca"),
        d("Ler 20 páginas", "media", "mente"),
        d("Planear o dia de amanhã", "facil", "disciplina"),
        d("Mandar mensagem a alguém de quem gosto", "facil", "carisma")
      ],
      missoes: [
        { id: id(), titulo: "Marcar a consulta que ando a adiar", dif: "media", atr: "disciplina", feita: null },
        { id: id(), titulo: "Experimentar uma receita nova", dif: "media", atr: "mente", feita: null },
        { id: id(), titulo: "Arrumar o armário de uma vez por todas", dif: "dificil", atr: "disciplina", feita: null }
      ],
      objetivos: [
        { id: id(), titulo: "Correr 5 km sem parar", atr: "forca", tamanho: "grande", concluido: null,
          passos: [{ t: "Correr 1 km sem parar", f: false }, { t: "Correr 2,5 km", f: false }, { t: "Correr 4 km", f: false }, { t: "Correr 5 km", f: false }] }
      ],
      recompensas: [
        { id: id(), titulo: "Ver um episódio da minha série", custo: 30, emoji: "📺" },
        { id: id(), titulo: "Sobremesa especial", custo: 50, emoji: "🍰" },
        { id: id(), titulo: "Tarde de preguiça sem culpa", custo: 200, emoji: "🛋️" }
      ],
      conquistas: {},
      stats: { concluidas: 0, epicas: 0, objetivos: 0, compras: 0, diasPerfeitos: 0, madrugador: 0, coruja: 0, maxSequencia: 0 },
      historico: {},
      missoesDia: {},
      ultimoDia: h,
      ultimoPerfeito: null,
      som: true
    };
  }

  function carrega() {
    try {
      const t = localStorage.getItem(CHAVE_STORAGE);
      if (t) estado = JSON.parse(t);
    } catch (e) { estado = null; }
  }
  function guarda() {
    try { localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado)); } catch (e) { /* sem espaço */ }
  }

  // =====================================================================
  // Som (Web Audio, sem ficheiros)
  // =====================================================================
  let ctxAudio = null;
  function som(tipo) {
    if (!estado || !estado.som) return;
    try {
      if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
      if (ctxAudio.state !== "running") ctxAudio.resume();
      const t0 = ctxAudio.currentTime + 0.01;
      const nota = (f, t, dur, tipoOnda, vol) => {
        const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
        o.type = tipoOnda; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctxAudio.destination); o.start(t); o.stop(t + dur + 0.05);
      };
      if (tipo === "moeda") { nota(988, t0, 0.08, "square", 0.08); nota(1319, t0 + 0.07, 0.25, "square", 0.08); }
      if (tipo === "passo") { nota(660, t0, 0.1, "triangle", 0.15); nota(880, t0 + 0.06, 0.15, "triangle", 0.15); }
      if (tipo === "nivel") { [523, 659, 784, 1047, 1319].forEach((f, i) => nota(f, t0 + i * 0.09, 0.3, "square", 0.08)); nota(1568, t0 + 0.5, 0.8, "triangle", 0.15); }
      if (tipo === "conquista") { [784, 988, 1175, 1568].forEach((f, i) => nota(f, t0 + i * 0.07, 0.5, "triangle", 0.14)); }
      if (tipo === "compra") { nota(1319, t0, 0.07, "square", 0.07); nota(1760, t0 + 0.06, 0.07, "square", 0.07); nota(2093, t0 + 0.12, 0.2, "square", 0.07); }
      if (tipo === "dano") { nota(200, t0, 0.25, "sawtooth", 0.1); nota(140, t0 + 0.12, 0.35, "sawtooth", 0.1); }
    } catch (e) { /* sem áudio */ }
  }

  // =====================================================================
  // Mecânicas de jogo
  // =====================================================================
  let filaEventos = [];

  /** Dá XP, ouro e progresso no atributo. Devolve o XP efetivo. */
  function ganha(xpBase, atr, origem, contaMissao) {
    const classeAtr = CLASSES[estado.heroi.classe].atr;
    const xp = Math.round(xpBase * (atr === classeAtr ? 1.1 : 1));
    const ouro = Math.max(1, Math.round(xpBase / 2));
    const nivelAntes = infoNivel(estado.xp).nivel;
    const atrAntes = infoNivelAtr(estado.atr[atr]).nivel;

    estado.xp += xp;
    estado.atr[atr] += xp;
    estado.ouro += ouro;
    estado.hp = Math.min(hpMax(), estado.hp + 2);
    estado.historico[hoje()] = (estado.historico[hoje()] || 0) + xp;
    if (contaMissao) estado.missoesDia[hoje()] = (estado.missoesDia[hoje()] || 0) + 1;

    const h = new Date().getHours();
    if (h < 8) estado.stats.madrugador++;
    if (h >= 23) estado.stats.coruja++;

    flutua("+" + xp + " XP  +" + ouro + " 🪙", origem);
    som("moeda");

    const nivelDepois = infoNivel(estado.xp).nivel;
    if (nivelDepois > nivelAntes) {
      estado.hp = hpMax();
      filaEventos.push({ tipo: "nivel", nivel: nivelDepois });
    }
    const atrDepois = infoNivelAtr(estado.atr[atr]).nivel;
    if (atrDepois > atrAntes) filaEventos.push({ tipo: "atr", atr, nivel: atrDepois });
    return xp;
  }

  function contexto() {
    let diasSeguidos = 0;
    // Conta dias seguidos com XP, a terminar hoje ou ontem
    let inicio = estado.historico[hoje()] ? 0 : 1;
    for (let i = inicio; i < 400; i++) {
      if (estado.historico[diasAtras(i)] > 0) diasSeguidos++;
      else break;
    }
    const atrMin = Math.min(...Object.keys(ATRIBUTOS).map((k) => infoNivelAtr(estado.atr[k]).nivel));
    return { e: estado, s: estado.stats, nivel: infoNivel(estado.xp).nivel, atrMin, diasSeguidos };
  }

  function verificaConquistas() {
    // Repete porque o ouro das conquistas pode desbloquear outras
    let novas = true;
    while (novas) {
      novas = false;
      const c = contexto();
      for (const [cid, emoji, nome, desc, cond] of CONQUISTAS) {
        if (!estado.conquistas[cid] && cond(c)) {
          estado.conquistas[cid] = hoje();
          estado.ouro += OURO_CONQUISTA;
          filaEventos.push({ tipo: "conquista", emoji, nome, desc });
          novas = true;
        }
      }
    }
  }

  /** Executa uma ação com possibilidade de desfazer. */
  function acao(fn, mensagem, origem) {
    const antes = JSON.stringify(estado);
    filaEventos = [];
    fn(origem);
    verificaConquistas();
    guarda();
    render();
    if (typeof mensagem === "function") mensagem = mensagem();
    if (mensagem) toast(mensagem, () => { estado = JSON.parse(antes); guarda(); render(); });
    processaFila();
  }

  function sequenciaEfetiva(d) {
    return d.ultimo === hoje() || d.ultimo === ontem() ? d.sequencia : 0;
  }

  function completaDiaria(dId, origem) {
    const d = estado.diarias.find((x) => x.id === dId);
    if (!d || d.ultimo === hoje()) return;
    acao(() => {
      d.sequencia = d.ultimo === ontem() ? d.sequencia + 1 : 1;
      d.ultimo = hoje();
      d.feitos = (d.feitos || []).concat(hoje()).slice(-120);
      estado.stats.maxSequencia = Math.max(estado.stats.maxSequencia, d.sequencia);
      estado.stats.concluidas++;
      if (d.dif === "epica") estado.stats.epicas++;
      const bonus = Math.min(10, Math.floor(d.sequencia / 3) * 2);
      ganha(DIFICULDADES[d.dif].xp + bonus, d.atr, origem, true);
      if (estado.ultimoPerfeito !== hoje() && estado.diarias.length > 0 && estado.diarias.every((x) => x.ultimo === hoje())) {
        estado.ultimoPerfeito = hoje();
        estado.stats.diasPerfeitos++;
        filaEventos.push({ tipo: "perfeito" });
      }
    }, () => (estado.ultimoPerfeito === hoje() && filaEventos.some((e) => e.tipo === "perfeito") ? "✅ Dia perfeito! Todas as diárias feitas." : "Diária concluída!"), origem);
  }

  function completaMissao(mId, origem) {
    const m = estado.missoes.find((x) => x.id === mId);
    if (!m || m.feita) return;
    acao(() => {
      m.feita = Date.now();
      estado.stats.concluidas++;
      if (m.dif === "epica") estado.stats.epicas++;
      ganha(DIFICULDADES[m.dif].xp, m.atr, origem, true);
    }, "Missão cumprida!", origem);
  }

  function completaPasso(oId, i, origem) {
    const o = estado.objetivos.find((x) => x.id === oId);
    if (!o || o.concluido || o.passos[i].f) return;
    acao(() => {
      o.passos[i].f = true;
      ganha(XP_PASSO, o.atr, origem);
      som("passo");
      if (o.passos.every((p) => p.f)) {
        o.concluido = Date.now();
        estado.stats.objetivos++;
        ganha(TAMANHOS[o.tamanho].bonus, o.atr, origem);
        filaEventos.push({ tipo: "objetivo", titulo: o.titulo, bonus: TAMANHOS[o.tamanho].bonus });
      }
    }, "Passo concluído!", origem);
  }

  function compra(rId, origem) {
    const pocao = rId === "pocao";
    const r = pocao ? POCAO : estado.recompensas.find((x) => x.id === rId);
    if (!r || estado.ouro < r.custo) return;
    if (pocao && estado.hp >= hpMax()) { toast("Já tens a vida no máximo!"); return; }
    acao(() => {
      estado.ouro -= r.custo;
      if (pocao) {
        estado.hp = Math.min(hpMax(), estado.hp + POCAO.cura);
      } else {
        estado.stats.compras++;
        filaEventos.push({ tipo: "compra", titulo: r.titulo, emoji: r.emoji || "🎁" });
      }
      flutua("-" + r.custo + " 🪙", origem);
      som("compra");
    }, pocao ? "+" + POCAO.cura + " HP. Sentes-te revigorado(a)!" : "Recompensa comprada!", origem);
  }

  /** Passagem de dia: penaliza as diárias falhadas. */
  function processaDia() {
    if (!estado) return;
    const h = hoje();
    if (estado.ultimoDia === h) return;
    const diaAnterior = estado.ultimoDia;
    const falhadas = estado.diarias.filter((d) => d.criada <= diaAnterior && d.ultimo !== diaAnterior);
    estado.ultimoDia = h;
    filaEventos = [];
    if (falhadas.length > 0) {
      const dano = falhadas.length * PENALIZACAO_HP;
      estado.hp -= dano;
      let desmaio = null;
      if (estado.hp <= 0) {
        const perdido = Math.floor(estado.ouro * 0.25);
        estado.ouro -= perdido;
        estado.hp = hpMax();
        desmaio = perdido;
      }
      filaEventos.push({ tipo: "dano", dano, falhadas: falhadas.map((d) => d.titulo), dia: diaAnterior, desmaio });
    }
    guarda();
    render();
    processaFila();
  }

  // =====================================================================
  // Interface: avisos e animações
  // =====================================================================
  let toastTimer = null;
  function toast(texto, desfazer) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    clearTimeout(toastTimer);
    const t = document.createElement("div");
    t.className = "toast";
    const s = document.createElement("span");
    s.textContent = texto;
    t.appendChild(s);
    if (desfazer) {
      const b = document.createElement("button");
      b.textContent = "Desfazer";
      b.addEventListener("click", () => { t.remove(); desfazer(); });
      t.appendChild(b);
    }
    document.body.appendChild(t);
    toastTimer = setTimeout(() => t.remove(), desfazer ? 5000 : 2800);
  }

  function flutua(texto, origem) {
    const f = document.createElement("div");
    f.className = "flutua";
    f.textContent = texto;
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (origem && origem.getBoundingClientRect) {
      const r = origem.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top;
    }
    f.style.left = Math.max(10, Math.min(window.innerWidth - 170, x - 60)) + "px";
    f.style.top = y + "px";
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  function confetti(simbolos) {
    if (document.querySelectorAll(".particula").length > 40) return;
    for (let i = 0; i < 30; i++) {
      const c = document.createElement("div");
      c.className = "particula";
      c.textContent = simbolos[i % simbolos.length];
      c.style.left = Math.random() * 100 + "vw";
      c.style.animationDuration = 2 + Math.random() * 2 + "s";
      c.style.animationDelay = Math.random() * 0.5 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  // =====================================================================
  // Janelas (modais)
  // =====================================================================
  function abreModal(html, opcoes) {
    opcoes = opcoes || {};
    const fundo = document.createElement("div");
    fundo.className = "fundo-modal" + (opcoes.centro ? " centrado" : "");
    fundo.innerHTML = '<div class="modal' + (opcoes.centro ? " centro" : "") + '">' + html + "</div>";
    fundo.addEventListener("click", (ev) => { if (ev.target === fundo && !opcoes.fixo) fechaModal(fundo); });
    $("modais").appendChild(fundo);
    fundo._aoFechar = opcoes.aoFechar;
    return fundo.querySelector(".modal");
  }
  function fechaModal(fundo) {
    const f = fundo || $("modais").lastElementChild;
    if (!f) return;
    f.remove();
    if (f._aoFechar) f._aoFechar();
  }
  function haModal() { return $("modais").children.length > 0; }

  function processaFila() {
    if (haModal() || filaEventos.length === 0) return;
    const ev = filaEventos.shift();
    const seguinte = () => setTimeout(processaFila, 150);
    let html = "";
    if (ev.tipo === "nivel") {
      som("nivel");
      confetti(["⭐", "✨", "🌟", "💫"]);
      html = '<span class="grande-ic">🆙</span><h2>Subiste de nível!</h2>' +
        '<p>És agora <b style="color:var(--ouro)">nível ' + ev.nivel + "</b>: " + esc(titulo(ev.nivel)) + ".<br>A tua vida foi restaurada e o máximo aumentou.</p>";
    } else if (ev.tipo === "atr") {
      const a = ATRIBUTOS[ev.atr];
      toast(a.emoji + " " + a.nome + " subiu para o nível " + ev.nivel + "!");
      return seguinte();
    } else if (ev.tipo === "conquista") {
      som("conquista");
      confetti(["🏆", "✨", "⭐"]);
      html = '<span class="grande-ic">' + ev.emoji + '</span><p style="margin:0;color:var(--ouro);font-weight:800;letter-spacing:1px;text-transform:uppercase;font-size:12px">Conquista desbloqueada</p>' +
        "<h2>" + esc(ev.nome) + "</h2><p>" + esc(ev.desc) + "<br>+" + OURO_CONQUISTA + " 🪙</p>";
    } else if (ev.tipo === "objetivo") {
      som("nivel");
      confetti(["🎯", "🎉", "✨", "🏆"]);
      html = '<span class="grande-ic">🎯</span><h2>Objetivo cumprido!</h2><p>' + esc(ev.titulo) + "<br>Bónus de conclusão: +" + ev.bonus + " XP</p>";
    } else if (ev.tipo === "perfeito") {
      confetti(["✅", "✨"]);
      return seguinte();
    } else if (ev.tipo === "compra") {
      confetti([ev.emoji, "✨"]);
      html = '<span class="grande-ic">' + esc(ev.emoji) + '</span><h2>Aproveita!</h2><p>Compraste: <b style="color:var(--texto)">' + esc(ev.titulo) + "</b>.<br>Foi bem merecido.</p>";
    } else if (ev.tipo === "dano") {
      som("dano");
      html = '<span class="grande-ic">' + (ev.desmaio !== null ? "😵" : "💔") + "</span>" +
        "<h2>" + (ev.desmaio !== null ? "Desmaiaste!" : "Um novo dia começa") + "</h2>" +
        "<p>No dia " + dataCurta(ev.dia) + " ficaram por fazer " + ev.falhadas.length + (ev.falhadas.length === 1 ? " diária" : " diárias") +
        ": <b style=\"color:var(--hp)\">-" + ev.dano + " HP</b>.</p>" +
        '<p class="nota">' + ev.falhadas.slice(0, 5).map(esc).join(" · ") + "</p>" +
        (ev.desmaio !== null ? "<p>Ficaste sem vida e perdeste " + ev.desmaio + " 🪙. A tua vida foi restaurada: hoje é um novo começo!</p>" : "<p>Hoje é um novo dia. Vamos a isso!</p>");
    }
    const m = abreModal(html + '<button class="btn ouro" data-fechar>Continuar</button>', { centro: true, aoFechar: seguinte });
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
  }

  // ----- Formulários -----
  function fichasAtributo(nome, sel) {
    return '<div class="fichas">' + Object.entries(ATRIBUTOS).map(([k, a]) =>
      '<label><input type="radio" name="' + nome + '" value="' + k + '"' + (k === sel ? " checked" : "") + "><span>" + a.emoji + " " + a.nome + "</span></label>").join("") + "</div>";
  }
  function fichasDificuldade(sel) {
    return '<div class="fichas">' + Object.entries(DIFICULDADES).map(([k, d]) =>
      '<label><input type="radio" name="dif" value="' + k + '"' + (k === sel ? " checked" : "") + '><span style="color:' + d.cor + '">' + d.nome + " · " + d.xp + " XP</span></label>").join("") + "</div>";
  }
  const valor = (m, nome) => { const i = m.querySelector('input[name="' + nome + '"]:checked'); return i ? i.value : null; };

  function formMissao(tipo, item) {
    const editar = !!item;
    item = item || { titulo: "", dif: "media", atr: CLASSES[estado.heroi.classe].atr };
    const m = abreModal(
      "<h2>" + (editar ? "Editar " : "Nova ") + (tipo === "diaria" ? "diária" : "missão") + "</h2>" +
      '<div class="campo"><label for="fTitulo">' + (tipo === "diaria" ? "Hábito a repetir todos os dias" : "O que tens de fazer?") + "</label>" +
      '<input type="text" id="fTitulo" maxlength="80" placeholder="' + (tipo === "diaria" ? "Ex.: Meditar 10 minutos" : "Ex.: Entregar o relatório") + '" value="' + esc(item.titulo) + '"></div>' +
      (editar ? "" : '<div class="campo"><span class="lbl">Tipo</span><div class="fichas"><label><input type="radio" name="tipo" value="diaria"' + (tipo === "diaria" ? " checked" : "") + '><span>🔁 Diária</span></label><label><input type="radio" name="tipo" value="missao"' + (tipo === "missao" ? " checked" : "") + "><span>⚔️ Missão única</span></label></div></div>") +
      '<div class="campo"><span class="lbl">Dificuldade</span>' + fichasDificuldade(item.dif) + "</div>" +
      '<div class="campo"><span class="lbl">Atributo que treina</span>' + fichasAtributo("atr", item.atr) + "</div>" +
      '<button class="btn" id="fGuardar">' + (editar ? "Guardar" : "Adicionar") + "</button>" +
      (editar ? '<button class="btn perigo" id="fApagar">Apagar</button>' : "") +
      '<button class="btn neutro" data-fechar>Cancelar</button>'
    );
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
    m.querySelector("#fGuardar").addEventListener("click", () => {
      const t = m.querySelector("#fTitulo").value.trim();
      if (!t) { m.querySelector("#fTitulo").focus(); toast("Dá um nome à " + (tipo === "diaria" ? "diária" : "missão") + "."); return; }
      const dif = valor(m, "dif"), atr = valor(m, "atr");
      const tipoFinal = editar ? tipo : valor(m, "tipo");
      if (editar) {
        Object.assign(item, { titulo: t, dif, atr });
      } else if (tipoFinal === "diaria") {
        estado.diarias.push({ id: id(), titulo: t, dif, atr, sequencia: 0, ultimo: null, feitos: [], criada: hoje() });
      } else {
        estado.missoes.push({ id: id(), titulo: t, dif, atr, feita: null });
      }
      if (!editar) segMissoes = tipoFinal === "diaria" ? "diarias" : "missoes";
      guarda(); fechaModal(); render();
    });
    if (editar) {
      m.querySelector("#fApagar").addEventListener("click", () => {
        const lista = tipo === "diaria" ? "diarias" : "missoes";
        const antes = JSON.stringify(estado);
        estado[lista] = estado[lista].filter((x) => x.id !== item.id);
        guarda(); fechaModal(); render();
        toast("Apagada.", () => { estado = JSON.parse(antes); guarda(); render(); });
      });
    }
    if (!editar) setTimeout(() => m.querySelector("#fTitulo").focus(), 250);
  }

  function formObjetivo(item) {
    const editar = !!item;
    item = item || { titulo: "", atr: CLASSES[estado.heroi.classe].atr, tamanho: "pequeno", passos: [{ t: "", f: false }, { t: "", f: false }] };
    const linhaPasso = (p) => '<div class="linha"><input type="text" maxlength="80" placeholder="Passo" value="' + esc(p.t) + '"' + (p.f ? ' data-feito="1"' : "") + '><button type="button" data-remover aria-label="Remover passo">✕</button></div>';
    const m = abreModal(
      "<h2>" + (editar ? "Editar objetivo" : "Novo objetivo") + "</h2>" +
      '<div class="campo"><label for="oTitulo">Objetivo de longo prazo</label><input type="text" id="oTitulo" maxlength="80" placeholder="Ex.: Aprender a tocar guitarra" value="' + esc(item.titulo) + '"></div>' +
      '<div class="campo"><span class="lbl">Passos (cada um vale ' + XP_PASSO + ' XP)</span><div class="passos-form" id="oPassos">' + item.passos.map(linhaPasso).join("") +
      '</div><button type="button" class="add-passo" id="oAdd" style="width:100%;margin-top:8px">+ Adicionar passo</button></div>' +
      '<div class="campo"><span class="lbl">Tamanho (bónus ao concluir)</span><div class="fichas">' + Object.entries(TAMANHOS).map(([k, t]) =>
        '<label><input type="radio" name="tam" value="' + k + '"' + (k === item.tamanho ? " checked" : "") + "><span>" + t.nome + " · +" + t.bonus + " XP</span></label>").join("") + "</div></div>" +
      '<div class="campo"><span class="lbl">Atributo</span>' + fichasAtributo("oatr", item.atr) + "</div>" +
      '<button class="btn" id="oGuardar">' + (editar ? "Guardar" : "Criar objetivo") + "</button>" +
      (editar ? '<button class="btn perigo" id="oApagar">Apagar</button>' : "") +
      '<button class="btn neutro" data-fechar>Cancelar</button>'
    );
    const caixa = m.querySelector("#oPassos");
    caixa.addEventListener("click", (ev) => {
      if (ev.target.matches("[data-remover]") && caixa.children.length > 1) ev.target.parentElement.remove();
    });
    m.querySelector("#oAdd").addEventListener("click", () => {
      caixa.insertAdjacentHTML("beforeend", linhaPasso({ t: "", f: false }));
      caixa.lastElementChild.querySelector("input").focus();
    });
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
    m.querySelector("#oGuardar").addEventListener("click", () => {
      const t = m.querySelector("#oTitulo").value.trim();
      const passos = [...caixa.querySelectorAll("input")].map((i) => ({ t: i.value.trim(), f: i.dataset.feito === "1" })).filter((p) => p.t);
      if (!t) { toast("Dá um nome ao objetivo."); return; }
      if (passos.length === 0) { toast("Adiciona pelo menos um passo."); return; }
      const dados = { titulo: t, passos, tamanho: valor(m, "tam"), atr: valor(m, "oatr") };
      if (editar) {
        Object.assign(item, dados);
        if (!item.concluido && passos.every((p) => p.f)) {
          // Ao remover os passos que faltavam, o objetivo fica cumprido
          fechaModal();
          acao(() => {
            item.concluido = Date.now();
            estado.stats.objetivos++;
            ganha(TAMANHOS[item.tamanho].bonus, item.atr);
            filaEventos.push({ tipo: "objetivo", titulo: item.titulo, bonus: TAMANHOS[item.tamanho].bonus });
          }, "Objetivo concluído!");
          return;
        }
      } else {
        estado.objetivos.push(Object.assign({ id: id(), concluido: null }, dados));
      }
      guarda(); fechaModal(); render();
    });
    if (editar) {
      m.querySelector("#oApagar").addEventListener("click", () => {
        const antes = JSON.stringify(estado);
        estado.objetivos = estado.objetivos.filter((x) => x.id !== item.id);
        guarda(); fechaModal(); render();
        toast("Objetivo apagado.", () => { estado = JSON.parse(antes); guarda(); render(); });
      });
    }
  }

  const EMOJIS_RECOMPENSA = ["🎁", "📺", "🍰", "🍕", "🎮", "🛋️", "☕", "🍦", "🎬", "📚", "🛍️", "🏖️"];
  function formRecompensa(item) {
    const editar = !!item;
    item = item || { titulo: "", custo: 50, emoji: "🎁" };
    const m = abreModal(
      "<h2>" + (editar ? "Editar recompensa" : "Nova recompensa") + "</h2>" +
      '<p class="nota" style="margin-top:-6px">Mimos reais que podes comprar com o ouro ganho nas missões.</p>' +
      '<div class="campo"><label for="rTitulo">Recompensa</label><input type="text" id="rTitulo" maxlength="60" placeholder="Ex.: Jantar fora" value="' + esc(item.titulo) + '"></div>' +
      '<div class="campo"><label for="rCusto">Custo em ouro</label><input type="number" id="rCusto" min="1" max="99999" inputmode="numeric" value="' + item.custo + '"></div>' +
      '<div class="campo"><span class="lbl">Ícone</span><div class="fichas avatares">' + EMOJIS_RECOMPENSA.map((e) =>
        '<label><input type="radio" name="remoji" value="' + e + '"' + (e === item.emoji ? " checked" : "") + "><span>" + e + "</span></label>").join("") + "</div></div>" +
      '<button class="btn" id="rGuardar">' + (editar ? "Guardar" : "Adicionar") + "</button>" +
      (editar ? '<button class="btn perigo" id="rApagar">Apagar</button>' : "") +
      '<button class="btn neutro" data-fechar>Cancelar</button>'
    );
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
    m.querySelector("#rGuardar").addEventListener("click", () => {
      const t = m.querySelector("#rTitulo").value.trim();
      const c = parseInt(m.querySelector("#rCusto").value, 10);
      if (!t) { toast("Dá um nome à recompensa."); return; }
      if (!(c > 0)) { toast("Indica um custo válido."); return; }
      const dados = { titulo: t, custo: c, emoji: valor(m, "remoji") || "🎁" };
      if (editar) Object.assign(item, dados);
      else estado.recompensas.push(Object.assign({ id: id() }, dados));
      guarda(); fechaModal(); render();
    });
    if (editar) {
      m.querySelector("#rApagar").addEventListener("click", () => {
        estado.recompensas = estado.recompensas.filter((x) => x.id !== item.id);
        guarda(); fechaModal(); render();
      });
    }
  }

  function formDefinicoes() {
    const m = abreModal(
      "<h2>Definições</h2>" +
      '<div class="campo"><label for="dNome">Nome do herói</label><input type="text" id="dNome" maxlength="24" value="' + esc(estado.heroi.nome) + '"></div>' +
      '<div class="campo"><span class="lbl">Avatar</span><div class="fichas avatares">' + AVATARES.map((a) =>
        '<label><input type="radio" name="davatar" value="' + a + '"' + (a === estado.heroi.avatar ? " checked" : "") + "><span>" + a + "</span></label>").join("") + "</div></div>" +
      '<div class="campo"><span class="lbl">Som</span><div class="fichas"><label><input type="radio" name="dsom" value="1"' + (estado.som ? " checked" : "") + '><span>🔊 Ligado</span></label><label><input type="radio" name="dsom" value="0"' + (estado.som ? "" : " checked") + "><span>🔇 Desligado</span></label></div></div>" +
      '<button class="btn" id="dGuardar">Guardar</button>' +
      "<h3>Cópia de segurança</h3>" +
      '<p class="nota">O progresso fica guardado só neste telemóvel. Exporta uma cópia para não o perderes se mudares de telemóvel.</p>' +
      '<button class="btn neutro" id="dExportar">📤 Exportar progresso</button>' +
      '<button class="btn neutro" id="dImportar">📥 Importar progresso</button>' +
      "<h3>Zona de perigo</h3>" +
      '<button class="btn perigo" id="dReset">Recomeçar do zero</button>' +
      '<button class="btn neutro" data-fechar style="margin-top:18px">Fechar</button>'
    );
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
    m.querySelector("#dGuardar").addEventListener("click", () => {
      const n = m.querySelector("#dNome").value.trim();
      if (n) estado.heroi.nome = n;
      estado.heroi.avatar = valor(m, "davatar") || estado.heroi.avatar;
      estado.som = valor(m, "dsom") === "1";
      guarda(); fechaModal(); render(); toast("Guardado.");
    });
    m.querySelector("#dExportar").addEventListener("click", () => {
      const texto = JSON.stringify(estado);
      if (window.AndroidApp && window.AndroidApp.share) window.AndroidApp.share(texto);
      else if (navigator.clipboard) navigator.clipboard.writeText(texto).then(() => toast("Copiado para a área de transferência."));
    });
    m.querySelector("#dImportar").addEventListener("click", () => {
      const m2 = abreModal(
        "<h2>Importar progresso</h2>" +
        '<p class="nota">Cola aqui o texto exportado anteriormente. Isto substitui o progresso atual.</p>' +
        '<div class="campo"><textarea id="iTexto" placeholder="{&quot;versao&quot;:1, ...}"></textarea></div>' +
        '<button class="btn" id="iOk">Importar</button><button class="btn neutro" data-fechar>Cancelar</button>'
      );
      m2.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
      m2.querySelector("#iOk").addEventListener("click", () => {
        try {
          const novo = JSON.parse(m2.querySelector("#iTexto").value);
          if (!novo || !novo.heroi || typeof novo.xp !== "number" || !Array.isArray(novo.diarias)) throw new Error();
          estado = migra(novo);
          guarda();
          fechaModal(); fechaModal();
          render(); toast("Progresso importado!");
        } catch (e) { toast("Esse texto não é uma cópia válida."); }
      });
    });
    m.querySelector("#dReset").addEventListener("click", () => {
      const m2 = abreModal(
        '<span class="grande-ic">⚠️</span><h2>Recomeçar do zero?</h2><p>Vais perder todo o XP, ouro, missões e conquistas. Isto não pode ser desfeito.</p>' +
        '<button class="btn perigo" id="rSim">Sim, apagar tudo</button><button class="btn neutro" data-fechar>Cancelar</button>', { centro: true });
      m2.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
      m2.querySelector("#rSim").addEventListener("click", () => {
        try { localStorage.removeItem(CHAVE_STORAGE); } catch (e) { /* ignora */ }
        estado = null;
        $("modais").innerHTML = "";
        arranca();
      });
    });
  }

  // =====================================================================
  // Desenho dos ecrãs
  // =====================================================================
  let separador = "heroi";
  let segMissoes = "diarias";
  let mostrarFeitas = false;
  let mostrarObjConcluidos = false;

  function render() {
    if (!estado) return;
    renderTopo();
    renderHeroi();
    renderMissoes();
    renderObjetivos();
    renderConquistas();
    renderLoja();
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("ativo", b.dataset.sep === separador));
    document.querySelectorAll(".separador").forEach((s) => s.classList.toggle("ativo", s.id === "sep-" + separador));
    $("fab").classList.toggle("escondido", !["missoes", "objetivos", "loja"].includes(separador));
    $("btnOraculo").classList.toggle("escondido", separador !== "heroi");
    const porFazer = estado.diarias.filter((d) => d.ultimo !== hoje()).length;
    $("pontoMissoes").textContent = porFazer;
    $("pontoMissoes").classList.toggle("escondido", porFazer === 0);
  }

  const TITULOS_SEP = { heroi: "Dashboard", missoes: "Missões", objetivos: "Objetivos", conquistas: "Conquistas", loja: "Loja" };
  function renderTopo() {
    const n = infoNivel(estado.xp);
    $("tTitulo").textContent = TITULOS_SEP[separador];
    $("tNivel").textContent = estado.heroi.avatar + " Nv " + n.nivel;
    $("tOuro").textContent = "🪙 " + estado.ouro;
    $("tXpBarra").style.width = (n.atual / n.precisa * 100) + "%";
  }

  const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  function ultimosDias(n) {
    const r = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      r.push({ k: chave(d), nome: NOMES_DIAS[d.getDay()], hoje: i === 0 });
    }
    return r;
  }

  /** Curva suave (Catmull-Rom para Bézier) pelos pontos dados. */
  function caminhoSuave(pts) {
    let d = "M" + pts[0][0] + "," + pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += " C" + c1.map((v) => v.toFixed(1)).join(",") + " " + c2.map((v) => v.toFixed(1)).join(",") + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }

  function graficoXp(dias) {
    const W = 340, H = 190, esq = 30, dir = 8, cima = 10, baixo = 26;
    const vals = dias.map((d) => estado.historico[d.k] || 0);
    const max = Math.max(40, ...vals);
    const passo = Math.ceil(max / 4 / 10) * 10;
    const topo = passo * 4;
    const x = (i) => esq + i * (W - esq - dir) / (dias.length - 1);
    const y = (v) => cima + (H - cima - baixo) * (1 - v / topo);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const linha = caminhoSuave(pts);
    const area = linha + " L" + x(dias.length - 1) + "," + y(0) + " L" + x(0) + "," + y(0) + " Z";
    const iMax = vals.indexOf(Math.max(...vals));
    let grelha = "";
    for (let g = 0; g <= 4; g++) {
      const v = passo * g;
      grelha += '<line x1="' + esq + '" x2="' + (W - dir) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="rgba(255,255,255,.06)"/>' +
        '<text x="0" y="' + (y(v) + 4) + '" fill="#6b717c" font-size="10">' + v + "</text>";
    }
    const rotulos = dias.map((d, i) => '<text x="' + x(i) + '" y="' + (H - 6) + '" fill="' + (d.hoje ? "#f2f4f7" : "#6b717c") + '" font-size="10" text-anchor="middle">' + (d.hoje ? "Hoje" : d.nome) + "</text>").join("");
    const marca = vals[iMax] > 0
      ? '<line x1="' + pts[iMax][0] + '" x2="' + pts[iMax][0] + '" y1="' + pts[iMax][1] + '" y2="' + y(0) + '" stroke="rgba(255,255,255,.18)"/>' +
        '<circle cx="' + pts[iMax][0] + '" cy="' + pts[iMax][1] + '" r="5" fill="#050608" stroke="#f2f4f7" stroke-width="2"/>'
      : "";
    return '<svg class="grafico-svg" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="gLinha" x1="0" x2="1"><stop offset="0" stop-color="#19b8ff"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ff4d6d"/></linearGradient>' +
      '<linearGradient id="gArea" x1="0" x2="1"><stop offset="0" stop-color="#19b8ff"/><stop offset="1" stop-color="#ff4d6d"/></linearGradient>' +
      '<linearGradient id="gFade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<mask id="mFade"><rect width="' + W + '" height="' + H + '" fill="url(#gFade)"/></mask>' +
      '<filter id="fBrilho" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4"/></filter></defs>' +
      grelha +
      '<path d="' + area + '" fill="url(#gArea)" mask="url(#mFade)"/>' +
      '<path d="' + linha + '" fill="none" stroke="url(#gLinha)" stroke-width="5" opacity=".55" filter="url(#fBrilho)"/>' +
      '<path d="' + linha + '" fill="none" stroke="url(#gLinha)" stroke-width="2.5" stroke-linecap="round"/>' +
      marca + rotulos + "</svg>";
  }

  function renderHeroi() {
    const n = infoNivel(estado.xp);
    const cl = CLASSES[estado.heroi.classe];
    const feitasHoje = estado.diarias.filter((d) => d.ultimo === hoje()).length;
    const c = contexto();
    const pct = Math.round(n.atual / n.precisa * 100);
    const dias = ultimosDias(7);
    const xpSemana = dias.reduce((s, d) => s + (estado.historico[d.k] || 0), 0);
    const missoesSemana = dias.reduce((s, d) => s + ((estado.missoesDia || {})[d.k] || 0), 0);
    const desbloqueadas = Object.keys(estado.conquistas).length;
    const hpPct = Math.max(0, estado.hp / hpMax() * 100);

    // Grelha de hábitos: uma linha por diária, uma coluna por dia
    let grelha = '<div class="habitos" style="grid-template-columns: minmax(100px, 2.6fr) repeat(7, minmax(22px, 1fr))"><span></span>' +
      dias.map((d) => '<span class="dia' + (d.hoje ? " hoje" : "") + '">' + d.nome.slice(0, 3) + "</span>").join("");
    estado.diarias.slice(0, 7).forEach((h) => {
      const cor = ATRIBUTOS[h.atr].cor;
      grelha += '<span class="nome">' + esc(h.titulo) + "</span>" +
        dias.map((d) => '<span class="ponto' + ((h.feitos || []).includes(d.k) ? " on" : "") + '" style="--c:' + cor + '"></span>').join("");
    });
    grelha += "</div>";

    let atributos = "";
    for (const [k, a] of Object.entries(ATRIBUTOS)) {
      const i = infoNivelAtr(estado.atr[k]);
      atributos += '<div class="atributo"><div class="ic">' + a.emoji + '</div><div class="meio">' +
        '<div class="cima"><span style="color:var(--texto)">' + a.nome + (k === cl.atr ? ' <span style="color:var(--verde);font-size:12px">★ classe</span>' : "") + "</span><span>Nv " + i.nivel + "</span></div>" +
        "<small>" + a.desc + " · " + i.atual + "/" + i.precisa + '</small><div class="barra"><div style="width:' + (i.atual / i.precisa * 100) + "%;background:" + a.cor + ";color:" + a.cor + '"></div></div></div></div>';
    }

    $("sep-heroi").innerHTML =
      '<div class="perfil"><div class="av">' + estado.heroi.avatar + '</div><div style="flex:1;min-width:0">' +
        '<div class="nome">' + esc(estado.heroi.nome) + '</div><div class="sub"><b>' + esc(titulo(n.nivel)) + "</b> · " + cl.emoji + " " + cl.nome + "</div></div>" +
        '<button class="icone-btn" data-acao="definicoes" aria-label="Definições"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button></div>' +

      '<div class="cartao brilho"><div class="cab-cartao"><h4>Progresso de nível</h4><span>Nv ' + n.nivel + " → " + (n.nivel + 1) + "</span></div>" +
        '<div class="foco"><div class="anel" style="--p:' + pct + '%"><div class="trilho"></div><div class="glow"></div><div class="arco"></div><div class="interior"></div>' +
          '<div class="valor"><div><b>' + pct + "%</b><small>" + n.atual + "/" + n.precisa + " XP</small></div></div></div>" +
          '<div class="dados"><div><span>Diárias hoje:</span><b>' + feitasHoje + " de " + estado.diarias.length + "</b></div>" +
          "<div><span>Ritmo:</span><b>" + (c.diasSeguidos >= 3 ? "Em chamas 🔥" : xpSemana >= 150 ? "Alto" : xpSemana > 0 ? "A aquecer" : "Por começar") + "</b></div></div></div></div>" +

      '<div class="grelha-2" style="margin-top:12px">' +
        '<div class="cartao mini"><div class="rot"><i style="color:var(--hp);background:var(--hp)"></i>Vida</div><div class="num">' + estado.hp + "<small> / " + hpMax() + '</small></div><div class="barra hp"><div style="width:' + hpPct + '%"></div></div></div>' +
        '<div class="cartao mini"><div class="rot"><i style="color:var(--ouro);background:var(--ouro)"></i>Ouro</div><div class="num">' + estado.ouro + '<small> 🪙</small></div><div class="nota" style="font-size:12px">Gasta na loja</div></div>' +
        '<div class="cartao mini"><div class="rot"><i style="color:var(--laranja);background:var(--laranja)"></i>Dias seguidos</div><div class="num">' + c.diasSeguidos + '<small> 🔥</small></div><div class="nota" style="font-size:12px">A ganhar XP</div></div>' +
        '<div class="cartao mini"><div class="rot"><i style="color:var(--verde);background:var(--verde)"></i>Conquistas</div><div class="num">' + desbloqueadas + "<small> / " + CONQUISTAS.length + '</small></div><div class="barra xp"><div style="width:' + (desbloqueadas / CONQUISTAS.length * 100) + '%"></div></div></div>' +
      "</div>" +

      '<div class="cartao" style="margin-top:12px"><div class="cab-cartao"><h4>Grelha de hábitos</h4><span>7 dias</span></div>' +
        (estado.diarias.length ? grelha : '<p class="nota" style="margin:0">Cria diárias para veres aqui os teus hábitos.</p>') + "</div>" +

      '<div class="cartao" style="margin-top:12px"><div class="cab-cartao" style="align-items:flex-start"><h4>Evolução</h4>' +
        '<div class="legenda"><div><span><i style="background:var(--ciano)"></i>XP</span><b>' + xpSemana + '</b></div><div><span><i style="background:var(--hp)"></i>Missões</span><b>' + missoesSemana + "</b></div></div></div>" +
        graficoXp(dias) + "</div>" +

      '<h3>Atributos</h3><div class="cartao">' + atributos + "</div>" +

      "<h3>Como funciona</h3>" +
      '<div class="cartao nota">Completa <b>diárias</b> (hábitos) e <b>missões</b> para ganhar XP e ouro. Cada uma treina um atributo; o da tua classe rende +10% XP. ' +
      "Divide os grandes sonhos em <b>objetivos</b> com passos. Diárias falhadas tiram " + PENALIZACAO_HP + " HP no dia seguinte. Gasta o ouro na <b>loja</b> em recompensas reais. " +
      "Toca no 🔮 para pedir conselhos ao Oráculo.</div>";
  }

  // =====================================================================
  // Oráculo: assistente com conselhos gerados a partir do teu progresso
  // =====================================================================
  const FRASES_MOTIVACAO = [
    "Os heróis não nascem prontos. Sobem de nível uma missão de cada vez.",
    "Um pequeno passo hoje vale mais do que um plano perfeito para amanhã.",
    "O dragão mais difícil é começar. Depois de começares, já ganhaste metade da batalha.",
    "Disciplina é escolher o que queres mais em vez do que queres agora.",
    "Até as lendas tiveram um dia 1. O teu progresso conta, mesmo quando parece pouco.",
    "Faz hoje aquilo que o teu eu de amanhã vai agradecer.",
    "Não precisas de ser perfeito(a). Precisas de aparecer."
  ];

  function respostaOraculo(pergunta) {
    const n = infoNivel(estado.xp);
    const c = contexto();
    const porFazer = estado.diarias.filter((d) => d.ultimo !== hoje());
    const missoes = estado.missoes.filter((m) => !m.feita);
    const fraco = Object.keys(ATRIBUTOS).sort((a, b) => estado.atr[a] - estado.atr[b])[0];
    const forte = Object.keys(ATRIBUTOS).sort((a, b) => estado.atr[b] - estado.atr[a])[0];

    if (pergunta === "agora") {
      const doFraco = porFazer.find((d) => d.atr === fraco) || missoes.find((m) => m.atr === fraco);
      const alvo = doFraco || porFazer[0] || missoes[0];
      if (!alvo) return "Não tens nada pendente. Que tal criar uma missão nova ou dar um passo num objetivo? 🎯";
      const tipo = estado.diarias.includes(alvo) ? "diária" : "missão";
      return "Sugiro a " + tipo + " \"" + alvo.titulo + "\" (+" + DIFICULDADES[alvo.dif].xp + " XP)." +
        (alvo.atr === fraco ? "\nTreina " + ATRIBUTOS[fraco].emoji + " " + ATRIBUTOS[fraco].nome + ", o teu atributo mais fraco." : "") +
        (porFazer.length > 1 ? "\nAinda tens " + porFazer.length + " diárias por fazer hoje." : "");
    }
    if (pergunta === "semana") {
      const dias = ultimosDias(7);
      const xp = dias.reduce((s, d) => s + (estado.historico[d.k] || 0), 0);
      const ativos = dias.filter((d) => estado.historico[d.k] > 0).length;
      let r = "Esta semana ganhaste " + xp + " XP em " + ativos + (ativos === 1 ? " dia" : " dias") + ".\n" +
        "Ponto forte: " + ATRIBUTOS[forte].emoji + " " + ATRIBUTOS[forte].nome + ". A melhorar: " + ATRIBUTOS[fraco].emoji + " " + ATRIBUTOS[fraco].nome + ".";
      if (c.diasSeguidos >= 3) r += "\nEstás com " + c.diasSeguidos + " dias seguidos. Não quebres a corrente! 🔥";
      if (estado.hp < hpMax() * 0.4) r += "\n⚠️ A tua vida está baixa (" + estado.hp + " HP). Faz as diárias ou compra uma poção.";
      return r;
    }
    if (pergunta === "nivel") {
      const falta = n.precisa - n.atual;
      const media = Math.ceil(falta / DIFICULDADES.media.xp);
      return "Faltam " + falta + " XP para o nível " + (n.nivel + 1) + ".\nIsso são cerca de " + media + (media === 1 ? " missão média" : " missões médias") + "." +
        (titulo(n.nivel + 1) !== titulo(n.nivel) ? "\nNo próximo nível ganhas o título \"" + titulo(n.nivel + 1) + "\"! ✨" : "");
    }
    return FRASES_MOTIVACAO[Math.floor(Math.random() * FRASES_MOTIVACAO.length)] + " 💪";
  }

  function abreOraculo() {
    const m = abreModal(
      '<div class="cab-chat"><div class="av">🔮</div><div><h2>Oráculo</h2><small>Conselhos com base no teu progresso</small></div>' +
      '<button class="icone-btn fechar" data-fechar aria-label="Fechar">✕</button></div>' +
      '<div class="chat" id="chat"></div>' +
      '<div class="sugestoes">' +
        '<button data-p="agora">O que faço agora?</button>' +
        '<button data-p="semana">Como estou esta semana?</button>' +
        '<button data-p="nivel">Quanto falta para subir?</button>' +
        '<button data-p="motiva">Motiva-me</button>' +
      "</div>"
    );
    const chat = m.querySelector("#chat");
    const bolha = (texto, quem) => {
      const b = document.createElement("div");
      b.className = "bolha " + quem;
      b.textContent = texto;
      chat.appendChild(b);
      chat.scrollTop = chat.scrollHeight;
      return b;
    };
    bolha("Saudações, " + estado.heroi.nome + "! Sou o Oráculo. Em que te posso ajudar na tua aventura?", "oraculo");
    m.querySelector("[data-fechar]").addEventListener("click", () => fechaModal());
    m.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => {
      bolha(b.textContent, "eu");
      const pensa = bolha("•••", "oraculo escrever");
      setTimeout(() => { pensa.remove(); bolha(respostaOraculo(b.dataset.p), "oraculo"); }, 650);
    }));
  }

  function etiquetas(item, extra) {
    const d = DIFICULDADES[item.dif], a = ATRIBUTOS[item.atr];
    return '<div class="etiquetas"><span class="etq" style="color:' + d.cor + '">' + d.nome + '</span><span class="etq">' + a.emoji + " " + a.nome + '</span><span class="etq xp">+' + d.xp + " XP</span>" + (extra || "") + "</div>";
  }

  function renderMissoes() {
    let html = '<h2>Missões</h2><div class="segmentos">' +
      '<button data-seg="diarias" class="' + (segMissoes === "diarias" ? "ativo" : "") + '">🔁 Diárias</button>' +
      '<button data-seg="missoes" class="' + (segMissoes === "missoes" ? "ativo" : "") + '">⚔️ Missões</button></div>';

    if (segMissoes === "diarias") {
      if (estado.diarias.length === 0) {
        html += '<div class="vazio"><span class="grande">🔁</span>Ainda não tens diárias.<br>Cria hábitos para repetir todos os dias.</div>';
      } else {
        const ordenadas = estado.diarias.slice().sort((a, b) => (a.ultimo === hoje()) - (b.ultimo === hoje()));
        html += '<div class="lista">' + ordenadas.map((d) => {
          const feita = d.ultimo === hoje();
          const seq = sequenciaEfetiva(d);
          return '<div class="missao' + (feita ? " feita" : "") + '" style="--cor:' + ATRIBUTOS[d.atr].cor + '">' +
            '<button class="check" data-acao="diaria" data-id="' + d.id + '" aria-label="Concluir">' + (feita ? "✓" : "") + "</button>" +
            '<button class="corpo" data-acao="editar-diaria" data-id="' + d.id + '"><div class="titulo">' + esc(d.titulo) + "</div>" +
            etiquetas(d, seq > 0 ? '<span class="etq fogo">🔥 ' + seq + (seq === 1 ? " dia" : " dias") + "</span>" : "") + "</button></div>";
        }).join("") + "</div>";
        html += '<p class="nota" style="text-align:center;margin-top:14px">Toca no círculo para concluir. Toca no texto para editar.</p>';
      }
    } else {
      const ativas = estado.missoes.filter((m) => !m.feita);
      const feitas = estado.missoes.filter((m) => m.feita).sort((a, b) => b.feita - a.feita);
      if (ativas.length === 0) {
        html += '<div class="vazio"><span class="grande">⚔️</span>Nenhuma missão ativa.<br>Carrega no + para criar uma.</div>';
      } else {
        html += '<div class="lista">' + ativas.map((m) =>
          '<div class="missao" style="--cor:' + ATRIBUTOS[m.atr].cor + '">' +
          '<button class="check" data-acao="missao" data-id="' + m.id + '" aria-label="Concluir"></button>' +
          '<button class="corpo" data-acao="editar-missao" data-id="' + m.id + '"><div class="titulo">' + esc(m.titulo) + "</div>" + etiquetas(m) + "</button></div>").join("") + "</div>";
      }
      if (feitas.length) {
        html += '<button class="dobra" data-acao="ver-feitas">' + (mostrarFeitas ? "▾" : "▸") + " Concluídas (" + feitas.length + ")</button>";
        if (mostrarFeitas) {
          html += '<div class="lista">' + feitas.slice(0, 30).map((m) =>
            '<div class="missao feita" style="--cor:' + ATRIBUTOS[m.atr].cor + '"><span class="check">✓</span>' +
            '<button class="corpo" data-acao="editar-missao" data-id="' + m.id + '"><div class="titulo">' + esc(m.titulo) + "</div>" + etiquetas(m) + "</button></div>").join("") + "</div>";
        }
      }
    }
    $("sep-missoes").innerHTML = html;
  }

  function renderObjetivos() {
    const ativos = estado.objetivos.filter((o) => !o.concluido);
    const concluidos = estado.objetivos.filter((o) => o.concluido);
    const cartao = (o) => {
      const a = ATRIBUTOS[o.atr];
      const feitos = o.passos.filter((p) => p.f).length;
      return '<div class="objetivo' + (o.concluido ? " concluido" : "") + '" style="--cor:' + a.cor + '">' +
        '<div class="cab"><span class="ic">' + (o.concluido ? "🏆" : "🎯") + '</span><div class="info"><div class="titulo">' + esc(o.titulo) + "</div>" +
        '<div class="etiquetas"><span class="etq">' + a.emoji + " " + a.nome + '</span><span class="etq xp">' + TAMANHOS[o.tamanho].nome + " · +" + TAMANHOS[o.tamanho].bonus + " XP</span></div></div>" +
        (o.concluido ? "" : '<button class="editar" data-acao="editar-objetivo" data-id="' + o.id + '" aria-label="Editar">✏️</button>') + "</div>" +
        '<div class="progresso"><span>Progresso</span><span>' + feitos + "/" + o.passos.length + "</span></div>" +
        '<div class="barra"><div style="width:' + (feitos / o.passos.length * 100) + "%;background:" + a.cor + '"></div></div>' +
        '<div style="margin-top:8px">' + o.passos.map((p, i) =>
          '<button class="passo' + (p.f ? " feito" : "") + '" data-acao="passo" data-id="' + o.id + '" data-i="' + i + '"><span class="caixa">' + (p.f ? "✓" : "") + "</span><span>" + esc(p.t) + "</span></button>").join("") +
        "</div></div>";
    };
    let html = "<h2>Objetivos</h2>";
    html += ativos.length ? '<div class="lista">' + ativos.map(cartao).join("") + "</div>"
      : '<div class="vazio"><span class="grande">🎯</span>Sem objetivos ativos.<br>Divide um grande sonho em passos pequenos.</div>';
    if (concluidos.length) {
      html += '<button class="dobra" data-acao="ver-objetivos">' + (mostrarObjConcluidos ? "▾" : "▸") + " Concluídos (" + concluidos.length + ")</button>";
      if (mostrarObjConcluidos) html += '<div class="lista">' + concluidos.map(cartao).join("") + "</div>";
    }
    $("sep-objetivos").innerHTML = html;
  }

  function renderConquistas() {
    const total = CONQUISTAS.length;
    const feitas = Object.keys(estado.conquistas).length;
    $("sep-conquistas").innerHTML =
      "<h2>Conquistas</h2>" +
      '<div class="cartao" style="margin-bottom:14px"><div class="rotulo-barra" style="margin-top:0"><span>Desbloqueadas</span><b>' + feitas + " / " + total + "</b></div>" +
      '<div class="barra xp grossa"><div style="width:' + (feitas / total * 100) + '%"></div></div>' +
      '<p class="nota" style="margin:10px 0 0">Cada conquista dá +' + OURO_CONQUISTA + " 🪙.</p></div>" +
      '<div class="grelha">' + CONQUISTAS.map(([cid, emoji, nome, desc]) => {
        const data = estado.conquistas[cid];
        return '<div class="conquista ' + (data ? "desbloqueada" : "bloqueada") + '"><span class="ic">' + emoji + "</span><b>" + nome + "</b><small>" + desc + "</small>" +
          (data ? '<div class="data">' + dataCurta(data) + "</div>" : "") + "</div>";
      }).join("") + "</div>";
  }

  function renderLoja() {
    const cheio = estado.hp >= hpMax();
    let html = "<h2>Loja</h2>" +
      '<div class="cartao saldo" style="margin-bottom:14px"><span class="nota">O teu ouro</span><b>🪙 ' + estado.ouro + '</b><span class="nota">Ganhas ouro ao completar missões e conquistas.</span></div>' +
      "<h3>Itens</h3>" +
      '<div class="item"><div class="ic">🧪</div><div class="corpo"><b>' + POCAO.titulo + "</b><small>Recupera " + POCAO.cura + " HP</small></div>" +
      '<button class="comprar" data-acao="comprar" data-id="pocao"' + (estado.ouro < POCAO.custo || cheio ? " disabled" : "") + ">🪙 " + POCAO.custo + "</button></div>" +
      "<h3>As tuas recompensas</h3>";
    if (estado.recompensas.length === 0) {
      html += '<div class="vazio"><span class="grande">🎁</span>Cria recompensas reais para te motivares.<br>Ex.: "Ir ao cinema", 150 moedas.</div>';
    } else {
      html += '<div class="lista">' + estado.recompensas.map((r) =>
        '<div class="item"><div class="ic">' + esc(r.emoji || "🎁") + '</div><button class="corpo" data-acao="editar-recompensa" data-id="' + r.id + '"><b>' + esc(r.titulo) + "</b><small>Toca para editar</small></button>" +
        '<button class="comprar" data-acao="comprar" data-id="' + r.id + '"' + (estado.ouro < r.custo ? " disabled" : "") + ">🪙 " + r.custo + "</button></div>").join("") + "</div>";
    }
    html += '<p class="nota" style="text-align:center;margin-top:14px">Já compraste ' + estado.stats.compras + (estado.stats.compras === 1 ? " recompensa." : " recompensas.") + "</p>";
    $("sep-loja").innerHTML = html;
  }

  // =====================================================================
  // Criação do herói
  // =====================================================================
  function renderCriacao() {
    const el = $("criacao");
    el.innerHTML =
      '<div class="logo"><div class="marca">⚔️ Life RPG</div><h1>Cria o teu herói</h1><p>A tua vida é a aventura. Completa missões reais, ganha XP, sobe de nível e desbloqueia conquistas.</p></div>' +
      '<div class="cartao">' +
        '<div class="campo"><label for="cNome">Nome do herói</label><input type="text" id="cNome" maxlength="24" placeholder="Como te chamas, aventureiro(a)?"></div>' +
        '<div class="campo"><span class="lbl">Avatar</span><div class="fichas avatares">' + AVATARES.map((a, i) =>
          '<label><input type="radio" name="cavatar" value="' + a + '"' + (i === 0 ? " checked" : "") + "><span>" + a + "</span></label>").join("") + "</div></div>" +
        '<div class="campo"><span class="lbl">Classe (+10% XP no atributo)</span><div class="fichas classes">' + Object.entries(CLASSES).map(([k, c], i) =>
          '<label class="classe"><input type="radio" name="cclasse" value="' + k + '"' + (i === 0 ? " checked" : "") + "><span>" + c.emoji + " " + c.nome + "<small>" + ATRIBUTOS[c.atr].emoji + " " + ATRIBUTOS[c.atr].nome + "</small></span></label>").join("") + "</div></div>" +
        '<button class="btn" id="cComecar">Começar a aventura</button>' +
      "</div>" +
      '<p class="nota" style="text-align:center;margin-top:14px">Vais começar com algumas missões de exemplo. Podes editá-las ou apagá-las.</p>';
    el.querySelector("#cComecar").addEventListener("click", () => {
      const nome = el.querySelector("#cNome").value.trim();
      if (!nome) { toast("Escolhe um nome para o teu herói."); el.querySelector("#cNome").focus(); return; }
      estado = estadoNovo({ nome, avatar: valor(el, "cavatar"), classe: valor(el, "cclasse") });
      guarda();
      som("nivel");
      arranca();
      confetti(["⚔️", "✨", "⭐"]);
    });
  }

  // =====================================================================
  // Eventos globais
  // =====================================================================
  document.addEventListener("click", (ev) => {
    const nav = ev.target.closest("nav button");
    if (nav) { separador = nav.dataset.sep; render(); window.scrollTo(0, 0); return; }
    const seg = ev.target.closest("[data-seg]");
    if (seg) { segMissoes = seg.dataset.seg; render(); return; }
    const el = ev.target.closest("[data-acao]");
    if (!el || !estado) return;
    const idItem = el.dataset.id;
    switch (el.dataset.acao) {
      case "diaria": completaDiaria(idItem, el); break;
      case "missao": completaMissao(idItem, el); break;
      case "passo": completaPasso(idItem, parseInt(el.dataset.i, 10), el); break;
      case "comprar": compra(idItem, el); break;
      case "editar-diaria": formMissao("diaria", estado.diarias.find((x) => x.id === idItem)); break;
      case "editar-missao": formMissao("missao", estado.missoes.find((x) => x.id === idItem)); break;
      case "editar-objetivo": formObjetivo(estado.objetivos.find((x) => x.id === idItem)); break;
      case "editar-recompensa": formRecompensa(estado.recompensas.find((x) => x.id === idItem)); break;
      case "ver-feitas": mostrarFeitas = !mostrarFeitas; render(); break;
      case "ver-objetivos": mostrarObjConcluidos = !mostrarObjConcluidos; render(); break;
      case "definicoes": formDefinicoes(); break;
    }
  });

  $("btnOraculo").addEventListener("click", abreOraculo);
  $("fab").addEventListener("click", () => {
    if (separador === "missoes") formMissao(segMissoes === "diarias" ? "diaria" : "missao");
    else if (separador === "objetivos") formObjetivo();
    else if (separador === "loja") formRecompensa();
  });

  // Botão "voltar" do Android
  window.handleBack = function () {
    if (haModal()) { fechaModal(); return true; }
    if (estado && separador !== "heroi") { separador = "heroi"; render(); return true; }
    return false;
  };
  window.appPausa = function () { if (estado) guarda(); if (ctxAudio) ctxAudio.suspend(); };
  window.appRetoma = function () { processaDia(); render(); };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { processaDia(); render(); } });
  // Se a app ficar aberta durante a meia-noite
  setInterval(() => { if (estado && estado.ultimoDia !== hoje()) processaDia(); }, 60000);

  function migra(e) {
    const base = estadoNovo(e.heroi);
    for (const k of Object.keys(base)) if (e[k] === undefined) e[k] = base[k];
    for (const k of Object.keys(base.stats)) if (e.stats[k] === undefined) e.stats[k] = 0;
    for (const k of Object.keys(base.atr)) if (e.atr[k] === undefined) e.atr[k] = 0;
    e.diarias.forEach((d) => {
      if (!Array.isArray(d.feitos)) {
        d.feitos = [];
        if (d.ultimo) {
          const fim = new Date(d.ultimo + "T12:00:00");
          for (let i = Math.max(1, d.sequencia) - 1; i >= 0; i--) { const x = new Date(fim); x.setDate(x.getDate() - i); d.feitos.push(chave(x)); }
        }
      }
    });
    return e;
  }

  function arranca() {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    carrega();
    if (!estado) {
      $("app").classList.add("escondido");
      $("criacao").classList.remove("escondido");
      renderCriacao();
      return;
    }
    estado = migra(estado);
    $("criacao").classList.add("escondido");
    $("app").classList.remove("escondido");
    separador = "heroi";
    render();
    processaDia();
  }

  // Exposto só para testes automáticos
  window.__liferpg = { estado: () => estado, processaDia, hoje };

  arranca();
})();
