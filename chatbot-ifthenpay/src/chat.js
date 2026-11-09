// Lógica do chatbot: conversa com o Claude e expõe ferramentas para
// consultar o catálogo, gerar referências Multibanco e verificar pagamentos.
//
// Os montantes são SEMPRE calculados no servidor a partir do catálogo: o modelo
// só escolhe produtos e quantidades, nunca o preço.

import Anthropic from "@anthropic-ai/sdk";
import { formatReference } from "./ifthenpay.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 60;

const SYSTEM_PROMPT = `És o assistente de pagamentos de uma loja portuguesa. Falas português de Portugal, de forma simpática e concisa.

O teu trabalho:
- Ajudar o cliente a escolher produtos/serviços do catálogo (usa a ferramenta listar_produtos; nunca inventes produtos nem preços).
- Quando o cliente quiser pagar, recolher o nome e o email (o telefone é opcional), confirmar o resumo da encomenda e o total, e só depois de o cliente confirmar chamar criar_referencia_multibanco.
- Apresentar a entidade, a referência e o montante de forma clara, e explicar que pode pagar num multibanco, no homebanking ou na app do banco (Pagamentos > Pagamento de Serviços).
- Quando o cliente perguntar se o pagamento já foi recebido, usar consultar_pagamento.

Regras:
- O pagamento é exclusivamente por referência Multibanco.
- Não aceites descontos, preços alterados ou montantes ditados pelo cliente; o total vem sempre da ferramenta.
- Nunca peças dados bancários, cartões ou palavras-passe.
- Se uma ferramenta devolver erro, explica o problema ao cliente em linguagem simples.`;

const TOOLS = [
  {
    name: "listar_produtos",
    description: "Devolve o catálogo de produtos/serviços disponíveis com id, nome e preço em euros.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "criar_referencia_multibanco",
    description:
      "Cria uma encomenda e gera uma referência Multibanco (entidade, referência e montante) na ifthenpay. " +
      "Usar apenas depois de o cliente confirmar os produtos, as quantidades e o total.",
    input_schema: {
      type: "object",
      properties: {
        itens: {
          type: "array",
          description: "Produtos a comprar",
          items: {
            type: "object",
            properties: {
              produto_id: { type: "string", description: "id do produto no catálogo" },
              quantidade: { type: "integer", description: "Quantidade (1 a 100)" },
            },
            required: ["produto_id", "quantidade"],
            additionalProperties: false,
          },
        },
        nome: { type: "string", description: "Nome do cliente" },
        email: { type: "string", description: "Email do cliente" },
        telefone: { type: "string", description: "Telefone do cliente, ou string vazia" },
      },
      required: ["itens", "nome", "email", "telefone"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "consultar_pagamento",
    description:
      "Consulta o estado (pendente/pago) das encomendas desta conversa. " +
      "Passar order_id para uma encomenda específica, ou string vazia para todas.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class PaymentChatbot {
  /**
   * @param {object} deps
   * @param {import("./ifthenpay.js").IfthenpayClient} deps.ifthenpay
   * @param {import("./store.js").OrderStore} deps.store
   * @param {Array<{id: string, nome: string, preco: number}>} deps.catalog
   * @param {Anthropic} [deps.anthropic]
   */
  constructor({ ifthenpay, store, catalog, anthropic = new Anthropic() }) {
    this.ifthenpay = ifthenpay;
    this.store = store;
    this.catalog = catalog;
    this.client = anthropic;
    this.sessions = new Map(); // sessionId -> { messages, updatedAt }
  }

  #session(sessionId) {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = { messages: [], updatedAt: Date.now() };
      this.sessions.set(sessionId, s);
    }
    s.updatedAt = Date.now();
    return s;
  }

  /** Remove sessões inativas há mais de `maxAgeMs`. */
  pruneSessions(maxAgeMs = 6 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, s] of this.sessions) if (s.updatedAt < cutoff) this.sessions.delete(id);
  }

  /**
   * Processa uma mensagem do utilizador e devolve a resposta do assistente.
   * @returns {Promise<{reply: string, payments: object[]}>}
   */
  async handleMessage(sessionId, text) {
    const session = this.#session(sessionId);
    // Em vez de cortar mensagens antigas (o que altera o histórico e invalida os
    // blocos de raciocínio guardados), recomeça a conversa quando fica longa demais.
    // As encomendas continuam associadas à sessão.
    if (session.messages.length > MAX_HISTORY_MESSAGES) session.messages = [];
    // Trabalha numa cópia: se o pedido falhar, o histórico da sessão fica intacto.
    const messages = [...session.messages, { role: "user", content: text }];
    const payments = [];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
        output_config: { effort: "low" },
        // Se os classificadores de segurança recusarem o pedido, a API repete-o
        // automaticamente noutro modelo recomendado.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (response.stop_reason === "refusal") {
        return { reply: "Desculpe, não consigo ajudar com esse pedido.", payments };
      }

      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "pause_turn") continue;

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0 || round === MAX_TOOL_ROUNDS) {
        session.messages = messages;
        const reply = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { reply: reply || "Pode repetir, por favor?", payments };
      }

      const results = [];
      for (const tu of toolUses) {
        try {
          const out = await this.#runTool(sessionId, tu.name, tu.input);
          if (out.payment) payments.push(out.payment);
          results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out.result) });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: tu.id, content: `Erro: ${err.message}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("Ciclo de ferramentas terminou sem resposta");
  }

  async #runTool(sessionId, name, input) {
    switch (name) {
      case "listar_produtos":
        return {
          result: this.catalog.map((p) => ({ id: p.id, nome: p.nome, preco_eur: p.preco.toFixed(2) })),
        };

      case "criar_referencia_multibanco":
        return this.#createReference(sessionId, input);

      case "consultar_pagamento": {
        const mine = this.store.listBySession(sessionId);
        const list = input.order_id ? mine.filter((o) => o.orderId === input.order_id) : mine;
        if (list.length === 0) return { result: { encomendas: [], nota: "Não há encomendas correspondentes nesta conversa." } };
        return {
          result: {
            encomendas: list.map((o) => ({
              order_id: o.orderId,
              estado: o.status,
              total_eur: o.amount,
              entidade: o.entity,
              referencia: formatReference(o.reference),
              pago_em: o.paidAt,
            })),
          },
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  }

  async #createReference(sessionId, { itens, nome, email, telefone }) {
    if (!Array.isArray(itens) || itens.length === 0) throw new Error("A encomenda não tem produtos.");
    if (!nome || !nome.trim()) throw new Error("Falta o nome do cliente.");
    if (!EMAIL_RE.test(email || "")) throw new Error("O email indicado não é válido.");

    const linhas = itens.map(({ produto_id, quantidade }) => {
      const p = this.catalog.find((x) => x.id === produto_id);
      if (!p) throw new Error(`Produto inexistente: ${produto_id}`);
      if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
        throw new Error(`Quantidade inválida para ${p.nome}.`);
      }
      return { produto_id, nome: p.nome, quantidade, subtotal_cent: Math.round(p.preco * 100) * quantidade };
    });
    const totalCent = linhas.reduce((s, l) => s + l.subtotal_cent, 0);
    const amount = (totalCent / 100).toFixed(2);

    const orderId = this.store.newOrderId();
    const description = linhas.map((l) => `${l.quantidade}x ${l.nome}`).join(", ");
    const ref = await this.ifthenpay.createReference({
      orderId,
      amount,
      description,
      clientName: nome.trim(),
      clientEmail: email.trim(),
      clientPhone: (telefone || "").trim(),
    });

    const order = this.store.create({
      orderId,
      sessionId,
      items: linhas.map(({ subtotal_cent, ...l }) => ({ ...l, subtotal: (subtotal_cent / 100).toFixed(2) })),
      amount,
      customer: { nome: nome.trim(), email: email.trim(), telefone: (telefone || "").trim() },
      entity: ref.entity,
      reference: ref.reference,
      requestId: ref.requestId,
      expiryDate: ref.expiryDate,
    });

    const payment = {
      orderId,
      entity: order.entity,
      reference: formatReference(order.reference),
      amount,
      expiryDate: order.expiryDate,
      status: order.status,
    };
    return {
      payment,
      result: {
        order_id: orderId,
        entidade: payment.entity,
        referencia: payment.reference,
        montante_eur: amount,
        validade: payment.expiryDate || "sem data de expiração",
        itens: order.items,
      },
    };
  }
}
