# Ligação ao InvoiceXpress (Cloudflare Worker)

A app corre no browser e está pública no GitHub Pages, por isso não pode ter a chave da API do InvoiceXpress. Este worker guarda a chave em segredo na Cloudflare e devolve à app só a faturação sem IVA de cada mês. As notas de crédito são deduzidas e os rascunhos e documentos anulados ficam de fora.

A app só recebe dados se enviar o **código de acesso** certo e se o pedido vier de um site autorizado.

## 1. O que precisas do InvoiceXpress

- **Nome da conta:** o `xxx` do endereço `https://xxx.app.invoicexpress.com` quando entras no InvoiceXpress.
- **Chave da API:** nas definições da conta do InvoiceXpress, na secção da API (integrações).

## 2. Criar o worker (cerca de 5 minutos, conta gratuita)

1. Entra em https://dash.cloudflare.com (cria conta se não tiveres).
2. Vai a **Workers & Pages** e carrega em **Create** e depois em **Create Worker**. Dá-lhe o nome `rumo-metas-ix` e carrega em **Deploy**.
3. Carrega em **Edit code**, apaga o código de exemplo, cola o conteúdo de [`worker.js`](worker.js) e carrega em **Deploy**.
4. Em **Settings**, vai a **Variables and Secrets** e acrescenta:

   | Nome | Tipo | Valor |
   |---|---|---|
   | `IX_ACCOUNT` | Text | o nome da conta do passo 1 |
   | `IX_API_KEY` | Secret | a chave da API do passo 1 |
   | `ACCESS_TOKEN` | Secret | um código longo e aleatório, inventado por ti (por exemplo, gerado no gestor de passwords) |
   | `ALLOWED_ORIGINS` | Text | `https://nunomorgadinho.github.io` |

5. Copia o endereço do worker, algo como `https://rumo-metas-ix.<o-teu-subdominio>.workers.dev`. Abre esse endereço com `/health` no fim. Tem de aparecer `{"ok":true}`.

## 3. Ligar a app

1. Abre a app e vai a **Definições das metas e dados**, à secção **InvoiceXpress**.
2. Cola o **URL do serviço** (o endereço do worker, sem `/health`) e o **Código de acesso** (o mesmo valor de `ACCESS_TOKEN`).
3. Carrega em **Guardar ligação**. A faturação do Nuno é logo atualizada.

A partir daí:
- a página atualiza sozinha ao abrir, no máximo uma vez por hora;
- o botão **Atualizar Nuno do InvoiceXpress**, nos registos mensais, atualiza na hora;
- a ligação fica só nesse browser e não entra no backup, por isso repete o passo 3 em cada browser ou telemóvel que usares.

## Se alguma coisa falhar

A mensagem ao lado do botão diz o que se passou:

- **código de acesso errado:** o código na app não é igual a `ACCESS_TOKEN`.
- **este site não está em ALLOWED_ORIGINS:** acrescenta o endereço do site a `ALLOWED_ORIGINS` (vários separados por vírgulas).
- **o InvoiceXpress recusou o pedido:** confirma `IX_ACCOUNT` e `IX_API_KEY`.
- **sem ligação ao serviço:** confirma o URL do worker.

## Pedido que o worker aceita

```
GET /monthly?from=AAAA-MM-DD&to=AAAA-MM-DD
Authorization: Bearer <ACCESS_TOKEN>
```

Resposta:

```json
{ "months": [{ "month": "2026-01", "revenue": 33029.88 }], "documents": 110, "from": "2026-01-01", "to": "2026-10-28", "generated_at": "..." }
```
