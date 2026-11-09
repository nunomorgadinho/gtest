import { test } from "node:test";
import assert from "node:assert/strict";
import { IfthenpayClient, IfthenpayError, formatAmount, formatReference } from "../src/ifthenpay.js";

function fakeFetch(status, body, calls = []) {
  return async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
}

test("formatAmount e formatReference", () => {
  assert.equal(formatAmount(10), "10.00");
  assert.equal(formatAmount("9.9"), "9.90");
  assert.throws(() => formatAmount(0), IfthenpayError);
  assert.throws(() => formatAmount(100000), IfthenpayError);
  assert.equal(formatReference("123456789"), "123 456 789");
});

test("createReference envia o pedido certo e interpreta a resposta", async () => {
  const calls = [];
  const client = new IfthenpayClient({
    mbKey: "ABC-123456",
    sandbox: true,
    expiryDays: 3,
    fetchImpl: fakeFetch(200, {
      Amount: "34.90", Entity: "12345", ExpiryDate: "12-11-2026", Message: "Success",
      OrderId: "CB1", Reference: "987654321", RequestId: "req-1", Status: "0",
    }, calls),
  });
  const r = await client.createReference({ orderId: "CB1", amount: 34.9, description: "x", clientEmail: "a@b.pt" });
  assert.equal(calls[0].url, "https://api.ifthenpay.com/multibanco/reference/sandbox");
  assert.equal(calls[0].body.mbKey, "ABC-123456");
  assert.equal(calls[0].body.amount, "34.90");
  assert.equal(calls[0].body.expiryDays, "3");
  assert.deepEqual(r, { entity: "12345", reference: "987654321", amount: "34.90", requestId: "req-1", expiryDate: "12-11-2026", orderId: "CB1" });
});

test("createReference usa o endpoint de produção quando sandbox=false", async () => {
  const calls = [];
  const client = new IfthenpayClient({ mbKey: "K", fetchImpl: fakeFetch(200, { Status: "0", Entity: "1", Reference: "2", Amount: "1.00" }, calls) });
  await client.createReference({ orderId: "X", amount: 1 });
  assert.equal(calls[0].url, "https://api.ifthenpay.com/multibanco/reference/init");
});

test("createReference lança erro quando Status != 0", async () => {
  const client = new IfthenpayClient({ mbKey: "K", fetchImpl: fakeFetch(200, { Status: "-1", Message: "Invalid key" }) });
  await assert.rejects(client.createReference({ orderId: "X", amount: 1 }), /Invalid key/);
});

test("createReference lança erro com resposta não-JSON", async () => {
  const client = new IfthenpayClient({ mbKey: "K", fetchImpl: fakeFetch(500, "<html>") });
  await assert.rejects(client.createReference({ orderId: "X", amount: 1 }), /HTTP 500/);
});
