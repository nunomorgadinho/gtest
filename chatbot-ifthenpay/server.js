import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { IfthenpayClient, formatReference } from "./src/ifthenpay.js";
import { OrderStore } from "./src/store.js";
import { PaymentChatbot } from "./src/chat.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = "3000",
  IFTHENPAY_MB_KEY,
  IFTHENPAY_ANTI_PHISHING_KEY,
  IFTHENPAY_SANDBOX = "true",
  IFTHENPAY_EXPIRY_DAYS = "3",
  DATA_FILE = path.join(here, "data", "orders.json"),
} = process.env;

const sandbox = IFTHENPAY_SANDBOX === "true";

if (!IFTHENPAY_ANTI_PHISHING_KEY) {
  console.warn("Aviso: IFTHENPAY_ANTI_PHISHING_KEY não definida; o callback de pagamento vai rejeitar todos os pedidos.");
}

const catalog = JSON.parse(fs.readFileSync(path.join(here, "catalog.json"), "utf8"));
const store = new OrderStore(DATA_FILE);
const ifthenpay = new IfthenpayClient({ mbKey: IFTHENPAY_MB_KEY, sandbox, expiryDays: IFTHENPAY_EXPIRY_DAYS });
const bot = new PaymentChatbot({ ifthenpay, store, catalog });
setInterval(() => bot.pruneSessions(), 30 * 60 * 1000).unref();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(here, "public")));

const SESSION_RE = /^[A-Za-z0-9-]{16,64}$/;

// --- Chat -------------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (typeof sessionId !== "string" || !SESSION_RE.test(sessionId)) {
    return res.status(400).json({ error: "sessionId inválido" });
  }
  if (typeof message !== "string" || !message.trim() || message.length > 2000) {
    return res.status(400).json({ error: "Mensagem vazia ou demasiado longa" });
  }
  try {
    const out = await bot.handleMessage(sessionId, message.trim());
    res.json(out);
  } catch (err) {
    console.error("Erro no chat:", err);
    res.status(502).json({ error: "O assistente não está disponível de momento. Tente novamente." });
  }
});

// Estado de uma encomenda (usado pela interface para atualizar o cartão de pagamento)
app.get("/api/orders/:orderId", (req, res) => {
  const order = store.get(req.params.orderId);
  if (!order || order.sessionId !== req.query.sessionId) return res.status(404).json({ error: "Não encontrada" });
  res.json({
    orderId: order.orderId,
    status: order.status,
    amount: order.amount,
    entity: order.entity,
    reference: formatReference(order.reference),
    paidAt: order.paidAt,
  });
});

// --- Callback da ifthenpay ----------------------------------------------------
// Configurar no backoffice da ifthenpay (ou pedindo ao suporte) o URL:
//   https://O-SEU-DOMINIO/ifthenpay/callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&entity=[ENTITY]&reference=[REFERENCE]&payment_datetime=[PAYMENT_DATETIME]
function safeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function handleCallback(req, res) {
  const p = { ...req.query, ...(typeof req.body === "object" ? req.body : {}) };
  if (!IFTHENPAY_ANTI_PHISHING_KEY || !safeEqual(p.key, IFTHENPAY_ANTI_PHISHING_KEY)) {
    console.warn("Callback rejeitado: chave anti-phishing inválida");
    return res.status(403).send("Forbidden");
  }

  const order = store.get(String(p.orderId ?? ""));
  if (!order) {
    console.warn("Callback para encomenda desconhecida:", p.orderId);
    return res.status(404).send("Order not found");
  }

  const { key, ...raw } = p; // nunca registar nem guardar a chave
  const ref = String(p.reference ?? "").replace(/\D/g, "");
  const amountPaid = Number(String(p.amount ?? "").replace(",", "."));
  if ((ref && ref !== order.reference) || !(Math.abs(amountPaid - Number(order.amount)) < 0.005)) {
    console.warn("Callback com dados que não coincidem com a encomenda", order.orderId, raw);
    return res.status(400).send("Mismatch");
  }

  store.markPaid(order.orderId, { paidAt: p.payment_datetime, amount: amountPaid.toFixed(2), raw });
  console.log(`Pagamento recebido: ${order.orderId} (${order.amount} €)`);
  res.status(200).send("OK");
}

app.get("/ifthenpay/callback", handleCallback);
app.post("/ifthenpay/callback", express.urlencoded({ extended: false }), handleCallback);

// --- Apenas em sandbox: simular o pagamento de uma encomenda ------------------
if (sandbox) {
  app.post("/api/dev/simulate-payment/:orderId", (req, res) => {
    const order = store.get(req.params.orderId);
    if (!order || order.sessionId !== req.body?.sessionId) return res.status(404).json({ error: "Não encontrada" });
    store.markPaid(order.orderId, { amount: order.amount, raw: { simulated: true } });
    res.json({ ok: true });
  });
}

app.listen(Number(PORT), () => {
  console.log(`Chatbot a correr em http://localhost:${PORT} (${sandbox ? "SANDBOX" : "PRODUÇÃO"})`);
});
