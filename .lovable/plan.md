

## Diagnóstico dos problemas na tela

### Problema 1: "Meta Divina Batida" aparece mesmo com prêmios zerados
O componente `TeamGoalsSummary` mostra a seção "Meta Divina Batida" sempre que `currentRevenue >= meta_divina_valor`, independentemente de haver prêmios configurados. Como o faturamento de fevereiro (R$ 1.810.893) superou a meta divina (R$ 1.600.000), a seção aparece com R$ 0,00 — confuso para o usuário.

**Correção:** Só mostrar a seção de vencedores quando `meta_divina_premio_sdr > 0` OU `meta_divina_premio_closer > 0`. Quando os prêmios forem zero, mostrar apenas o badge "Meta Divina" como atingida, sem a seção de vencedores.

### Problema 2: iFood de meses anteriores não tem visibilidade de pagamento
O iFood da Supermeta/Ultrameta de janeiro (pago dia 20/fev) e o de fevereiro (será pago dia 20/mar) não têm rastreamento. Isso é um problema de modelo — hoje não existe campo `data_pagamento` nem status de pagamento para iFood.

**Correção (escopo mínimo):** Adicionar no rodapé do `TeamGoalsSummary` uma nota informativa: "iFood do mês será creditado até dia 20 do mês seguinte". Para rastreamento real de pagamento, seria necessário adicionar colunas ao banco — deixar como evolução futura.

### Problema 3: Meta Divina precisa de modos de distribuição configuráveis
Atualmente é hardcoded: "melhor SDR + melhor Closer". O usuário precisa de opções como:
- Individual (melhor de cada área)
- Time todo (valor dividido entre todos)
- Top N (dividir entre os 3/4/5 melhores de cada área)

**Correção:** Adicionar coluna `meta_divina_modo` à tabela `team_monthly_goals` com valores possíveis: `individual`, `time_todo`, `top_3`, `top_5`. Adicionar campo `meta_divina_top_n` (int) para configurar quantos participam. Atualizar formulário de configuração e a lógica de exibição.

---

## Plano de implementação

### Etapa 1: Migração — adicionar colunas de modo da Meta Divina
- Adicionar `meta_divina_modo TEXT DEFAULT 'individual'` e `meta_divina_top_n INTEGER DEFAULT 1` à tabela `team_monthly_goals`

### Etapa 2: Corrigir TeamGoalsSummary — esconder seção de vencedores quando prêmio é zero
- `TeamGoalsSummary.tsx`: condicionar exibição da seção "Meta Divina Batida" a `meta_divina_premio_sdr > 0 || meta_divina_premio_closer > 0`
- Quando prêmio é zero mas meta foi batida, mostrar apenas badge "✓ Batida" sem seção de vencedores
- Adicionar nota de pagamento: "iFood creditado até dia 20 do mês seguinte"

### Etapa 3: Atualizar formulário de configuração (TeamMonthlyGoalsTab)
- Adicionar seletor de modo na linha da Meta Divina: "Individual (melhor)", "Time todo", "Top 3", "Top 5"
- Atualizar `GoalFormData` e `handleSave` para incluir `meta_divina_modo` e `meta_divina_top_n`
- Ajustar texto informativo do rodapé conforme modo selecionado:
  - Individual: "O melhor SDR recebe X e o melhor Closer recebe Y"
  - Time todo: "Valor de X (SDR) e Y (Closer) dividido entre todos da área"
  - Top N: "Valor dividido entre os N melhores de cada área"

### Etapa 4: Atualizar hooks e tipos
- `useTeamMonthlyGoals.ts`: adicionar `meta_divina_modo` e `meta_divina_top_n` ao `TeamMonthlyGoal` interface e ao `DEFAULT_GOAL_VALUES`
- Atualizar `useUpsertTeamMonthlyGoals` para incluir novos campos

### Etapa 5: Adaptar exibição de vencedores no TeamGoalsSummary
- Quando modo = `individual`: manter comportamento atual (melhor SDR + melhor Closer)
- Quando modo = `time_todo`: mostrar "Prêmio dividido entre todos" com valor total
- Quando modo = `top_3`/`top_5`: mostrar lista dos N melhores de cada área com valor individual (prêmio / N)

