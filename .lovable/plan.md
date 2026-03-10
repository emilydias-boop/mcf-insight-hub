

## Correção: R2 Agendadas só conta se R2 foi criada APÓS o pagamento do contrato

### Problema atual
A query busca R2 meetings por `deal_id` de contratos pagos, mas não verifica se o R2 foi agendado **depois** do `contract_paid_at`. Um R2 agendado antes do pagamento não deveria contar.

### Solução
Alterar a lógica em `useCloserAgendaMetrics.ts` para:

1. Coletar um mapa `{ deal_id → contract_paid_at }` dos attendees com status `contract_paid`/`refunded`
2. Na query de R2, buscar também `created_at` (data de criação do slot R2)
3. Filtrar no client: só contar R2 cujo `created_at >= contract_paid_at` do deal correspondente

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `useCloserAgendaMetrics.ts` (linhas 204-248) | Trocar `r1DealIds: string[]` por `r1DealMap: Map<string, string>` (deal_id → contract_paid_at). Na query R2 incluir `created_at`. Filtrar R2 slots onde `created_at >= contract_paid_at` do deal. Aplicar mesma lógica no fallback direto. |

### Código proposto (pseudocódigo)
```typescript
// Coletar deal_id → contract_paid_at
const r1DealMap = new Map<string, string>();
for (const slot of slots) {
  for (const att of slot.meeting_slot_attendees) {
    if (att.deal_id && !att.is_partner && 
        ['contract_paid','refunded'].includes(att.status)) {
      const paidAt = att.contract_paid_at || slot.scheduled_at;
      r1DealMap.set(att.deal_id, paidAt);
    }
  }
}

// Query R2 com created_at
const r2Slots = await supabase
  .from('meeting_slots')
  .select('id, deal_id, created_at')
  .eq('meeting_type', 'r2')
  .in('deal_id', [...r1DealMap.keys()])
  .gte('scheduled_at', startDate)
  .lte('scheduled_at', endDate);

// Filtrar: R2 criada após pagamento
r2_agendadas = r2Slots.filter(r2 => {
  const paidAt = r1DealMap.get(r2.deal_id);
  return paidAt && new Date(r2.created_at) >= new Date(paidAt);
}).length;
```

### Resultado esperado
R2 Agendadas contará apenas reuniões R2 que foram efetivamente agendadas após a confirmação do pagamento do contrato, eliminando qualquer discrepância com Contratos Pagos.

