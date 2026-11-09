// Armazenamento simples de encomendas num ficheiro JSON.
// Para produção, trocar por uma base de dados (PostgreSQL, SQLite, ...).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export class OrderStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.orders = new Map();
    if (filePath && fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      for (const o of data) this.orders.set(o.orderId, o);
    }
  }

  #save() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify([...this.orders.values()], null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  /** Gera um id de encomenda curto e único (a ifthenpay aceita até 25 caracteres). */
  newOrderId() {
    let id;
    do {
      id = `CB${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    } while (this.orders.has(id));
    return id;
  }

  create(order) {
    const record = { ...order, status: "pendente", createdAt: new Date().toISOString(), paidAt: null };
    this.orders.set(record.orderId, record);
    this.#save();
    return record;
  }

  get(orderId) {
    return this.orders.get(orderId) ?? null;
  }

  listBySession(sessionId) {
    return [...this.orders.values()].filter((o) => o.sessionId === sessionId);
  }

  markPaid(orderId, { paidAt, amount, raw }) {
    const o = this.orders.get(orderId);
    if (!o) return null;
    if (o.status !== "pago") {
      o.status = "pago";
      o.paidAt = paidAt || new Date().toISOString();
      o.paidAmount = amount;
      o.callback = raw;
      this.#save();
    }
    return o;
  }
}
