/*
 * Árbitro clássico do "Pedra, Papel, Infinito": grátis e sem internet.
 * Um dicionário de coisas com etiquetas, regras por etiqueta e pares específicos.
 * Expõe window.ArbitroClassico com a mesma forma de resposta que o árbitro com IA.
 */
(function () {
  "use strict";

  // id: [nome, artigo, emoji, etiquetas, sinónimos]
  const COISAS = {
    // ---------- Natureza ----------
    pedra: ["Pedra", "a", "🪨", "duro", "rocha calhau seixo pedregulho"],
    montanha: ["Montanha", "a", "⛰️", "duro grande", "monte serra"],
    diamante: ["Diamante", "o", "💎", "duro precioso", "diamantes"],
    areia: ["Areia", "a", "🏖️", "terra", "praia"],
    lama: ["Lama", "a", "🟤", "terra sujidade", "lodo barro"],
    castelo_areia: ["Castelo de areia", "o", "🏰", "terra", "castelos de areia"],
    fogo: ["Fogo", "o", "🔥", "fogo quente", "chama chamas fogueira incendio labareda"],
    vela: ["Vela", "a", "🕯️", "fogo", "velas"],
    lava: ["Lava", "a", "🌋", "fogo quente", "magma"],
    vulcao: ["Vulcão", "o", "🌋", "fogo quente grande", "vulcoes"],
    agua: ["Água", "a", "💧", "agua", "aguas liquido"],
    chuva: ["Chuva", "a", "🌧️", "agua", "aguaceiro chuvada"],
    oceano: ["Oceano", "o", "🌊", "agua grande", "mar oceanos"],
    onda: ["Onda", "a", "🌊", "agua", "ondas"],
    tsunami: ["Tsunami", "o", "🌊", "agua grande", "maremoto"],
    gelo: ["Gelo", "o", "🧊", "frio", "cubo de gelo"],
    neve: ["Neve", "a", "❄️", "frio", "nevao floco de neve"],
    inverno: ["Inverno", "o", "⛄", "frio", ""],
    calor: ["Calor", "o", "🥵", "quente", "verao onda de calor"],
    vento: ["Vento", "o", "💨", "vento", "ar brisa ventania sopro"],
    tornado: ["Tornado", "o", "🌪️", "vento grande", "furacao ciclone tufao"],
    nuvem: ["Nuvem", "a", "☁️", "nuvem", "nuvens"],
    sol: ["Sol", "o", "☀️", "quente luz cosmico", ""],
    lua: ["Lua", "a", "🌙", "cosmico", "luar"],
    estrela: ["Estrela", "a", "⭐", "cosmico luz", "estrelas"],
    buraco_negro: ["Buraco negro", "o", "🕳️", "cosmico escuro", "buracos negros"],
    meteorito: ["Meteorito", "o", "☄️", "cosmico duro", "asteroide cometa meteoro"],
    gravidade: ["Gravidade", "a", "🍎", "fisica", ""],
    relampago: ["Relâmpago", "o", "⚡", "eletrico", "raio trovao trovoada"],
    eletricidade: ["Eletricidade", "a", "🔌", "eletrico", "energia corrente eletrica choque"],
    arco_iris: ["Arco-íris", "o", "🌈", "luz", "arcoiris arco iris"],
    sombra: ["Sombra", "a", "👤", "escuro", "sombras"],
    escuridao: ["Escuridão", "a", "🌑", "escuro", "escuro breu"],
    noite: ["Noite", "a", "🌃", "escuro tempo", "madrugada"],
    luz: ["Luz", "a", "💡", "luz", "lampada candeeiro"],
    lanterna: ["Lanterna", "a", "🔦", "luz maquina", ""],
    tempo: ["Tempo", "o", "⏳", "tempo", "relogio passar do tempo anos"],
    erosao: ["Erosão", "a", "🏜️", "tempo", ""],
    ferrugem: ["Ferrugem", "a", "🟠", "quimico", "oxido"],
    acido: ["Ácido", "o", "🧪", "quimico", "acido sulfurico"],
    sal: ["Sal", "o", "🧂", "comida", ""],
    iman: ["Íman", "o", "🧲", "iman", "magnete ima"],
    para_raios: ["Para-raios", "o", "🗼", "metal", "pararaios para raios"],
    cimento: ["Cimento", "o", "🧱", "duro", "betao tijolo parede"],
    arvore: ["Árvore", "a", "🌳", "planta madeira grande", "arvores carvalho pinheiro"],
    floresta: ["Floresta", "a", "🌲", "planta grande", "mata bosque selva"],
    flor: ["Flor", "a", "🌸", "planta", "flores rosa margarida"],
    erva: ["Erva", "a", "🌿", "planta", "relva capim ervas"],
    semente: ["Semente", "a", "🌱", "planta", "sementes"],
    cacto: ["Cato", "o", "🌵", "planta", "cacto catos"],
    bolor: ["Bolor", "o", "🦠", "fungo sujidade", "mofo fungo"],
    // ---------- Materiais e objetos ----------
    papel: ["Papel", "o", "📄", "papel", "folha folha de papel papeis"],
    livro: ["Livro", "o", "📖", "papel ideia", "livros"],
    jornal: ["Jornal", "o", "📰", "papel", "revista"],
    cartao: ["Cartão", "o", "📦", "papel", "caixa caixa de cartao"],
    madeira: ["Madeira", "a", "🪵", "madeira", "tronco pau tabua lenha"],
    tecido: ["Tecido", "o", "🧵", "tecido", "pano roupa camisola"],
    cobertor: ["Cobertor", "o", "🛏️", "tecido", "manta edredao"],
    corda: ["Corda", "a", "🪢", "fio", "fio cordel"],
    teia: ["Teia de aranha", "a", "🕸️", "fio", "teia"],
    plastico: ["Plástico", "o", "🥤", "plastico", "garrafa de plastico"],
    balao: ["Balão", "o", "🎈", "plastico", "baloes"],
    bolha: ["Bolha de sabão", "a", "🫧", "fragil", "bolha bolhas"],
    vidro: ["Vidro", "o", "🪟", "vidro", "janela copo"],
    casa: ["Casa", "a", "🏠", "casa", "casas predio apartamento"],
    sapato: ["Sapato", "o", "👟", "tecido", "sapatos sapatilha bota botas"],
    bola: ["Bola", "a", "⚽", "plastico", "bolas"],
    tinta: ["Tinta", "a", "🎨", "quimico", "tintas"],
    metal: ["Metal", "o", "🔩", "metal", "ferro aco parafuso"],
    tesoura: ["Tesoura", "a", "✂️", "corte metal", "tesouras"],
    faca: ["Faca", "a", "🔪", "corte metal", "facas canivete"],
    serra: ["Serra", "a", "🪚", "corte metal", "serrote motosserra"],
    machado: ["Machado", "o", "🪓", "corte metal", ""],
    martelo: ["Martelo", "o", "🔨", "impacto metal", "marreta"],
    prego: ["Prego", "o", "📌", "metal pico", "pregos pionese alfinete agulha"],
    pneu: ["Pneu", "o", "🛞", "plastico", "roda"],
    lixa: ["Lixa", "a", "🟫", "lixa", ""],
    fita_cola: ["Fita-cola", "a", "🩹", "cola", "fita cola cola supercola"],
    borracha: ["Borracha", "a", "⬜", "borracha", ""],
    lapis: ["Lápis", "o", "✏️", "escrita madeira", ""],
    caneta: ["Caneta", "a", "🖊️", "escrita", "esferografica marcador"],
    guarda_chuva: ["Guarda-chuva", "o", "☂️", "protecao", "chapeu de chuva guardachuva"],
    extintor: ["Extintor", "o", "🧯", "extintor", ""],
    esponja: ["Esponja", "a", "🧽", "limpeza tecido", ""],
    sabao: ["Sabão", "o", "🧼", "limpeza", "sabonete detergente"],
    vassoura: ["Vassoura", "a", "🧹", "limpeza madeira", "esfregona"],
    // ---------- Máquinas e tecnologia ----------
    computador: ["Computador", "o", "💻", "maquina digital", "pc portatil"],
    telemovel: ["Telemóvel", "o", "📱", "maquina digital", "telefone smartphone celular"],
    robo: ["Robô", "o", "🤖", "maquina", "robot robos"],
    virus_informatico: ["Vírus informático", "o", "👾", "digital", "malware hacker"],
    antivirus: ["Antivírus", "o", "🛡️", "digital", ""],
    internet: ["Internet", "a", "🌐", "digital", "wifi wi fi rede"],
    bateria: ["Bateria", "a", "🔋", "energia", "pilha"],
    televisao: ["Televisão", "a", "📺", "maquina", "tv televisor"],
    calculadora: ["Calculadora", "a", "🧮", "maquina", ""],
    despertador: ["Despertador", "o", "⏰", "maquina som", "alarme"],
    carro: ["Carro", "o", "🚗", "veiculo maquina", "automovel"],
    bicicleta: ["Bicicleta", "a", "🚲", "veiculo", "bike"],
    aviao: ["Avião", "o", "✈️", "veiculo", "avioes"],
    foguetao: ["Foguetão", "o", "🚀", "veiculo", "foguete nave espacial nave"],
    comboio: ["Comboio", "o", "🚆", "veiculo", "metro"],
    barco: ["Barco", "o", "⛵", "veiculo", "navio barquinho"],
    transito: ["Trânsito", "o", "🚙", "tempo", "engarrafamento fila"],
    semaforo: ["Semáforo", "o", "🚦", "maquina", ""],
    // ---------- Animais ----------
    rato: ["Rato", "o", "🐭", "presa", "ratos ratazana"],
    gato: ["Gato", "o", "🐱", "animal", "gatos gatinho"],
    cao: ["Cão", "o", "🐶", "animal", "caes cachorro"],
    elefante: ["Elefante", "o", "🐘", "grande animal", ""],
    leao: ["Leão", "o", "🦁", "animal grande", "leoes"],
    mosquito: ["Mosquito", "o", "🦟", "inseto", "melga"],
    mosca: ["Mosca", "a", "🪰", "inseto", "moscas"],
    aranha: ["Aranha", "a", "🕷️", "animal", "aranhas"],
    formiga: ["Formiga", "a", "🐜", "inseto", "formigas"],
    abelha: ["Abelha", "a", "🐝", "inseto", "vespa abelhas"],
    lagarta: ["Lagarta", "a", "🐛", "inseto", "minhoca"],
    termita: ["Térmita", "a", "🪲", "inseto", "termitas cupim caruncho"],
    traca: ["Traça", "a", "🦋", "inseto", "tracas"],
    urso: ["Urso", "o", "🐻", "animal grande", ""],
    passaro: ["Pássaro", "o", "🐦", "ave", "ave passarinho pardal"],
    aguia: ["Águia", "a", "🦅", "ave", "falcao"],
    galinha: ["Galinha", "a", "🐔", "ave", "galo frango"],
    gaivota: ["Gaivota", "a", "🕊️", "ave", "gaivotas pombo"],
    cobra: ["Cobra", "a", "🐍", "animal", "serpente viboras vibora"],
    sapo: ["Sapo", "o", "🐸", "animal", "ra"],
    peixe: ["Peixe", "o", "🐟", "peixe", "peixes sardinha"],
    tubarao: ["Tubarão", "o", "🦈", "peixe grande", ""],
    golfinho: ["Golfinho", "o", "🐬", "animal", ""],
    baleia: ["Baleia", "a", "🐋", "grande animal", ""],
    raposa: ["Raposa", "a", "🦊", "animal", ""],
    lobo: ["Lobo", "o", "🐺", "animal", "lobos"],
    ovelha: ["Ovelha", "a", "🐑", "animal", "carneiro rebanho"],
    cabra: ["Cabra", "a", "🐐", "animal", "bode"],
    caracol: ["Caracol", "o", "🐌", "animal", "lesma caracois"],
    macaco: ["Macaco", "o", "🐒", "animal", "macacos gorila chimpanze"],
    ovo: ["Ovo", "o", "🥚", "comida petisco", "ovos"],
    dinossauro: ["Dinossauro", "o", "🦖", "grande", "t rex tiranossauro"],
    pato: ["Pato", "o", "🦆", "ave animal", "patos"],
    pinguim: ["Pinguim", "o", "🐧", "ave animal", "pinguins"],
    cavalo: ["Cavalo", "o", "🐴", "animal", "cavalos egua"],
    vaca: ["Vaca", "a", "🐄", "animal", "vacas boi touro"],
    porco: ["Porco", "o", "🐷", "animal", "porcos leitao"],
    tigre: ["Tigre", "o", "🐯", "animal grande", "tigres"],
    // ---------- Fantasia ----------
    dragao: ["Dragão", "o", "🐉", "fogo grande fantasia", ""],
    cavaleiro: ["Cavaleiro", "o", "🛡️", "pessoa", "guerreiro"],
    castelo: ["Castelo", "o", "🏰", "duro grande", "fortaleza"],
    fantasma: ["Fantasma", "o", "👻", "fantasia", "assombracao"],
    vampiro: ["Vampiro", "o", "🧛", "fantasia", "dracula"],
    unicornio: ["Unicórnio", "o", "🦄", "fantasia", ""],
    bruxa: ["Bruxa", "a", "🧙", "fantasia pessoa", "feiticeira feiticeiro mago"],
    super_heroi: ["Super-herói", "o", "🦸", "pessoa fantasia", "super heroi superman heroi"],
    tesouro: ["Tesouro", "o", "🪙", "precioso", "ouro moedas de ouro"],
    rei: ["Rei", "o", "👑", "pessoa", "rainha reis"],
    espada: ["Espada", "a", "🗡️", "corte metal", "espadas sabre"],
    escudo: ["Escudo", "o", "🛡️", "metal protecao", "escudos"],
    // ---------- Pessoas ----------
    bombeiro: ["Bombeiro", "o", "🧑‍🚒", "pessoa", "bombeiros"],
    canalizador: ["Canalizador", "o", "🔧", "pessoa", "picheleiro"],
    eletricista: ["Eletricista", "o", "👷", "pessoa", ""],
    medico: ["Médico", "o", "🧑‍⚕️", "pessoa", "medica doutor enfermeiro"],
    professor: ["Professor", "o", "🧑‍🏫", "pessoa", "professora stor"],
    cientista: ["Cientista", "o", "🧑‍🔬", "pessoa", ""],
    geologo: ["Geólogo", "o", "⛏️", "pessoa", "mineiro"],
    lenhador: ["Lenhador", "o", "🧔", "pessoa", ""],
    jardineiro: ["Jardineiro", "o", "🧑‍🌾", "pessoa", "agricultor"],
    programador: ["Programador", "o", "🧑‍💻", "pessoa", "informatico"],
    mae: ["Mãe", "a", "👩", "pessoa", "mae"],
    bebe: ["Bebé", "o", "👶", "pessoa", "bebe crianca"],
    pirata: ["Pirata", "o", "🏴‍☠️", "pessoa", "piratas"],
    policia: ["Polícia", "a", "👮", "pessoa", "policia agente"],
    ladrao: ["Ladrão", "o", "🦹", "pessoa", "ladroes assaltante"],
    cozinheiro: ["Cozinheiro", "o", "🧑‍🍳", "pessoa", "chef"],
    astronauta: ["Astronauta", "o", "🧑‍🚀", "pessoa", ""],
    magico: ["Mágico", "o", "🎩", "pessoa", "ilusionista"],
    palhaco: ["Palhaço", "o", "🤡", "pessoa", "palhacos"],
    domador: ["Domador", "o", "🎪", "pessoa", "domador de leoes"],
    // ---------- Comida ----------
    queijo: ["Queijo", "o", "🧀", "comida petisco", ""],
    pao: ["Pão", "o", "🍞", "comida petisco", "paes torrada"],
    gelado: ["Gelado", "o", "🍦", "comida doce petisco", "sorvete"],
    chocolate: ["Chocolate", "o", "🍫", "comida doce petisco", ""],
    pizza: ["Pizza", "a", "🍕", "comida petisco", ""],
    banana: ["Banana", "a", "🍌", "comida petisco", "bananas"],
    cebola: ["Cebola", "a", "🧅", "comida", ""],
    alho: ["Alho", "o", "🧄", "comida", ""],
    mel: ["Mel", "o", "🍯", "comida doce petisco", ""],
    cafe: ["Café", "o", "☕", "comida", "bica expresso"],
    bolo: ["Bolo", "o", "🎂", "comida doce petisco", "bolos"],
    sopa: ["Sopa", "a", "🍲", "comida quente", "caldo"],
    milho: ["Milho", "o", "🌽", "comida planta petisco", "pipocas"],
    dieta: ["Dieta", "a", "🥗", "ideia", "salada"],
    maca: ["Maçã", "a", "🍏", "comida petisco", "macas"],
    dente: ["Dente", "o", "🦷", "dente", "dentes"],
    dentista: ["Dentista", "o", "🪥", "pessoa", "dentistas"],
    fome: ["Fome", "a", "😋", "estado", ""],
    // ---------- Ideias e sentimentos ----------
    ideia: ["Ideia", "a", "💡", "ideia", "ideias"],
    esquecimento: ["Esquecimento", "o", "🫥", "ideia", ""],
    memoria: ["Memória", "a", "🧠", "ideia", "lembranca"],
    fotografia: ["Fotografia", "a", "📸", "papel", "foto fotos selfie"],
    ignorancia: ["Ignorância", "a", "🙈", "ideia", ""],
    problema: ["Problema", "o", "❓", "ideia", "problemas"],
    plano: ["Plano", "o", "🗺️", "ideia", "estrategia"],
    caos: ["Caos", "o", "🌀", "ideia", "confusao"],
    regras: ["Regras", "as", "📏", "ideia", "regra lei"],
    verdade: ["Verdade", "a", "✅", "ideia", ""],
    mentira: ["Mentira", "a", "🤥", "ideia", "mentiras"],
    exame: ["Exame", "o", "📝", "ideia", "teste prova"],
    trabalho: ["Trabalho", "o", "💼", "ideia", "trabalhos"],
    dinheiro: ["Dinheiro", "o", "💰", "dinheiro", "euros dinheirinho"],
    preguica: ["Preguiça", "a", "🦥", "emocao", ""],
    sono: ["Sono", "o", "😴", "estado", "cansaco dormir"],
    medo: ["Medo", "o", "😱", "emocao", "pavor susto"],
    coragem: ["Coragem", "a", "🦁", "emocao", "valentia"],
    riso: ["Riso", "o", "😂", "emocao", "gargalhada risada riso alegria"],
    tristeza: ["Tristeza", "a", "😢", "emocao", "choro"],
    amor: ["Amor", "o", "❤️", "emocao", "paixao"],
    odio: ["Ódio", "o", "😠", "emocao", "raiva furia"],
    ciume: ["Ciúme", "o", "😒", "emocao", "ciumes inveja"],
    tedio: ["Tédio", "o", "🥱", "emocao", "aborrecimento seca"],
    paciencia: ["Paciência", "a", "🧘", "emocao", ""],
    pressa: ["Pressa", "a", "🏃", "emocao", "stress"],
    musica: ["Música", "a", "🎵", "som", "cancao"],
    silencio: ["Silêncio", "o", "🤫", "som", ""],
    barulho: ["Barulho", "o", "📢", "som", "ruido grito"],
    segunda_feira: ["Segunda-feira", "a", "📅", "tempo", "segunda feira segunda"],
    fim_de_semana: ["Fim de semana", "o", "🎉", "tempo", "sabado domingo"],
    ferias: ["Férias", "as", "🏝️", "tempo", "ferias"],
    sujidade: ["Sujidade", "a", "💩", "sujidade", "porcaria lixo"],
    desarrumacao: ["Desarrumação", "a", "🧦", "sujidade", "desarrumacao quarto desarrumado"],
    virus: ["Vírus", "o", "🦠", "doenca", "bacteria micróbio microbio germes"],
    vacina: ["Vacina", "a", "💉", "saude", "vacinas"],
    constipacao: ["Constipação", "a", "🤧", "doenca", "gripe"]
  };

  // [etiqueta que vence, etiqueta que perde, verbo]
  const REGRAS = [
    ["agua", "fogo", "apaga"],
    ["agua", "papel", "encharca"],
    ["agua", "sujidade", "lava"],
    ["fogo", "madeira", "queima"],
    ["fogo", "papel", "queima"],
    ["fogo", "tecido", "queima"],
    ["fogo", "fio", "queima"],
    ["fogo", "plastico", "derrete"],
    ["fogo", "planta", "queima"],
    ["quente", "frio", "derrete"],
    ["frio", "agua", "congela"],
    ["corte", "papel", "corta"],
    ["corte", "tecido", "corta"],
    ["corte", "fio", "corta"],
    ["corte", "planta", "corta"],
    ["impacto", "vidro", "parte"],
    ["duro", "vidro", "parte"],
    ["luz", "escuro", "ilumina"],
    ["eletrico", "maquina", "avaria"],
    ["quimico", "metal", "corrói"],
    ["vento", "papel", "leva pelos ares"],
    ["limpeza", "sujidade", "limpa"],
    ["limpeza", "doenca", "elimina"],
    ["pico", "plastico", "fura"],
    ["iman", "metal", "atrai"],
    ["sono", "pessoa", "vence até"],
    ["preguica", "pessoa", "derrota"],
    ["segunda_feira", "pessoa", "desanima"],
    ["fome", "petisco", "devora"],
    ["formiga", "petisco", "rouba as migalhas d"]
  ];

  // [quem vence, quem perde, verbo ou frase]
  const PARES = [
    ["papel", "pedra", "embrulha"], ["tesoura", "papel", "corta"], ["pedra", "tesoura", "amolga"],
    ["martelo", "pedra", "parte"], ["geologo", "pedra", "estuda e classifica"], ["agua", "pedra", "desgasta, gota a gota,"],
    ["erosao", "pedra", "desfaz devagarinho"], ["arvore", "pedra", "racha com as raízes"], ["erosao", "montanha", "aplana"],
    ["tempo", "montanha", "transforma em areia"], ["diamante", "vidro", "risca"], ["diamante", "pedra", "é mais duro do que"],
    ["martelo", "prego", "enterra"], ["prego", "pneu", "fura"], ["prego", "balao", "rebenta"], ["iman", "tesoura", "agarra"],
    ["iman", "computador", "baralha a memória d"], ["ferrugem", "tesoura", "enferruja"], ["ferrugem", "prego", "enferruja"],
    ["lixa", "ferrugem", "tira"], ["lixa", "madeira", "alisa"], ["extintor", "fogo", "apaga"], ["bombeiro", "fogo", "apaga"],
    ["bombeiro", "vulcao", "não tem medo d"], ["areia", "fogo", "abafa"], ["chuva", "vela", "apaga"], ["vento", "vela", "apaga"],
    ["vento", "nuvem", "empurra"], ["vento", "balao", "leva"], ["vento", "bolha", "rebenta"], ["vento", "areia", "espalha"],
    ["nuvem", "sol", "tapa"], ["sol", "chuva", "seca as poças d"], ["sol", "noite", "acaba com"], ["sol", "vampiro", "derrete"],
    ["sol", "gelado", "derrete"], ["calor", "gelado", "derrete"], ["lanterna", "fantasma", "faz desaparecer"],
    ["escuridao", "sombra", "engole"], ["buraco_negro", "estrela", "engole"], ["buraco_negro", "sol", "engole"],
    ["buraco_negro", "luz", "engole até"], ["buraco_negro", "lua", "engole"], ["estrela", "noite", "ilumina"],
    ["meteorito", "dinossauro", "extinguiu"], ["meteorito", "lua", "deixa uma cratera n"], ["dinossauro", "carro", "pisa"],
    ["dinossauro", "arvore", "come as folhas d"], ["astronauta", "lua", "pisou"], ["foguetao", "gravidade", "vence"],
    ["foguetao", "aviao", "voa mais alto do que"], ["gravidade", "ovo", "faz cair"], ["gravidade", "balao", "não deixa fugir"],
    ["aviao", "comboio", "chega mais depressa do que"], ["comboio", "transito", "passa ao lado d"], ["transito", "carro", "prende"],
    ["bicicleta", "transito", "foge d"], ["semaforo", "carro", "manda parar"], ["semaforo", "pressa", "trava"],
    ["lobo", "ovelha", "assusta"], ["cao", "lobo", "afasta"], ["ovelha", "erva", "come"], ["cabra", "erva", "come"],
    ["cabra", "papel", "come"], ["cabra", "flor", "come"], ["gato", "rato", "persegue"], ["rato", "queijo", "come"],
    ["rato", "elefante", "assusta"], ["cao", "gato", "persegue"], ["gato", "passaro", "assusta"], ["elefante", "arvore", "arranca"],
    ["domador", "leao", "doma"], ["mosquito", "leao", "não deixa dormir"], ["mosquito", "urso", "pica"], ["aranha", "mosca", "apanha"],
    ["aranha", "mosquito", "apanha"], ["teia", "mosca", "prende"], ["vassoura", "teia", "varre"], ["vassoura", "aranha", "expulsa"],
    ["passaro", "lagarta", "come"], ["lagarta", "flor", "come"], ["aguia", "cobra", "apanha"], ["cobra", "rato", "caça"],
    ["sapo", "mosca", "apanha com a língua"], ["sapo", "mosquito", "apanha com a língua"], ["urso", "mel", "come"],
    ["abelha", "urso", "pica"], ["tubarao", "peixe", "come"], ["golfinho", "tubarao", "afugenta"], ["gaivota", "peixe", "rouba"],
    ["gaivota", "pao", "rouba"], ["ovo", "galinha", "veio primeiro do que"], ["galinha", "milho", "come"], ["raposa", "galinha", "assusta"],
    ["termita", "madeira", "come"], ["termita", "arvore", "rói"], ["traca", "tecido", "rói"], ["traca", "cobertor", "rói"],
    ["bolor", "pao", "estraga"], ["bolor", "queijo", "estraga"], ["sal", "caracol", "afasta"], ["caracol", "flor", "come"],
    ["alho", "vampiro", "afasta"], ["vampiro", "noite", "manda n"], ["cavaleiro", "dragao", "doma"], ["dragao", "castelo", "incendeia"],
    ["dragao", "floresta", "incendeia"], ["dragao", "cavaleiro", "assusta"], ["unicornio", "tristeza", "acaba com"],
    ["agua", "bruxa", "derrete"], ["bruxa", "cavaleiro", "enfeitiça"], ["bruxa", "sapo", "transforma num príncipe"],
    ["super_heroi", "ladrao", "apanha"], ["super_heroi", "meteorito", "desvia"], ["policia", "ladrao", "prende"],
    ["ladrao", "dinheiro", "rouba"], ["ladrao", "diamante", "rouba"], ["ladrao", "tesouro", "rouba"], ["pirata", "barco", "assalta"],
    ["pirata", "tesouro", "encontra"], ["mae", "desarrumacao", "arruma"], ["mae", "preguica", "acaba com"], ["mae", "medo", "acalma"],
    ["bebe", "sono", "acaba com"], ["bebe", "silencio", "quebra"], ["bebe", "bolha", "rebenta"], ["professor", "ignorancia", "combate"],
    ["professor", "exame", "corrige"], ["cientista", "virus", "estuda"], ["cientista", "problema", "resolve"], ["medico", "constipacao", "trata"],
    ["medico", "virus", "combate"], ["vacina", "virus", "previne"], ["sabao", "virus", "elimina"], ["sopa", "constipacao", "cura"],
    ["sopa", "fome", "mata"], ["cobertor", "frio", "afasta"], ["sopa", "frio", "aquece"], ["constipacao", "ferias", "estraga"],
    ["virus_informatico", "computador", "infeta"], ["virus_informatico", "telemovel", "infeta"], ["antivirus", "virus_informatico", "apaga"],
    ["programador", "virus_informatico", "corrige"], ["programador", "robo", "programa"], ["programador", "problema", "resolve"],
    ["agua", "telemovel", "afoga"], ["agua", "computador", "afoga"], ["agua", "bateria", "estraga"], ["eletricista", "eletricidade", "domina"],
    ["borracha", "eletricidade", "isola"], ["borracha", "lapis", "apaga"], ["lapis", "papel", "rabisca"], ["caneta", "papel", "rabisca"],
    ["caneta", "borracha", "não se deixa apagar pel"], ["fita_cola", "problema", "resolve qualquer"], ["fita_cola", "vidro", "remenda"],
    ["tesoura", "fita_cola", "corta"], ["faca", "pao", "corta"], ["faca", "queijo", "corta"], ["faca", "cebola", "corta"],
    ["cebola", "riso", "faz chorar até"], ["cebola", "cozinheiro", "faz chorar"], ["cozinheiro", "fome", "acaba com"],
    ["cozinheiro", "ovo", "estrela"], ["pizza", "fome", "acaba com"], ["fome", "dieta", "derrota"], ["bolo", "dieta", "arruína"],
    ["chocolate", "dieta", "arruína"], ["chocolate", "tristeza", "consola"], ["gelado", "calor", "refresca"], ["banana", "fome", "engana"],
    ["cafe", "sono", "acaba com"], ["cafe", "preguica", "vence"], ["cafe", "segunda_feira", "dá energia para enfrentar"],
    ["preguica", "trabalho", "adia"], ["preguica", "plano", "deita abaixo"], ["plano", "caos", "organiza"], ["caos", "regras", "baralha"],
    ["regras", "caos", "põe ordem n"], ["segunda_feira", "fim_de_semana", "acaba com"], ["ferias", "trabalho", "interrompem"],
    ["fim_de_semana", "trabalho", "interrompe"], ["trabalho", "ferias", "acaba com"], ["musica", "silencio", "quebra"],
    ["musica", "tedio", "acaba com"], ["silencio", "barulho", "acalma"], ["barulho", "sono", "acaba com"], ["despertador", "sono", "acaba com"],
    ["martelo", "despertador", "silencia"], ["sono", "tedio", "resolve"], ["riso", "tristeza", "vence"], ["palhaco", "tristeza", "alegra"],
    ["palhaco", "tedio", "acaba com"], ["palhaco", "coragem", "testa"], ["amor", "odio", "vence"], ["flor", "odio", "acalma"],
    ["coragem", "medo", "vence"], ["fantasma", "coragem", "assusta"], ["fantasma", "silencio", "acaba com"],
    ["riso", "fantasma", "afugenta"], ["paciencia", "pressa", "vence"], ["dinheiro", "fome", "resolve"],
    ["verdade", "mentira", "desmascara"], ["esquecimento", "memoria", "apaga"], ["esquecimento", "ideia", "apaga"],
    ["ideia", "problema", "resolve"], ["ideia", "tedio", "acaba com"], ["livro", "ignorancia", "combate"], ["livro", "tedio", "vence"],
    ["televisao", "tedio", "distrai"], ["internet", "tedio", "acaba com"], ["internet", "ignorancia", "combate"],
    ["calculadora", "exame", "salva"], ["computador", "calculadora", "faz contas melhor do que"], ["telemovel", "calculadora", "substitui"],
    ["robo", "trabalho", "faz"], ["magico", "problema", "faz desaparecer"], ["magico", "tedio", "acaba com"],
    ["guarda_chuva", "chuva", "protege d"], ["vento", "guarda_chuva", "vira ao contrário"], ["arco_iris", "chuva", "aparece depois d"],
    ["arco_iris", "tristeza", "alegra"], ["oceano", "areia", "leva"], ["onda", "castelo_areia", "derruba"], ["tsunami", "castelo", "inunda"],
    ["lava", "gelo", "derrete"], ["vulcao", "montanha", "rebenta"], ["montanha", "vento", "trava"], ["montanha", "tornado", "trava"],
    ["tornado", "carro", "levanta"], ["tornado", "barco", "abana"], ["oceano", "barco", "abana"], ["barco", "oceano", "atravessa"],
    ["submarino", "oceano", "explora"], ["inverno", "flor", "murcha"], ["neve", "erva", "cobre"], ["relampago", "arvore", "atinge"],
    ["lenhador", "arvore", "corta"], ["machado", "arvore", "corta"], ["serra", "madeira", "corta"], ["machado", "madeira", "racha"],
    ["jardineiro", "erva", "apara"], ["jardineiro", "semente", "planta"], ["semente", "pedra", "racha ao germinar n"],
    ["cacto", "balao", "rebenta"], ["cacto", "sede", ""], ["cacto", "calor", "aguenta"], ["erva", "castelo", "cresce nas ruínas d"],
    ["floresta", "vento", "trava"], ["tempo", "memoria", "apaga"], ["tempo", "ferias", "acaba com"], ["tempo", "castelo", "arruína"],
    ["noite", "sol", "esconde"], ["lua", "noite", "ilumina"], ["luz", "medo", "afasta"], ["eletricidade", "escuridao", "acaba com"],
    ["bateria", "telemovel", "dá vida a"], ["internet", "silencio", "acaba com"], ["despertador", "preguica", "vence"],
    ["exame", "ferias", "estraga"], ["trabalho", "fim_de_semana", "estraga"], ["mentira", "verdade", "esconde"],
    ["para_raios", "relampago", "captura"], ["borracha", "relampago", "isola"], ["noite", "arco_iris", "apaga"],
    ["nuvem", "arco_iris", "esconde"], ["fotografia", "tempo", "congela"], ["ferias", "tempo", "fazem parar"],
    ["despertador", "tempo", "controla"], ["cimento", "erosao", "resiste a"], ["arvore", "erosao", "segura a terra contra"],
    ["agua", "acido", "dilui"], ["cientista", "acido", "neutraliza"], ["agua", "sal", "dissolve"], ["chuva", "sal", "dissolve"],
    ["fogo", "iman", "desmagnetiza"], ["calor", "iman", "desmagnetiza"], ["sol", "bolor", "seca"], ["diamante", "lixa", "é mais duro do que"],
    ["tempo", "lixa", "gasta"], ["bebe", "caneta", "rói"], ["agua", "caneta", "borra a tinta d"], ["dragao", "extintor", "esgota"],
    ["vulcao", "extintor", "esgota"], ["agua", "sabao", "enxagua"], ["cao", "sabao", "foge d"], ["programador", "antivirus", "desativa"],
    ["preguica", "antivirus", "nunca atualiza"], ["tesoura", "internet", "corta o cabo d"], ["relampago", "internet", "deita abaixo"],
    ["prego", "bicicleta", "fura o pneu d"], ["montanha", "bicicleta", "cansa"], ["chuva", "bicicleta", "estraga o passeio d"],
    ["meteorito", "foguetao", "atinge"], ["buraco_negro", "foguetao", "engole"], ["relampago", "cao", "assusta"],
    ["gato", "cao", "dá uma patada n"], ["passaro", "formiga", "come"], ["chuva", "formiga", "inunda o formigueiro d"],
    ["passaro", "abelha", "come"], ["inverno", "abelha", "adormece"], ["passaro", "termita", "come"], ["formiga", "termita", "combate"],
    ["passaro", "traca", "apanha"], ["aranha", "traca", "apanha"], ["dragao", "aguia", "assusta"], ["aviao", "aguia", "voa mais alto do que"],
    ["cao", "gaivota", "espanta"], ["vento", "gaivota", "despenteia"], ["tsunami", "golfinho", "arrasta"], ["baleia", "golfinho", "é maior do que"],
    ["cientista", "baleia", "estuda"], ["golfinho", "baleia", "nada mais depressa do que"], ["cao", "raposa", "persegue"],
    ["lobo", "raposa", "assusta"], ["lobo", "cabra", "assusta"], ["cao", "cabra", "guarda"], ["cientista", "unicornio", "não acredita n"],
    ["bruxa", "unicornio", "enfeitiça"], ["mae", "super_heroi", "manda arrumar o quarto a"], ["bebe", "mae", "não deixa dormir"],
    ["calor", "chocolate", "derrete"], ["sol", "chocolate", "derrete"], ["dieta", "chocolate", "proíbe"], ["dieta", "pizza", "proíbe"],
    ["cao", "pizza", "rouba uma fatia d"], ["macaco", "banana", "come"], ["tempo", "banana", "amadurece demais"],
    ["cozinheiro", "alho", "pica"], ["faca", "alho", "corta"], ["tempo", "cafe", "arrefece"], ["gelo", "cafe", "arrefece"],
    ["bebe", "sopa", "recusa"], ["tempo", "sopa", "arrefece"], ["fotografia", "esquecimento", "combate"], ["livro", "esquecimento", "combate"],
    ["tempo", "amor", "põe à prova"], ["ciume", "amor", "estraga"], ["amor", "ciume", "acalma"], ["bebe", "paciencia", "esgota"],
    ["transito", "paciencia", "esgota"], ["barulho", "musica", "abafa"], ["silencio", "musica", "interrompe"], ["calor", "vacina", "estraga"],
    ["tempo", "vacina", "faz caducar"], ["pirata", "diamante", "rouba"], ["bebe", "castelo_areia", "deita abaixo"], ["cao", "castelo_areia", "pisa"],
    ["sol", "nuvem", "evapora"], ["aviao", "nuvem", "atravessa"], ["sol", "estrela", "ofusca"], ["nuvem", "estrela", "tapa"],
    ["foguetao", "meteorito", "desvia"], ["astronauta", "gravidade", "flutua sem"], ["mae", "luz", "manda apagar"],
    ["esponja", "ferrugem", "esfrega"], ["tempo", "bateria", "descarrega"], ["chuva", "fita_cola", "descola"], ["agua", "gato", "assusta"],
    ["inverno", "passaro", "manda migrar"], ["abelha", "elefante", "assusta"], ["cobra", "sapo", "caça"], ["galinha", "lagarta", "come"],
    ["baleia", "tubarao", "é maior do que"], ["fogo", "lobo", "afasta"], ["preguica", "ideia", "adia"], ["caos", "plano", "estraga"],
    ["pirata", "regras", "ignora"], ["ferias", "segunda_feira", "cancelam"], ["bebe", "barulho", "faz mais"], ["tempo", "tornado", "acalma"],
    ["macaco", "cao", "goza com"], ["leao", "macaco", "assusta"], ["cimento", "erva", "tapa"], ["martelo", "cimento", "parte"],
    ["agua", "cimento", "infiltra-se n"], ["relampago", "para_raios", "cai sempre n"], ["ferrugem", "para_raios", "enferruja"],
    ["ciume", "paciencia", "esgota"], ["riso", "ciume", "desarma"],
    ["tornado", "casa", "destelha"], ["termita", "casa", "rói as vigas d"], ["casa", "chuva", "protege d"], ["casa", "frio", "protege d"],
    ["mosca", "cavalo", "não deixa em paz"], ["cobra", "cavalo", "assusta"], ["cavalo", "bicicleta", "é mais rápido do que"], ["cavalo", "erva", "come"],
    ["mosca", "vaca", "chateia"], ["lobo", "vaca", "assusta"], ["vaca", "erva", "come"], ["lobo", "porco", "assusta"],
    ["sabao", "porco", "dá banho a"], ["porco", "lama", "rebola n"], ["porco", "sujidade", "não tem medo d"], ["domador", "tigre", "doma"],
    ["elefante", "tigre", "enfrenta"], ["tigre", "cabra", "assusta"], ["tigre", "macaco", "assusta"], ["calor", "pinguim", "incomoda"],
    ["tubarao", "pinguim", "persegue"], ["pinguim", "frio", "aguenta"], ["pinguim", "peixe", "apanha"], ["raposa", "pato", "assusta"],
    ["cao", "pato", "persegue"], ["pato", "pao", "come"], ["pato", "lagarta", "come"], ["rei", "regras", "faz"],
    ["rei", "cavaleiro", "dá ordens a"], ["escudo", "espada", "trava"], ["martelo", "escudo", "amolga"], ["escudo", "prego", "trava"],
    ["sapato", "prego", "protege d"], ["sapato", "lama", "atravessa"], ["sapato", "formiga", "pisa"], ["chocolate", "dente", "estraga"],
    ["dentista", "dente", "trata"], ["dente", "pao", "trinca"], ["dente", "maca", "trinca"], ["faca", "maca", "descasca"],
    ["lagarta", "maca", "come por dentro"], ["maca", "medico", "mantém longe"], ["maca", "fome", "engana"], ["cao", "bola", "apanha"],
    ["bola", "vidro", "parte"], ["bola", "tedio", "acaba com"], ["agua", "tinta", "dilui"], ["esponja", "tinta", "limpa"],
    ["tinta", "ferrugem", "protege contra"], ["tinta", "papel", "pinta"], ["dentista", "chocolate", "proíbe"]
  ].filter((p) => COISAS[p[0]] && COISAS[p[1]] && p[2]);

  // ---------- Índices ----------
  function normaliza(t) {
    return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/^(o|a|os|as|um|uma|uns|umas|the|um bocado de|muito|muita)\s+/, "")
      .replace(/\s+/g, " ").trim();
  }
  const singular = (t) => t.replace(/oes$/, "ao").replace(/aes$/, "ao").replace(/ns$/, "m").replace(/res$/, "r").replace(/(es|s)$/, "");

  const PARAGENS = ["de", "do", "da", "dos", "das", "com", "sem", "para", "por"];
  const indice = new Map(); // forma normalizada -> id
  const oficiais = new Set(); // nomes "verdadeiros" (não sinónimos)
  for (const [id, c] of Object.entries(COISAS)) {
    const palavras = (c[4] || "").split(" ").filter((w) => w.length > 2 && !PARAGENS.includes(w));
    const formas = [c[0], id.replace(/_/g, " ")].concat(palavras);
    for (const f of [c[0], id.replace(/_/g, " ")]) { const n = normaliza(f); oficiais.add(n); oficiais.add(singular(n)); }
    // sinónimos com várias palavras vêm separados por espaço; junta pares comuns
    const extra = (c[4] || "").match(/\b\w+ (?:de|do|da) \w+\b/g) || [];
    for (const f of formas.concat(extra)) {
      const n = normaliza(f);
      if (n && !indice.has(n)) indice.set(n, id);
      const s = singular(n);
      if (s && !indice.has(s)) indice.set(s, id);
    }
  }
  const etiquetas = (id) => COISAS[id][3].split(" ");

  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }

  /**
   * Procura a coisa e diz como a encontrou:
   *  "exato"      - nome da coisa (com ou sem artigo, plural ou acentos)
   *  "sinonimo"   - um sinónimo conhecido ("mar" -> Oceano)
   *  "aproximado" - parecido, provável erro de escrita: é preciso confirmar
   *  "palavra"    - só uma das palavras é conhecida ("carro de bombeiros"): é preciso confirmar
   */
  function procura(texto) {
    const n = normaliza(texto);
    if (!n) return null;
    for (const f of [n, singular(n), n.split(" ").map(singular).join(" ")]) {
      if (indice.has(f)) return { id: indice.get(f), como: oficiais.has(f) ? "exato" : "sinonimo" };
    }
    // Erros de escrita: só em palavras com 5 ou mais letras, a começar pela mesma letra
    if (n.length >= 5) {
      const lim = n.length >= 9 ? 2 : 1;
      let melhor = null, dist = 9;
      for (const [forma, id] of indice) {
        if (forma[0] !== n[0] || forma.length < 4) continue;
        const dd = distancia(n, forma);
        if (dd <= lim && dd < dist) { dist = dd; melhor = id; }
      }
      if (melhor) return { id: melhor, como: "aproximado" };
    }
    // Uma das palavras de uma frase
    const palavras = n.split(" ").filter((w) => w.length > 2 && !PARAGENS.includes(w));
    if (palavras.length > 1) {
      for (const w of palavras) {
        for (const f of [w, singular(w)]) if (indice.has(f)) return { id: indice.get(f), como: "palavra" };
      }
    }
    return null;
  }
  const encontra = (texto) => { const r = procura(texto); return r ? r.id : null; };

  const comArtigo = (id) => { const c = COISAS[id]; return c[1] + " " + c[0].charAt(0).toLowerCase() + c[0].slice(1); };
  const capital = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function frase(vencedor, perdedor, verbo) {
    // "d"/"n"/"pel" no fim do verbo juntam-se ao artigo: "foge d" + "o trânsito" -> "foge do trânsito"
    const alvo = comArtigo(perdedor);
    let meio;
    if (/ (d|n|pel)$/.test(verbo)) meio = verbo + alvo;
    else if (/ a$/.test(verbo)) meio = verbo.slice(0, -1) + alvo.replace(/^o /, "ao ").replace(/^os /, "aos ").replace(/^a /, "à ").replace(/^as /, "às ");
    else meio = verbo + " " + alvo;
    return capital(comArtigo(vencedor)) + " " + meio + ".";
  }

  /** Devolve a frase se `a` vence `b`, ou null. */
  function vence(a, b) {
    if (a === b) return null;
    const par = PARES.find((p) => p[0] === a && p[1] === b);
    if (par) return frase(a, b, par[2]);
    const ta = etiquetas(a).concat(a), tb = etiquetas(b);
    for (const [x, y, verbo] of REGRAS) {
      if (ta.includes(x) && tb.includes(y)) return frase(a, b, verbo);
    }
    return null;
  }

  const TODOS = Object.keys(COISAS);
  function quemVence(alvo, excluir) {
    return TODOS.filter((id) => !excluir.includes(id) && vence(id, alvo));
  }

  function coisa(id, explicacao) {
    const c = COISAS[id];
    return { id, nome: c[0], emoji: c[2], explicacao: explicacao || "" };
  }

  const FRASES_DERROTA = [
    "Não vejo como. Isso não chega para vencer {b}.",
    "Bela tentativa, mas {a} não tem hipótese contra {b}.",
    "Hmm, não. {A} perde para {b} (ou, no máximo, empata).",
    "O árbitro coçou a cabeça e disse que não. {A} não vence {b}."
  ];

  window.ArbitroClassico = {
    total: TODOS.length,
    encontra,
    /** Mesmo formato que o árbitro com IA, mais `desconhecido` quando não conhece a jogada. */
    julgar({ atualId, jogada, usadosIds, confirmadoId }) {
      const achado = confirmadoId ? { id: confirmadoId, como: "confirmado" } : procura(jogada);
      if (!achado) return { desconhecido: true, valido: false, vence: false, jogada: { nome: jogada, emoji: "❓", explicacao: "" }, rival: null };
      const id = achado.id;
      if (achado.como === "aproximado" || achado.como === "palavra") {
        return { confirmar: true, valido: false, vence: false, jogada: coisa(id), rival: null };
      }
      const nota = achado.como === "sinonimo" ? "(\u00ab" + jogada.trim() + "\u00bb conta como " + COISAS[id][0] + ") " : "";
      if (usadosIds.includes(id)) return { repetido: true, valido: false, vence: false, jogada: coisa(id), rival: null };
      const f = vence(id, atualId);
      if (!f) {
        const t = FRASES_DERROTA[Math.floor(Math.random() * FRASES_DERROTA.length)]
          .replace("{A}", capital(comArtigo(id))).replace("{a}", comArtigo(id)).replace("{b}", comArtigo(atualId));
        return { valido: true, vence: false, jogada: coisa(id, nota + t), rival: null };
      }
      const opcoes = quemVence(id, usadosIds.concat(id));
      const r = opcoes.length ? opcoes[Math.floor(Math.random() * opcoes.length)] : null;
      return { valido: true, vence: true, jogada: coisa(id, nota + f), rival: r ? coisa(r, vence(r, id)) : null };
    },
    dica(atualId, usadosIds) {
      const opcoes = quemVence(atualId, usadosIds);
      return opcoes.length ? coisa(opcoes[Math.floor(Math.random() * opcoes.length)]) : null;
    },
    coisa,
    procura,
    // Para testes
    _vence: vence, _quemVence: quemVence, _todos: TODOS
  };
})();
