# Rumo às Metas

Web app de uma só página que mostra a distância entre a situação atual e as metas:

- **A (27 out 2026):** ponto de partida. O cartão mostra a faturação até ao momento (ano corrente), faturação e lucro dos últimos 12 meses, margem e run-rate.
- **A.1 (DCBKK '27, outubro 2027):** estar on-track para 500k€ de faturação em 2027. Antes de 2027 compara o run-rate (últimos 3 meses × 12) com 500k€; durante 2027 compara a faturação acumulada com o pro-rata até à data do DCBKK.

**Linha:** vai de A a A.1. Um marcador "Hoje" mostra a data atual e avança sozinho com o passar dos dias.

**Corrida:** dois barcos (Nuno e Tiago) navegam por baixo da linha. Cada um avança com a faturação acumulada do jogador desde o mês de início da corrida e chega à bandeira quando atinge a meta por jogador (500k€ por defeito, editável nas Definições). Cada registo mensal é de um jogador (ou da equipa) e os totais da empresa somam todos. Por baixo dos barcos há duas caixas para escrever à mão a faturação acumulada do Nuno e do Tiago: ao gravar, os barcos navegam até à nova posição. Um valor escrito tem prioridade sobre os registos; vazio, o barco volta a usar os registos.

**Dicas e insights:** números calculados a partir dos registos (quanto falta por mês e por semana, equivalência em planos mensais, pipeline necessário, efeito de subir preços, ritmo de cada barco) e 12 dicas fixas.

**O que move a agulha?:** 14 atividades de vendas (novos contactos, contactos antigos, propostas, diagnósticos, follow-ups, referências, reuniões, upsell, planos mensais, parceiros, LinkedIn, casos de estudo, concursos, eventos), cada uma com meta semanal e contadores para o Nuno e o Tiago, com placar da semana e histórico das semanas anteriores.

**Mensagens:** 13 modelos de WhatsApp e email, prontos a copiar, para gerar oportunidades.

**Frases lendárias:** 24 frases, com uma "frase do dia" no topo que muda todos os dias.

**InvoiceXpress:** a faturação do Nuno pode vir automaticamente do InvoiceXpress através de um Cloudflare Worker que guarda a chave da API em segredo. Ver [`worker/README.md`](worker/README.md).

**Palavra-passe:** a página pede uma palavra-passe ao entrar e lembra-a nesse browser ("Bloquear a página" nas Definições volta a pedi-la). O código guarda só o hash SHA-256 da palavra-passe. Como o site é estático e o repositório é público, isto é uma barreira simples e não substitui alojamento privado.

Os dados ficam só no browser (`localStorage`). Usa "Exportar backup" para guardar um JSON e "Importar (JSON)" para os recuperar noutro browser. A importação junta os registos aos que já existem: só substitui o mesmo mês e jogador, e mantém o lucro já registado quando o ficheiro não o traz.

Para usar, abre `index.html` no browser. Não precisa de servidor nem de dependências. Metas, data do DCBKK e data de início da contagem de B/C são editáveis em "Definições".
