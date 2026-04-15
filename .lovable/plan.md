

## Plano: Alinhar "Aprovados" para 27 no KPI e no Lifecycle

### Problema
- **Aba Carrinho (27)** — número correto (encaixados + regulares, todos aprovados)
- **KPI Carrinho (26)** — perde 1 lead por bug na ordem de merge/filtro
- **Relatório Lifecycle (30)** — inclui 3 leads extras de outras semanas

### Causa raiz

**KPI (26 vs 27):**
O KPI busca TODOS os encaixados (sem filtrar por status aprovado), faz o merge (encaixado sobrescreve regular pelo deal_id), e SÓ DEPOIS filtra por aprovado. Se um encaixado tem deal_id X mas status diferente de aprovado, ele sobrescreve o registro regular que TEM aprovado. Após o filtro, ambos somem. A aba faz certo: filtra por aprovado ANTES do merge.

**Lifecycle (30 vs 27):**
O Step 1c busca R2 Aprovados na janela Sex-Sex sem verificar se o lead tem `carrinho_week_start` apontando para outra semana. Leads "encaixados" em outra semana mas com R2 na janela atual entram indevidamente.

### Correção

**1. KPI (`src/hooks/useR2CarrinhoKPIs.ts`)**
- Na query `encaixadosAprovadosResult` (linhas 56-60): adicionar filtro `.eq('r2_status_id', aprovadoStatusId)` antes de executar
- Isso alinha com a lógica da aba: filtrar por aprovado antes do merge

**2. Lifecycle (`src/hooks/useContractLifecycleReport.ts`)**
- No Step 1c (linhas 360-386): após buscar R2 aprovados na janela, verificar se o attendee tem `carrinho_week_start` definido e diferente da semana atual — se sim, pular
- Adicionar `carrinho_week_start` ao select do Step 1c para poder fazer essa verificação

### Resultado esperado
- KPI: 27 (alinhado com a aba)
- Aba: 27 (sem alteração)
- Lifecycle: 27 (remove os 3 extras de outras semanas)

### Seção técnica
- `useR2CarrinhoKPIs.ts`: ~3 linhas — mover filtro aprovado para a query dos encaixados
- `useContractLifecycleReport.ts`: ~5 linhas — adicionar filtro `carrinho_week_start` no Step 1c

