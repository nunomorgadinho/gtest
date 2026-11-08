/*
 * Árbitro do "Pedra, Papel, Infinito": decide com o Claude se uma jogada vence a anterior.
 * É empacotado com o esbuild para assets/arbitro.js e exposto como window.Arbitro.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const MODELO = "claude-opus-5-5";

const Coisa = z.object({
  nome: z.string().describe("Nome curto da coisa, em português de Portugal, com maiúscula inicial"),
  emoji: z.string().describe("Um único emoji que represente a coisa"),
  explicacao: z.string().describe("Uma ou duas frases curtas e divertidas a justificar porque vence")
});

const Veredito = z.object({
  valido: z.boolean().describe("false se a jogada for vazia, ilegível, ofensiva ou uma batota genérica"),
  vence: z.boolean().describe("true se a jogada vence a coisa atual"),
  jogada: Coisa.describe("A jogada do jogador, normalizada; a explicação diz porque vence ou porque perde"),
  rival: Coisa.describe("Modo duelo: uma coisa nova e surpreendente que vence a jogada do jogador")
});

const SISTEMA = `És o árbitro do jogo "Pedra, Papel, Infinito", um pedra-papel-tesoura sem fim, em português de Portugal.

Recebes a coisa ATUAL e a JOGADA do jogador. Decide se a jogada vence a atual.

Como julgar:
- Vale tudo: objetos, animais, pessoas genéricas, forças da natureza, conceitos, emoções, acontecimentos, ficção.
- A jogada vence se houver uma razão lógica, física, simbólica ou criativamente convincente para ganhar. Premeia ideias inteligentes e engraçadas.
- Sê exigente mas justo: se a ligação for fraca, forçada ou não fizer sentido, a jogada perde.
- Batota genérica perde sempre e é inválida: "o que vence tudo", "infinito mais um", "a coisa que ganha a X", "nada pode vencer isto" e semelhantes.
- Uma versão maior ou mais forte da mesma coisa ("pedra gigante" contra "pedra") perde, a não ser que seja criativa.
- Coisas da lista JÁ USADAS não podem repetir-se: se a jogada for a mesma coisa (mesmo com outras palavras), perde.
- Jogadas ofensivas, sexuais, de ódio ou que ataquem pessoas reais são inválidas. Responde com simpatia e sem repetir o conteúdo.

Escreve sempre em português de Portugal, com humor leve e adequado a todas as idades. Explicações curtas: no máximo 25 palavras, sem travessões.

No campo "rival", inventa uma coisa nova (que não esteja nas JÁ USADAS nem seja a jogada) que vença a jogada do jogador de forma surpreendente e divertida. Preenche-o sempre, mesmo que a jogada perca.`;

function mensagem({ atual, jogada, usadas }) {
  return `ATUAL: ${atual}
JOGADA: ${jogada}
JÁ USADAS: ${usadas.length ? usadas.join(", ") : "(nenhuma)"}`;
}

/** Erros com uma mensagem amigável para mostrar ao jogador. */
export class ErroArbitro extends Error {
  constructor(tipo, mensagem) { super(mensagem); this.tipo = tipo; }
}

export async function julgar(chave, dados) {
  if (!chave) throw new ErroArbitro("sem-chave", "Falta a chave da API. Abre as definições ⚙️.");
  const client = new Anthropic({
    apiKey: chave,
    // A chave é do próprio jogador e fica só no telemóvel dele.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    timeout: 60_000
  });

  let resposta;
  try {
    resposta = await client.beta.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Veredito) },
      system: SISTEMA,
      messages: [{ role: "user", content: mensagem(dados) }]
    });
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) throw new ErroArbitro("chave", "A chave da API não é válida. Confirma-a nas definições ⚙️.");
    if (erro instanceof Anthropic.PermissionDeniedError) throw new ErroArbitro("chave", "Esta chave não tem acesso ao modelo. Confirma a conta na consola da Anthropic.");
    if (erro instanceof Anthropic.RateLimitError) throw new ErroArbitro("limite", "O árbitro está sobrecarregado. Espera um bocadinho e tenta outra vez.");
    if (erro instanceof Anthropic.BadRequestError) throw new ErroArbitro("pedido", "O árbitro não percebeu o pedido: " + erro.message);
    if (erro instanceof Anthropic.APIConnectionError) throw new ErroArbitro("rede", "Sem ligação à internet. Verifica a rede e tenta outra vez.");
    if (erro instanceof Anthropic.APIError) throw new ErroArbitro("api", "O árbitro teve um problema (" + erro.status + "). Tenta outra vez.");
    throw new ErroArbitro("desconhecido", "Algo correu mal: " + (erro && erro.message ? erro.message : erro));
  }

  if (resposta.stop_reason === "refusal") {
    return {
      valido: false,
      vence: false,
      jogada: { nome: dados.jogada, emoji: "🙅", explicacao: "O árbitro recusou-se a julgar esta jogada. Tenta outra coisa!" },
      rival: null
    };
  }
  if (!resposta.parsed_output) {
    throw new ErroArbitro("formato", "O árbitro respondeu de forma estranha. Tenta outra vez.");
  }
  return resposta.parsed_output;
}
