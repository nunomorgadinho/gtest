// Cliente mínimo para a API de referências Multibanco dinâmicas da ifthenpay.
//
// Documentação: https://ifthenpay.com/docs/en/api/multibanco/
//   POST https://api.ifthenpay.com/multibanco/reference/init     (produção)
//   POST https://api.ifthenpay.com/multibanco/reference/sandbox  (testes)
// Resposta de sucesso: { Status: "0", Entity, Reference, Amount, RequestId, ExpiryDate, OrderId, Message }

const BASE_URL = "https://api.ifthenpay.com/multibanco/reference";

export class IfthenpayError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "IfthenpayError";
    this.details = details;
  }
}

/** Formata um valor em euros com 2 casas decimais, como a API espera ("10.50"). */
export function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new IfthenpayError(`Montante inválido: ${amount}`);
  }
  if (n > 99999.99) {
    throw new IfthenpayError("O montante máximo de uma referência Multibanco é 99 999,99 €");
  }
  return n.toFixed(2);
}

/** Formata a referência no formato habitual de 3 em 3 dígitos ("123 456 789"). */
export function formatReference(reference) {
  return String(reference).replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ");
}

export class IfthenpayClient {
  /**
   * @param {object} opts
   * @param {string} opts.mbKey      Chave Multibanco (ex.: "ABC-123456"), fornecida pela ifthenpay
   * @param {boolean} [opts.sandbox] Usar o endpoint de sandbox
   * @param {number} [opts.expiryDays] Dias até a referência expirar (vazio = sem prazo)
   * @param {typeof fetch} [opts.fetchImpl] Para testes
   */
  constructor({ mbKey, sandbox = false, expiryDays, fetchImpl = fetch }) {
    if (!mbKey) throw new IfthenpayError("IFTHENPAY_MB_KEY não está definida");
    this.mbKey = mbKey;
    this.sandbox = sandbox;
    this.expiryDays = expiryDays;
    this.fetch = fetchImpl;
  }

  /**
   * Cria uma referência Multibanco dinâmica.
   * @returns {Promise<{entity: string, reference: string, amount: string, requestId: string, expiryDate: string|null, orderId: string}>}
   */
  async createReference({ orderId, amount, description = "", clientName = "", clientEmail = "", clientPhone = "" }) {
    if (!orderId || String(orderId).length > 25) {
      throw new IfthenpayError("orderId é obrigatório e tem no máximo 25 caracteres");
    }
    const body = {
      mbKey: this.mbKey,
      orderId: String(orderId),
      amount: formatAmount(amount),
      description: description.slice(0, 200),
      url: "",
      clientCode: "",
      clientName: clientName.slice(0, 200),
      clientEmail: clientEmail.slice(0, 200),
      clientUsername: "",
      clientPhone: clientPhone.slice(0, 20),
      expiryDays: this.expiryDays != null && this.expiryDays !== "" ? String(this.expiryDays) : "",
    };

    const url = `${BASE_URL}/${this.sandbox ? "sandbox" : "init"}`;
    let res;
    try {
      res = await this.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new IfthenpayError(`Falha de ligação à ifthenpay: ${err.message}`);
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new IfthenpayError(`Resposta inesperada da ifthenpay (HTTP ${res.status})`, text.slice(0, 500));
    }

    if (!res.ok || String(data.Status) !== "0") {
      throw new IfthenpayError(data.Message || `Erro da ifthenpay (HTTP ${res.status})`, data);
    }

    return {
      entity: String(data.Entity),
      reference: String(data.Reference),
      amount: String(data.Amount ?? body.amount),
      requestId: String(data.RequestId ?? ""),
      expiryDate: data.ExpiryDate || null,
      orderId: String(data.OrderId ?? body.orderId),
    };
  }
}
