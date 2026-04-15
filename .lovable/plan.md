

## Plano: Alinhar "Aprovado" do Relatório (30 → 27)

### Problema
No Relatório (Agenda R2 → aba Relatório), ao expandir "Realizadas", o sub-KPI "Aprovado" mostra **30**. Os outros painéis (KPI Carrinho, aba Aprovados, Todas R2s filtrado) já mostram **27**.

### Causa raiz
O Step 4 do `useContractLifecycleReport.ts` resolve o "melhor R2" para cada deal. Quando não existe R2 na mesma semana (`carrinho_week_start`), ele aceita R2 de **outra semana**. Esses 3 leads extras têm R2 Aprovado + Realizada em outra semana, mas como o contrato foi pago nesta safra, eles entram no relatório com `r2StatusName = 'Aprovado'`.

O sub-KPI `realizadasChildren` no `R2ContractLifecyclePanel.tsx` simplesmente conta por `r2StatusName`, sem verificar se o R2 pertence à semana correta.

### Correção

**Arquivo: `src/components/crm/R2ContractLifecyclePanel.tsx`**

No cálculo de `realizadasChildren` (linhas ~114-125), ao contar por `r2StatusName`, verificar também `carrinhoWeekStart`. Se o row tem `carrinhoWeekStart` apontando para outra semana (diferente da semana atual selecionada), usar "Sem status" em vez do `r2StatusName` real — ou seja, não contar como "Aprovado".

Alternativa mais limpa: adicionar o campo `carrinhoWeekStart` à comparação. Rows cujo R2 não pertence à semana atual não devem ser contados como "Aprovado" no sub-KPI. O `carrinhoWeekStart` já está disponível no `ContractLifecycleRow`.

Lógica:
```text
const currentWeekStart = format(getCartWeekStart(weekStartDate), 'yyyy-MM-dd');

realizadasChildren: para cada row com situacao === 'realizada':
  - se row.carrinhoWeekStart existe E é diferente de currentWeekStart → key = 'Outra semana'
  - senão → key = row.r2StatusName || 'Sem status'
```

Isso remove os 3 leads de outra semana do bucket "Aprovado" e os move para "Outra semana", alinhando o "Aprovado" com 27.

### Resultado esperado
- Relatório Realizadas → Aprovado = **27**
- Alinhado com KPI, aba Aprovados e Todas R2s

### Seção técnica
- 1 arquivo: `src/components/crm/R2ContractLifecyclePanel.tsx`
- ~5 linhas alteradas no `realizadasChildren` useMemo

