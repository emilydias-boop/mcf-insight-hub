# Meta de cobrança com visual do BI Comercial / Modo TV

## O que muda na tela A receber
- **Topo no estilo BI Comercial:** título "Meta de Cobrança", mês, e botões "Configurar meta" (admin) e **Modo TV** (destaque na cor do BI).
- **Linha de 4 cartões (mesmo cartão de KPI do BI):** Meta do mês (R$ 250.000) · Meta por dia útil · Recebido no mês (% da meta) · Falta para a meta (e quanto precisa por dia útil restante).
- **Barra de progresso grande** com marcador de "onde deveríamos estar hoje" (ritmo esperado) e mensagem motivacional conforme o andamento: "Acelera!", "No ritmo", "Meta batida!".
- **Semanas do mês:** cartões por semana (seg→dom) com meta x recebido e a semana atual destacada, como no BI.
- **Ranking de cobradores:** cartões com posição (1º, 2º, 3º com troféu), gauge, recebido x meta individual, previsto e quanto falta.
- Previsto em cobrança continua visível como informação de apoio.

## Modo TV
- Botão abre o mesmo Modo TV do BI Comercial/Consórcio em tela cheia: gauge gigante da meta, relógio, Hoje x meta do dia, dias úteis, semanas e cartões dos cobradores. Atualiza a cada 30 segundos. Sem carrossel de campanhas. Esc fecha.

## Regras (sem mudança)
- Recebido continua contando só cobrança (parcela 2+ em cobrança regular), como ajustado antes.
- Meta por dia/semana = meta do mês dividida pelos dias úteis (seg–sex) do mês.

## Detalhes técnicos
- Reusar `BITVMode` (`src/components/consorcio/BITVMode.tsx`) sem alterá-lo, passando `semanas`, `realizadoHoje`, `metaDia`, `closers` (cobradores) e `showCampaign={false}`, título "MCF · Meta de Cobrança ao vivo".
- Em `arCobrancaCalc.ts`, função pura `ritmoMetaCobranca(mes, hoje, parcelas, ...)` que devolve recebido por dia/semana e dias úteis; teste em `arMetaCobranca.test.ts`.
- Reescrever só `MetaCobrancaPainel.tsx`; mesmo cartão de KPI do BI Comercial (extraído/copiado no padrão de `KpiCard`). Nada no banco.
