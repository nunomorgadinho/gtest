// Rumo às Metas: proxy do InvoiceXpress (Cloudflare Worker)
//
// Guarda a chave da API do InvoiceXpress em segredo e devolve só a faturação
// sem IVA por mês. Variáveis (Settings > Variables and Secrets):
//   IX_ACCOUNT       nome da conta (o "xxx" de xxx.app.invoicexpress.com)
//   IX_API_KEY       chave da API do InvoiceXpress (secret)
//   ACCESS_TOKEN     código de acesso que a app envia (secret)
//   ALLOWED_ORIGINS  origens autorizadas, separadas por vírgulas
//                    (ex.: https://nunomorgadinho.github.io)
//
// GET /monthly?from=AAAA-MM-DD&to=AAAA-MM-DD
//   Authorization: Bearer <ACCESS_TOKEN>
//   -> { months: [{ month: "2026-01", revenue: 33029.88 }], documents, from, to, generated_at }

const COUNTED_TYPES = ["Invoice", "InvoiceReceipt", "SimplifiedInvoice", "DebitNote", "CreditNote"];
const EXCLUDED_STATUS = ["draft", "canceled", "cancelled"];

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true }, 200, cors);
    if (url.pathname !== "/monthly" || request.method !== "GET") return json({ error: "not_found" }, 404, cors);

    if (!cors["Access-Control-Allow-Origin"] && request.headers.get("Origin")) {
      return json({ error: "origin_not_allowed" }, 403, cors);
    }
    const auth = request.headers.get("Authorization") || "";
    if (!env.ACCESS_TOKEN || !safeEqual(auth, "Bearer " + env.ACCESS_TOKEN)) {
      return json({ error: "unauthorized" }, 401, cors);
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!isISODate(from) || !isISODate(to)) return json({ error: "from_to_required" }, 400, cors);

    try {
      const docs = await listInvoices(env, from, to);
      const byMonth = {};
      let documents = 0;
      for (const d of docs) {
        if (!COUNTED_TYPES.includes(d.type) || EXCLUDED_STATUS.includes(d.status)) continue;
        const month = monthOf(d.date);
        const value = Math.abs(Number(d.before_taxes ?? d.total_before_taxes ?? 0));
        if (!month || !isFinite(value)) continue;
        byMonth[month] = (byMonth[month] || 0) + (d.type === "CreditNote" ? -value : value);
        documents++;
      }
      const months = Object.keys(byMonth).sort()
        .map((month) => ({ month, revenue: Math.round(byMonth[month] * 100) / 100 }));
      return json({ months, documents, from, to, generated_at: new Date().toISOString() }, 200, cors);
    } catch (e) {
      return json({ error: "invoicexpress_failed", detail: String(e.message || e) }, 502, cors);
    }
  }
};

// Documentos arquivados também são faturação: pede os dois grupos e junta sem repetidos
async function listInvoices(env, from, to) {
  const byId = new Map();
  for (const filter of ["non_archived", "archived"]) {
    for (const d of await listPages(env, from, to, filter)) byId.set(d.id, d);
  }
  return [...byId.values()];
}

async function listPages(env, from, to, filter) {
  const base = "https://" + env.IX_ACCOUNT + ".app.invoicexpress.com/invoices.json";
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const q = new URLSearchParams({
      api_key: env.IX_API_KEY,
      "date[from]": toPT(from),
      "date[to]": toPT(to),
      [filter]: "true",
      per_page: "100",
      page: String(page)
    });
    const res = await fetch(base + "?" + q.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("InvoiceXpress HTTP " + res.status);
    const body = await res.json();
    all.push(...(body.invoices || []));
    const totalPages = body.pagination ? Number(body.pagination.total_pages) : 1;
    if (page >= totalPages) break;
  }
  return all;
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
  if (origin && allowed.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, headers)
  });
}

// O InvoiceXpress usa dd/mm/aaaa; aceita também datas ISO na resposta
function toPT(iso) { const [y, m, d] = iso.split("-"); return d + "/" + m + "/" + y; }
function monthOf(date) {
  if (!date) return null;
  let m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(date);
  if (m) return m[3] + "-" + m[2];
  m = /^(\d{4})-(\d{2})/.exec(date);
  return m ? m[1] + "-" + m[2] : null;
}
function isISODate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
