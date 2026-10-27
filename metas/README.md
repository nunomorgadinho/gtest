# Rumo às Metas

Web app de uma só página que mostra a distância entre a situação atual e as metas:

- **A (hoje):** faturação até ao momento (ano corrente), faturação e lucro dos últimos 12 meses, margem e run-rate.
- **A.1 (DCBKK '27, outubro 2027):** estar on-track para 500k€ de faturação em 2027. Antes de 2027 compara o run-rate (últimos 3 meses × 12) com 500k€; durante 2027 compara a faturação acumulada com o pro-rata até à data do DCBKK.
- **B (5 anos):** 300k€ de lucro anual (últimos 12 meses).
- **C (10 anos, BHAG):** 1M€ de lucro anual (últimos 12 meses).

**Corrida:** dois barcos (Nuno e Tiago) navegam por baixo da linha. Cada um avança com a faturação acumulada do jogador desde o mês de início da corrida e chega à bandeira quando atinge a meta por jogador (250k€ por defeito, editável nas Definições). Cada registo mensal é de um jogador (ou da equipa) e os totais da empresa somam todos.

Os dados ficam só no browser (`localStorage`). Usa "Exportar backup" para guardar um JSON e "Importar backup" para os recuperar noutro browser.

Para usar, abre `index.html` no browser. Não precisa de servidor nem de dependências. Metas, data do DCBKK e data de início da contagem de B/C são editáveis em "Definições".
