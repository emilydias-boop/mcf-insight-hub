## Objetivo

No card **R2 Agendadas** do Carrinho R2, o sub-indicador **Pendentes** mostra hoje só o total bruto. Você quer também saber **quantos desses pendentes vieram de semanas anteriores** (contrato pago antes do corte de abertura desta safra), igual já fazemos com `fromPrevious` em R2 Agendadas/Realizadas/Reembolso.

## Como funciona hoje

- `useR2PendingLeads` retorna a lista realtime de leads com `status='contract_paid'` em R1 que ainda não têm R2 marcada.
- Cada lead tem `contract_paid_at` (timestamp do pagamento).
- `useR2PendingLeadsCount` só devolve `length`.
- O card usa `displayKpis.pendentesAgendamento` (number).

## Plano

### 1. `src/hooks/useR2PendingLeads.ts`
Adicionar um segundo hook derivado `useR2PendingLeadsBreakdown(previousCutoff: Date)` que reaproveita o mesmo `useR2PendingLeads` e devolve:
```ts
{ total: number; semanasAnteriores: number; safraAtual: number }
```
- `semanasAnteriores`: leads cujo `contract_paid_at < previousCutoff`.
- `safraAtual`: o resto.

Manter `useR2PendingLeadsCount` intacto para não quebrar outros consumidores.

### 2. `src/hooks/useR2CarrinhoKPIs.ts`
- Calcular `previousCutoff` (já existe via `getCarrinhoMetricBoundaries(...).previousCutoff`).
- Trocar o uso de `useR2PendingLeadsCount()` por `useR2PendingLeadsBreakdown(previousCutoff)`.
- Adicionar 2 campos na interface `R2CarrinhoKPIs`:
  - `pendentesAgendamentoSemanasAnteriores: number`
  - (manter `pendentesAgendamento` como total para compatibilidade)
- Popular no retorno.

### 3. `src/pages/crm/R2Carrinho.tsx`
No card **R2 Agendadas** (linha ~175-181), adicionar `fromPrevious` ao sub-indicador **Pendentes**. Como o componente atual só suporta `fromPrevious` no card principal, duas opções:

**Opção A (mínima):** Adicionar uma linha extra no `subTitle` (tooltip) do card R2 Agendadas:
> "Pendentes vindos de semanas anteriores: X"

**Opção B (visual):** Estender o tipo do `sub` para aceitar `fromPrevious?: number` e renderizar `↩ X` ao lado do número de Pendentes (mesma convenção visual dos outros cards). Isso requer ajustar o componente que renderiza o KPI card (provavelmente `KPICard` ou inline em `R2Carrinho.tsx`).

Recomendo **Opção B** para manter consistência visual com os outros cards que já usam `↩ X`.

### Resultado esperado

Card R2 Agendadas continua mostrando:
- Valor principal (agendadas) com `↩ X` (de semanas anteriores)
- Sub: `Pendentes: N` com `↩ M` (pendentes vindos de semanas anteriores)

Sem mudanças de schema. Apenas hooks + UI.
