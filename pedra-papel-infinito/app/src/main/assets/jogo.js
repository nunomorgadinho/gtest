/*
 * Pedra, Papel, Infinito: a lógica do jogo (o árbitro está em arbitro.js).
 */
(function () {
  "use strict";

  const INICIO = { nome: "Pedra", emoji: "🪨", explicacao: "", autor: "inicio" };
  const SUGESTOES_INICIAIS = ["Papel", "Martelo", "Lava", "Um geólogo", "Erosão", "Tempo"];
  const FRASES_PENSAR = [
    "A consultar o regulamento infinito...",
    "A imaginar a batalha em câmara lenta...",
    "A pedir opinião a uma tesoura reformada...",
    "A verificar se isto faz sentido na física...",
    "A pesar argumentos numa balança muito séria...",
    "A rever a jogada em VAR..."
  ];
  const CHAVE_STORAGE = "ppi.chave";
  const RECORDES_STORAGE = "ppi.recordes";

  const $ = (id) => document.getElementById(id);
  const ler = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } };
  const gravar = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignora */ } };

  let recordes = (() => { try { return JSON.parse(ler(RECORDES_STORAGE, "{}")) || {}; } catch (e) { return {}; } })();
  let j = null;          // partida atual
  let aPensar = false;

  // Remove acentos, artigos e pontuação para detetar repetições
  function normaliza(t) {
    return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\b(o|a|os|as|um|uma|uns|umas|the)\b/g, " ")
      .replace(/\s+/g, " ").trim().replace(/s$/, "");
  }

  // ---------- Som ----------
  let ac = null;
  function som(tipo) {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state !== "running") ac.resume();
      const t = ac.currentTime + 0.01;
      const nota = (f, i, d, onda, v) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = onda; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i); g.gain.exponentialRampToValueAtTime(v, t + i + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i + d);
        o.connect(g).connect(ac.destination); o.start(t + i); o.stop(t + i + d + 0.05);
      };
      if (tipo === "ganha") [523, 659, 784, 1047].forEach((f, i) => nota(f, i * 0.07, 0.25, "square", 0.07));
      if (tipo === "perde") [392, 311, 233].forEach((f, i) => nota(f, i * 0.16, 0.35, "sawtooth", 0.08));
      if (tipo === "rival") [880, 740].forEach((f, i) => nota(f, i * 0.1, 0.2, "triangle", 0.12));
    } catch (e) { /* sem áudio */ }
  }

  function confete(simbolos) {
    for (let i = 0; i < 24; i++) {
      const c = document.createElement("div");
      c.className = "confete";
      c.textContent = simbolos[i % simbolos.length];
      c.style.left = Math.random() * 100 + "vw";
      c.style.animationDuration = 1.8 + Math.random() * 1.6 + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4000);
    }
  }

  function toast(texto, ms) {
    document.querySelectorAll(".toast").forEach((t) => t.remove());
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = texto;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 3200);
  }

  function mostra(id) {
    document.querySelectorAll(".ecra").forEach((e) => e.classList.toggle("ativo", e.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- Início ----------
  function atualizaInicio() {
    $("recCorrente").textContent = "Recorde: " + (recordes.corrente || 0);
    $("recDuelo").textContent = "Recorde: " + (recordes.duelo || 0);
    $("avisoChave").classList.toggle("escondido", !!ler(CHAVE_STORAGE, ""));
  }

  function comecar(modo) {
    if (!ler(CHAVE_STORAGE, "")) { abreDefinicoes(); return; }
    j = { modo, corrente: [Object.assign({}, INICIO)], pontos: 0 };
    $("jModo").textContent = modo === "duelo" ? "Duelo contra a IA" : "Corrente";
    mostra("jogo");
    novaRonda();
  }

  function atual() { return j.corrente[j.corrente.length - 1]; }

  function novaRonda() {
    const a = atual();
    $("jPontos").textContent = j.pontos;
    $("jEmoji").textContent = a.emoji;
    $("jEmoji").style.animation = "none"; void $("jEmoji").offsetWidth; $("jEmoji").style.animation = "";
    $("jNome").textContent = a.nome;
    $("jPor").textContent = a.autor === "rival" ? "🤖 Jogada do rival" : a.autor === "jogador" ? "✍️ A tua jogada" : "O início de tudo";
    $("jPergunta").textContent = a.nome;
    $("jArena").style.background = a.autor === "rival" ? "var(--lilas)" : "var(--branco)";
    $("jResultado").innerHTML = "";
    $("jPensar").classList.add("escondido");
    $("jZonaJogada").classList.remove("escondido");
    $("jInput").value = "";

    // Corrente (histórico)
    const c = $("jCorrente");
    c.innerHTML = "";
    j.corrente.forEach((e, i) => {
      if (i > 0) { const s = document.createElement("span"); s.className = "seta"; s.textContent = "›"; c.appendChild(s); }
      const el = document.createElement("span");
      el.className = "elo" + (e.autor === "rival" ? " rival" : "");
      el.textContent = e.emoji + " " + e.nome;
      c.appendChild(el);
    });
    c.scrollLeft = c.scrollWidth;

    // Sugestões só na primeira jogada
    const sug = $("jSugestoes");
    sug.innerHTML = "";
    if (j.corrente.length === 1) {
      SUGESTOES_INICIAIS.slice().sort(() => Math.random() - 0.5).slice(0, 3).forEach((s) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = s;
        b.addEventListener("click", () => { $("jInput").value = s; jogar(); });
        sug.appendChild(b);
      });
    }
  }

  // ---------- Jogada ----------
  async function jogar() {
    if (aPensar || !j) return;
    const texto = $("jInput").value.trim();
    if (!texto) { toast("Escreve (ou diz) alguma coisa primeiro!"); $("jInput").focus(); return; }
    const n = normaliza(texto);
    if (j.corrente.some((e) => normaliza(e.nome) === n)) { toast("Isso já foi usado nesta corrente. Tenta outra coisa!"); return; }

    aPensar = true;
    $("jInput").blur();
    $("jZonaJogada").classList.add("escondido");
    $("jPensar").classList.remove("escondido");
    let k = Math.floor(Math.random() * FRASES_PENSAR.length);
    $("jPensarFrase").textContent = FRASES_PENSAR[k];
    const intervalo = setInterval(() => { k = (k + 1) % FRASES_PENSAR.length; $("jPensarFrase").textContent = FRASES_PENSAR[k]; }, 1800);

    let v;
    try {
      v = await window.Arbitro.julgar(ler(CHAVE_STORAGE, ""), {
        atual: atual().nome,
        jogada: texto,
        usadas: j.corrente.map((e) => e.nome)
      });
    } catch (erro) {
      clearInterval(intervalo);
      aPensar = false;
      $("jPensar").classList.add("escondido");
      $("jZonaJogada").classList.remove("escondido");
      $("jInput").value = texto;
      toast(erro && erro.message ? erro.message : "Algo correu mal. Tenta outra vez.", 5000);
      if (erro && (erro.tipo === "chave" || erro.tipo === "sem-chave")) abreDefinicoes();
      return;
    }
    clearInterval(intervalo);
    aPensar = false;
    if (!j) return; // saiu entretanto
    $("jPensar").classList.add("escondido");
    mostraVeredito(v, texto);
  }

  function mostraVeredito(v, texto) {
    const a = atual();
    const jogada = v.jogada || { nome: texto, emoji: "❓", explicacao: "" };
    const ganhou = v.valido && v.vence;
    const r = $("jResultado");

    const caixa = document.createElement("div");
    caixa.className = "caixa veredito " + (ganhou ? "ganhou" : "perdeu");
    caixa.innerHTML = '<div class="selo"></div><div class="duelo"><span></span><i></i><span></span></div><p></p>';
    caixa.querySelector(".selo").textContent = ganhou ? "Vence! ✓" : v.valido ? "Perde! ✗" : "Inválido ✗";
    const lados = caixa.querySelectorAll(".duelo span");
    lados[0].textContent = jogada.emoji;
    lados[1].textContent = a.emoji;
    caixa.querySelector(".duelo i").textContent = ganhou ? "VENCE" : "NÃO VENCE";
    caixa.querySelector("p").textContent = (jogada.nome ? jogada.nome + ": " : "") + (jogada.explicacao || "");
    r.appendChild(caixa);

    if (!ganhou) {
      som("perde");
      if (navigator.vibrate) navigator.vibrate(150);
      j.ultima = { jogada, contra: a };
      const b = botao("Ver resultado", "rosa", () => terminar(false));
      r.appendChild(b);
      return;
    }

    som("ganha");
    confete([jogada.emoji, "✨", "⭐"]);
    j.pontos++;
    $("jPontos").textContent = j.pontos;
    j.corrente.push({ nome: jogada.nome || texto, emoji: jogada.emoji || "❓", explicacao: jogada.explicacao, autor: "jogador" });

    if (j.modo === "duelo") {
      const rv = v.rival;
      if (!rv || !rv.nome || j.corrente.some((e) => normaliza(e.nome) === normaliza(rv.nome))) {
        // O rival ficou sem ideias: vitória do jogador
        const b = botao("O rival ficou sem resposta! 🏆", "verde", () => terminar(true));
        r.appendChild(b);
        return;
      }
      setTimeout(() => {
        som("rival");
        const rc = document.createElement("div");
        rc.className = "caixa rival-caixa";
        rc.innerHTML = '<div class="titulo">🤖 O rival contra-ataca</div><div class="grande"></div><b></b><p></p>';
        rc.querySelector(".grande").textContent = rv.emoji;
        rc.querySelector("b").textContent = rv.nome;
        rc.querySelector("p").textContent = rv.explicacao;
        r.appendChild(rc);
        j.corrente.push({ nome: rv.nome, emoji: rv.emoji, explicacao: rv.explicacao, autor: "rival" });
        r.appendChild(botao("Contra-atacar ⚔️", "", novaRonda));
        rc.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 700);
    } else {
      r.appendChild(botao("Continuar ▶", "", novaRonda));
    }
  }

  function botao(texto, cor, fn) {
    const b = document.createElement("button");
    b.className = "btn " + cor;
    b.textContent = texto;
    b.addEventListener("click", fn);
    return b;
  }

  // ---------- Fim ----------
  function terminar(venceuRival) {
    const anterior = recordes[j.modo] || 0;
    const novo = j.pontos > anterior;
    if (novo) { recordes[j.modo] = j.pontos; gravar(RECORDES_STORAGE, JSON.stringify(recordes)); }

    $("fEmoji").textContent = venceuRival ? "🏆" : j.pontos >= 10 ? "🔥" : j.pontos >= 5 ? "😎" : "💥";
    $("fTitulo").textContent = venceuRival ? "Deixaste a IA sem palavras!" : j.modo === "duelo" ? "O rival venceu!" : "Fim da corrente!";
    $("fPontos").textContent = j.pontos;
    $("fRecorde").textContent = "Recorde (" + (j.modo === "duelo" ? "Duelo" : "Corrente") + "): " + Math.max(anterior, j.pontos);
    $("fNovo").classList.toggle("escondido", !novo);

    const lista = $("fLista");
    lista.innerHTML = "";
    const itens = j.corrente.slice();
    if (j.ultima) itens.push(Object.assign({}, j.ultima.jogada, { autor: "falhou" }));
    itens.forEach((e) => {
      const d = document.createElement("div");
      d.innerHTML = "<span></span><span></span><small></small>";
      d.children[0].textContent = e.emoji;
      d.children[1].textContent = e.nome;
      d.children[2].textContent = e.autor === "rival" ? "rival" : e.autor === "inicio" ? "início" : e.autor === "falhou" ? "falhou ✗" : "tu";
      lista.appendChild(d);
    });
    if (novo || venceuRival) confete(["🏆", "⭐", "✨"]);
    mostra("fim");
  }

  function textoPartilha() {
    const cadeia = j.corrente.map((e) => e.emoji + " " + e.nome).join(" → ");
    return "Pedra, Papel, Infinito ✊✋✌️\nFiz " + j.pontos + (j.pontos === 1 ? " ponto" : " pontos") + " no modo " + (j.modo === "duelo" ? "Duelo" : "Corrente") + "!\n\n" + cadeia + "\n\nConsegues fazer melhor?";
  }

  // ---------- Definições ----------
  function abreDefinicoes() {
    const fundo = document.createElement("div");
    fundo.className = "fundo-modal";
    const temChave = !!ler(CHAVE_STORAGE, "");
    fundo.innerHTML =
      '<div class="modal">' +
        "<h2>🔑 Chave do árbitro</h2>" +
        "<p>O árbitro é o <b>Claude</b>, uma IA da Anthropic. Para ele julgar as tuas jogadas, precisas de uma chave da API:</p>" +
        "<ol><li>Cria uma conta em <code>console.anthropic.com</code></li><li>Adiciona crédito em <b>Billing</b></li><li>Em <b>API Keys</b>, cria uma chave e cola-a aqui</li></ol>" +
        '<label for="dChave">Chave da API</label>' +
        '<input id="dChave" type="password" placeholder="sk-ant-..." autocomplete="off" spellcheck="false">' +
        '<p class="nota">A chave fica guardada só neste telemóvel e é enviada apenas para a Anthropic. Cada jogada custa cerca de 1 a 2 cêntimos. Não partilhes esta app com a tua chave lá dentro.</p>' +
        '<button class="btn rosa" id="dGuardar">Guardar chave</button>' +
        (temChave ? '<button class="btn branco" id="dApagar">Apagar chave</button>' : "") +
        '<button class="btn branco" id="dFechar">Fechar</button>' +
      "</div>";
    fundo.addEventListener("click", (ev) => { if (ev.target === fundo) fundo.remove(); });
    $("modais").appendChild(fundo);
    const input = fundo.querySelector("#dChave");
    if (temChave) input.placeholder = "Chave guardada (•••• " + ler(CHAVE_STORAGE, "").slice(-4) + ")";
    fundo.querySelector("#dGuardar").addEventListener("click", () => {
      const v = input.value.trim();
      if (!v) { toast("Cola a chave primeiro."); return; }
      if (!v.startsWith("sk-ant-")) { toast("Esta chave não parece da Anthropic (começa por sk-ant-)."); return; }
      gravar(CHAVE_STORAGE, v);
      fundo.remove();
      atualizaInicio();
      toast("Chave guardada! Bom jogo. ✊");
    });
    const apagar = fundo.querySelector("#dApagar");
    if (apagar) apagar.addEventListener("click", () => { gravar(CHAVE_STORAGE, null); fundo.remove(); atualizaInicio(); toast("Chave apagada."); });
    fundo.querySelector("#dFechar").addEventListener("click", () => fundo.remove());
  }

  // ---------- Voz ----------
  let reconhecedorWeb = null;
  function vozDisponivel() {
    if (window.AndroidApp && window.AndroidApp.ouvir) {
      try { return window.AndroidApp.vozDisponivel(); } catch (e) { return true; }
    }
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  function ouvir() {
    if (aPensar) return;
    if (window.AndroidApp && window.AndroidApp.ouvir) {
      window.AndroidApp.ouvir("O que vence " + atual().nome + "?");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    reconhecedorWeb = new SR();
    reconhecedorWeb.lang = "pt-PT";
    reconhecedorWeb.onresult = (ev) => window.recebeVoz(ev.results[0][0].transcript);
    reconhecedorWeb.onend = () => $("btnVoz").classList.remove("a-ouvir");
    $("btnVoz").classList.add("a-ouvir");
    reconhecedorWeb.start();
  }
  window.recebeVoz = function (texto) {
    $("btnVoz").classList.remove("a-ouvir");
    if (!texto || !j) return;
    $("jInput").value = texto.charAt(0).toUpperCase() + texto.slice(1);
    jogar();
  };
  window.vozIndisponivel = function () { toast("Este telemóvel não tem reconhecimento de voz. Escreve a tua jogada."); };

  // ---------- Eventos ----------
  document.querySelectorAll("[data-modo]").forEach((b) => b.addEventListener("click", () => comecar(b.dataset.modo)));
  $("btnDefinicoes").addEventListener("click", abreDefinicoes);
  $("jForm").addEventListener("submit", (ev) => { ev.preventDefault(); jogar(); });
  $("btnJogar").addEventListener("click", jogar);
  $("btnVoz").addEventListener("click", ouvir);
  if (!vozDisponivel()) $("btnVoz").classList.add("escondido");
  $("btnSair").addEventListener("click", () => { j = null; aPensar = false; atualizaInicio(); mostra("inicio"); });
  $("btnDeNovo").addEventListener("click", () => comecar(j.modo));
  $("btnMenu").addEventListener("click", () => { j = null; atualizaInicio(); mostra("inicio"); });
  $("btnPartilhar").addEventListener("click", () => {
    const t = textoPartilha();
    if (window.AndroidApp && window.AndroidApp.share) window.AndroidApp.share(t);
    else if (navigator.share) navigator.share({ text: t }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => toast("Copiado!"));
  });

  window.handleBack = function () {
    if ($("modais").children.length) { $("modais").lastElementChild.remove(); return true; }
    if ($("jogo").classList.contains("ativo") || $("fim").classList.contains("ativo")) {
      j = null; aPensar = false; atualizaInicio(); mostra("inicio"); return true;
    }
    return false;
  };

  atualizaInicio();
})();
