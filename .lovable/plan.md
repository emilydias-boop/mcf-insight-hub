

## Plano: Alinhar contagem de "Contrato Pago" entre KPI e aba Leads

### Problema

Na página de detalhe do closer Mateus Macedo:
- **KPI "Contratos Pagos"** (Visão Geral) = **22** (via `useR1CloserMetrics`, filtra `contract_paid_at` dentro do período)
- **Aba "Leads Realizados" filtrado por Contrato Pago** = **23** (via `useCloserDetailData`, NÃO filtra `contract_paid_at` por período)

O lead **Luiz Valentin Morello Filho** tem reunião em 10/04 mas pagou em 06/02. A Query 1 do `useCloserDetailData` (linha 180) marca como "Contrato Pago" qualquer attendee com `contract_paid_at IS NOT NULL`, sem verificar se a data está no período selecionado.

### Correção

**Arquivo: `src/hooks/useCloserDetailData.ts`** — linha 180

```typescript
// De:
const hasContractPaid = !!(att as any).contract_paid_at;

// Para:
const contractPaidAt = (att as any).contract_paid_at;
const hasContractPaid = !!contractPaidAt 
  && contractPaidAt >= start 
  && contractPaidAt <= end;
```

Isso garante que apenas pagamentos **dentro do período selecionado** sejam marcados como "Contrato Pago" na aba de leads. Pagamentos fora do período (como o Luiz Valentin em fevereiro) aparecerão como "Realizada" em vez de "Contrato Pago", alinhando a contagem com o KPI (22).

### Impacto

- Contagem "Contrato Pago" na aba Leads passará de 23 para 22, alinhada com o KPI
- Luiz Valentin continuará visível na aba "Leads Realizados" com status "Realizada" (não será removido)
- A Query 2 (follow-ups) já filtra `contract_paid_at` no período — sem alteração necessária

