
## Diferenciar "Meu Desempenho" para Closer Consórcio

### Diagnóstico

A página `/closer/meu-desempenho` (`src/pages/closer/MeuDesempenhoCloser.tsx`) hoje renderiza KPIs e resumos voltados para Incorporador (R1 Agendada, R1 Realizada, No-Show, Contrato Pago, **Outside**, Taxa Conversão, **R2 Agendada**, R2 Carrinho). Para o João Pedro (`bu=consorcio`), os campos **Outside, Contrato Pago, R2 Agendada e R2 Carrinho** não fazem sentido — Consórcio mede **Realizadas, Propostas Enviadas e Produtos Fechados**.

`useMyCloser` hoje retorna só `{ id, name, email, is_active }`. Precisa expor também `bu` para o componente decidir qual versão renderizar.

Já existem hooks prontos para Consórcio:
- `useConsorcioPipelineMetricsByCloser(start, end)` → propostas enviadas por closer
- `useConsorcioProdutosFechadosByCloser(start, end)` → produtos fechados por closer
- `useR1CloserMetrics(start, end, 'consorcio')` → R1 Agendada/Realizada/No-Show da BU

### Mudanças

**1. `src/hooks/useMyCloser.ts`**
- Adicionar `bu` ao SELECT em ambos os caminhos (employee e fallback por email) e ao retorno tipado.

**2. Criar `src/components/closer/CloserConsorcioDetailKPICards.tsx`**
- Mostra apenas: **R1 Agendada, R1 Realizada, No-Show, Taxa No-Show, Propostas Enviadas, Produtos Fechados, Taxa Conversão (produtos/realizadas)**.
- Mesmo visual de comparação com média do time (reaproveita o `KPICard`).

**3. Criar `src/components/closer/CloserConsorcioRankingBlock.tsx`**
- Ranking dentro do time Consórcio em: **R1 Realizada, Produtos Fechados, Propostas Enviadas, Taxa No-Show**.
- Calcula posições a partir das mesmas listas usadas nos hooks Consórcio + `useR1CloserMetrics(..., 'consorcio')`.

**4. `src/pages/closer/MeuDesempenhoCloser.tsx`**
- Detectar `isConsorcio = myCloser.bu === 'consorcio'`.
- Se Consórcio:
  - Buscar dados via `useR1CloserMetrics(start, end, 'consorcio')` + `useConsorcioPipelineMetricsByCloser(start, end)` + `useConsorcioProdutosFechadosByCloser(start, end)`.
  - Renderizar `CloserConsorcioDetailKPICards` e `CloserConsorcioRankingBlock`.
  - Substituir o card "Resumo do Período" por versão Consórcio:
    - Total Realizadas, Propostas Enviadas, Produtos Fechados, Taxa de Fechamento (produtos/realizadas).
  - Não renderizar bloco "R2 Carrinho" (não se aplica).
- Se Incorporador (default): manter exatamente o que existe hoje.

**5. Aba "Meus Leads"**
- Manter o `CloserLeadsTable` para ambos (vem de `useCloserDetailData.allLeads`, que já usa `meeting_slot_attendees` filtrados pelo closer — agnóstico de BU). Apenas renomear contagem/cabeçalho se necessário (sem mudança de dados).

### Resultado esperado para João Pedro
- KPIs: R1 Agendada / R1 Realizada / No-Show / Taxa No-Show / **Propostas Enviadas** / **Produtos Fechados** / Taxa Conversão.
- Ranking Consórcio: posição entre os 5 closers ativos da BU.
- Resumo: realizadas, propostas, produtos, taxa de fechamento.
- Sem "Outside", sem "R2 Agendada", sem "R2 Carrinho".

### Garantias
- Zero alteração de banco.
- Zero impacto no fluxo de Closers Incorporador (mesma página, branch separado).
- Hooks Consórcio reaproveitados — sem duplicação de regra de negócio.
- Tabela "Meus Leads" continua igual.
