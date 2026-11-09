# Chatbot de pagamentos Multibanco (ifthenpay)

Chatbot web em Node.js que conversa com o cliente (com o Claude), ajuda a escolher produtos de um catálogo e gera uma **referência Multibanco** através da API da [ifthenpay](https://ifthenpay.com). Quando a ifthenpay confirma o pagamento (callback), a encomenda passa a **paga** e o cartão de pagamento no chat é atualizado.

## Como funciona

```
Cliente ──chat──▶ /api/chat ──▶ Claude (ferramentas)
                                 ├─ listar_produtos
                                 ├─ criar_referencia_multibanco ──▶ ifthenpay  POST /multibanco/reference/init
                                 └─ consultar_pagamento
ifthenpay ──callback──▶ /ifthenpay/callback ──▶ encomenda marcada como "pago"
```

- O **montante é sempre calculado no servidor** a partir de `catalog.json`. O modelo só escolhe produtos e quantidades, por isso o cliente não consegue "negociar" o preço com o bot.
- O callback valida a **chave anti-phishing**, confirma que a encomenda existe e que o montante e a referência coincidem.
- Cada conversa só vê as encomendas criadas nessa mesma conversa.

## Requisitos

- Node.js 20.12 ou superior
- Chave da API da Anthropic
- Conta ifthenpay com Multibanco ativo e uma **MB Key** (formato `ABC-123456`)

## Instalação

```bash
cd chatbot-ifthenpay
npm install
cp .env.example .env   # preencher as chaves
npm start              # http://localhost:3000
```

| Variável | Descrição |
|---|---|
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic |
| `IFTHENPAY_MB_KEY` | MB Key fornecida pela ifthenpay |
| `IFTHENPAY_ANTI_PHISHING_KEY` | Chave anti-phishing do callback (definida por si no backoffice) |
| `IFTHENPAY_SANDBOX` | `true` usa o endpoint de sandbox e mostra o botão "Simular pagamento" |
| `IFTHENPAY_EXPIRY_DAYS` | Dias de validade da referência (vazio = sem prazo) |
| `PORT` | Porta HTTP (por omissão 3000) |
| `DATA_FILE` | Ficheiro JSON das encomendas (por omissão `data/orders.json`) |
| `ANTHROPIC_MODEL` | Modelo a usar (por omissão `claude-opus-5-5`) |

## Configurar o callback na ifthenpay

No backoffice da ifthenpay (ou pedindo ao suporte), associe à sua MB Key o URL de callback:

```
https://O-SEU-DOMINIO/ifthenpay/callback?key=[ANTI_PHISHING_KEY]&orderId=[ORDER_ID]&amount=[AMOUNT]&requestId=[REQUEST_ID]&entity=[ENTITY]&reference=[REFERENCE]&payment_datetime=[PAYMENT_DATETIME]
```

e defina a mesma chave anti-phishing que está em `IFTHENPAY_ANTI_PHISHING_KEY`. O servidor aceita o callback por GET ou POST e responde `200 OK` quando o pagamento é registado.

Para testar localmente com callbacks reais, exponha a porta com um túnel (ngrok, cloudflared, ...).

## Catálogo

Edite `catalog.json`:

```json
[{ "id": "consulta-30", "nome": "Consulta de 30 minutos", "preco": 25.0 }]
```

## Testes

```bash
npm test
```

Os testes usam clientes falsos para a Anthropic e para a ifthenpay, por isso não precisam de chaves nem de rede.

## Passar a produção

1. `IFTHENPAY_SANDBOX=false` (usa `https://api.ifthenpay.com/multibanco/reference/init` e desliga a simulação de pagamentos).
2. Servir por HTTPS e configurar o callback como acima.
3. Trocar o `OrderStore` (ficheiro JSON) por uma base de dados e as sessões em memória por um armazenamento partilhado (ex.: Redis) se correr mais de uma instância.
4. Considerar enviar o email de confirmação ao cliente quando o callback chega (ponto de extensão: `handleCallback` em `server.js`).

## Estrutura

```
server.js            Servidor Express: chat, estado da encomenda, callback, simulação (sandbox)
src/chat.js          Conversa com o Claude e ferramentas
src/ifthenpay.js     Cliente da API Multibanco da ifthenpay
src/store.js         Armazenamento de encomendas (JSON)
public/index.html    Interface do chat
catalog.json         Produtos e preços
```
