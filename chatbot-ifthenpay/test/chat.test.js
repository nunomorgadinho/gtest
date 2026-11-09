import { test } from "node:test";
import assert from "node:assert/strict";
import { PaymentChatbot } from "../src/chat.js";
import { OrderStore } from "../src/store.js";

const catalog = [
  { id: "a", nome: "Produto A", preco: 25 },
  { id: "b", nome: "Produto B", preco: 9.9 },
];

/** Cliente Anthropic falso que devolve respostas pré-definidas e regista os pedidos. */
function fakeAnthropic(responses) {
  const requests = [];
  return {
    requests,
    beta: { messages: { create: async (params) => {
      requests.push(structuredClone(params));
      return responses.shift();
    } } },
  };
}

test("gera referência com o montante calculado no servidor", async () => {
  const ifthenCalls = [];
  const ifthenpay = { createReference: async (args) => {
    ifthenCalls.push(args);
    return { entity: "12345", reference: "111222333", amount: args.amount, requestId: "r", expiryDate: null, orderId: args.orderId };
  } };
  const anthropic = fakeAnthropic([
    { stop_reason: "tool_use", content: [
      { type: "text", text: "Vou gerar a referência." },
      { type: "tool_use", id: "t1", name: "criar_referencia_multibanco",
        input: { itens: [{ produto_id: "a", quantidade: 1 }, { produto_id: "b", quantidade: 2 }], nome: "Ana", email: "ana@ex.pt", telefone: "" } },
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Aqui está a sua referência." }] },
  ]);
  const store = new OrderStore(null);
  const bot = new PaymentChatbot({ ifthenpay, store, catalog, anthropic });

  const out = await bot.handleMessage("sess-1234567890abcdef", "Confirmo, quero pagar");
  assert.equal(out.reply, "Aqui está a sua referência.");
  assert.equal(out.payments.length, 1);
  assert.equal(out.payments[0].amount, "44.80");
  assert.equal(out.payments[0].reference, "111 222 333");
  assert.equal(ifthenCalls[0].amount, "44.80");

  // O segundo pedido inclui o tool_result com os dados da referência
  const last = anthropic.requests[1].messages.at(-1);
  assert.equal(last.role, "user");
  assert.equal(last.content[0].type, "tool_result");
  assert.match(last.content[0].content, /111 222 333/);

  const orders = store.listBySession("sess-1234567890abcdef");
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, "pendente");
  store.markPaid(orders[0].orderId, { amount: "44.80" });
  assert.equal(store.get(orders[0].orderId).status, "pago");
});

test("produto inexistente devolve erro à ferramenta sem chamar a ifthenpay", async () => {
  let called = false;
  const ifthenpay = { createReference: async () => { called = true; } };
  const anthropic = fakeAnthropic([
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t1", name: "criar_referencia_multibanco",
        input: { itens: [{ produto_id: "zzz", quantidade: 1 }], nome: "Rui", email: "rui@ex.pt", telefone: "" } },
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Esse produto não existe." }] },
  ]);
  const bot = new PaymentChatbot({ ifthenpay, store: new OrderStore(null), catalog, anthropic });
  await bot.handleMessage("sess-abcdefabcdefabcd", "quero o zzz");
  assert.equal(called, false);
  const tr = anthropic.requests[1].messages.at(-1).content[0];
  assert.equal(tr.is_error, true);
  assert.match(tr.content, /Produto inexistente/);
});

test("consultar_pagamento só vê encomendas da própria sessão", async () => {
  const store = new OrderStore(null);
  store.create({ orderId: "O1", sessionId: "outra-sessao-xxxxxxxx", amount: "1.00", entity: "1", reference: "123" });
  const anthropic = fakeAnthropic([
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "consultar_pagamento", input: { order_id: "O1" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "ok" }] },
  ]);
  const bot = new PaymentChatbot({ ifthenpay: {}, store, catalog, anthropic });
  await bot.handleMessage("sess-minha-sessao-123", "já paguei?");
  const tr = anthropic.requests[1].messages.at(-1).content[0];
  assert.match(tr.content, /"encomendas":\[\]/);
});

test("falha da API não estraga o histórico da sessão", async () => {
  const anthropic = { beta: { messages: { create: async () => { throw new Error("boom"); } } } };
  const bot = new PaymentChatbot({ ifthenpay: {}, store: new OrderStore(null), catalog, anthropic });
  await assert.rejects(bot.handleMessage("sess-falha-falha-123", "olá"));
  anthropic.beta.messages.create = async (p) => {
    assert.equal(p.messages.length, 1); // só a nova mensagem, sem a que falhou
    return { stop_reason: "end_turn", content: [{ type: "text", text: "Olá!" }] };
  };
  const out = await bot.handleMessage("sess-falha-falha-123", "olá de novo");
  assert.equal(out.reply, "Olá!");
});
