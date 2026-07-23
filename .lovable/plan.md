## Problema

O card KPI **REEMBOLSOS** em `/crm/reunioes-equipe` ainda mostra `7` para hoje (22/07) porque ele lê de um hook diferente dos que já foram re-ancorados na R1.

- Já corrigidos (âncora = data da R1): `useSdrRefundsInPeriod`, `useRefundDetailsInPeriod` — usados no dialog de detalhes e na tabela de SDRs.
- **Não corrigido**: `useR1CloserMetrics.ts` (linhas 480-537) — filtra reembolsos por `updated_at` (Hubla) e `created_at` (MCF Pay) dentro do período. É de onde saem `closerMetrics.reembolsos`, que `ReunioesEquipe.tsx` soma em `totalReembolsos` do card, e também alimenta a coluna "Reembolsos" e o cálculo `contrato_pago - reembolsos` da tabela de Closers.

Consequência: o card e a tabela de Closers continuam contando pela data do reembolso; só o dialog e a tabela de SDRs já respeitam a nova regra. Daí o `7` de hoje.

## O que fazer

Re-ancorar reembolsos em `useR1CloserMetrics.ts` no dia da R1 que originou o contrato, com a mesma hierarquia dos outros hooks:

1. **R1 mais recente do deal** (`meeting_slots.scheduled_at` onde `meeting_type='r1'` e `is_partner=false`) → âncora + `closer_id` já vem do slot.
2. **Fallback**: `contract_paid_at` do deal (marca "outside"; ainda atribui ao closer da R1 mais recente se existir, senão não conta pra nenhum closer).
3. Sem âncora (nem R1 nem `contract_paid_at`): não contabiliza no período.

### Passos técnicos

Em `src/hooks/useR1CloserMetrics.ts`:

- Remover os filtros `.gte('updated_at', start).lte('updated_at', end)` (Hubla) e `.gte('created_at', start).lte('created_at', end)` (MCF Pay) da busca de reembolsos. Buscar reembolsos A000 sem cap de data (ou só `>= start` de segurança), pois a R1 âncora pode ser antiga.
- Manter deduplicação por `deal_id` (1 reembolso por deal) e por `transaction_id` quando disponível.
- Incluir também `refund_hubla` com `metadata.source LIKE 'manual_reconciliation%'` (paridade com `useSdrRefundsInPeriod`).
- Para cada `deal_id` reembolsado:
  - Buscar R1 mais recente (já é feito hoje via `refundAttendees`).
  - Buscar `contract_paid_at` do deal para o fallback (novo — hoje só usa o do attendee).
  - Calcular `anchorMs`: `r1.scheduled_at` > `deal.contract_paid_at`.
  - Se `anchorMs` estiver **dentro do período** (`start..end`), incrementar `refundByCloser[closerId]`; senão, pular.
- Manter `refundByCloser` como saída para preservar o cálculo `contrato_pago = contratos + manuais - reembolsos` e a coluna "Reembolsos" da tabela de Closers já ancorada corretamente.

Sem mudança em UI, migrations ou outros hooks.

### Validação

- Preset **Hoje** (22/07): card **REEMBOLSOS** deve refletir apenas reembolsos cuja R1 (ou `contract_paid_at` fallback) caiu em 22/07. Deve bater com o `items.length` do dialog aberto pelo card.
- Preset **Mês**: total do card = total do dialog para o mesmo período.
- Coluna "Reembolsos" na tabela de Closers e cálculo de "Contratos Líquidos" seguem a mesma âncora.
