

## Plano: Corrigir aba "R2 Agendadas" na visão individual do Closer R1

### Problema
A query de R2 leads em `useCloserDetailData.ts` (linhas 349-366) filtra `closer_id = closerId AND meeting_type = 'r2'`. Como o closer é R1, nenhuma R2 aparece — R2 meetings são atribuídos a closers R2.

A lógica correta (já usada em `useR1CloserMetrics.ts` linhas 169-198) é: buscar R2 meetings cujo `deal_id` corresponde a um deal que teve R1 com este closer.

### Correção

**Arquivo: `src/hooks/useCloserDetailData.ts`** (query `closer-r2-leads`, linhas 341-436)

Substituir a query atual por:

1. Buscar todos os `deal_id` das R1 meetings deste closer no período (já disponíveis na query de leads)
2. Buscar R2 meetings cujo attendee tem `deal_id` que está nessa lista
3. Montar os `CloserLead[]` normalmente

```typescript
// Fetch R2 leads - R2 meetings for deals that had R1 with this closer
queryFn: async () => {
  // Step 1: Get deal_ids from R1 meetings of this closer (any status)
  const { data: r1Meetings } = await supabase
    .from('meeting_slots')
    .select('meeting_slot_attendees(deal_id)')
    .eq('closer_id', closerId)
    .eq('meeting_type', 'r1')
    .neq('status', 'cancelled');

  const r1DealIds = new Set<string>();
  r1Meetings?.forEach(m => {
    m.meeting_slot_attendees?.forEach(att => {
      if (att.deal_id) r1DealIds.add(att.deal_id);
    });
  });

  if (r1DealIds.size === 0) return [];

  // Step 2: Find R2 meetings with those deal_ids in the period
  const { data: r2Meetings } = await supabase
    .from('meeting_slot_attendees')
    .select(`
      id, status, deal_id, attendee_name, attendee_phone, booked_by,
      meeting_slot:meeting_slots!inner(id, scheduled_at, meeting_type)
    `)
    .eq('meeting_slot.meeting_type', 'r2')
    .in('deal_id', Array.from(r1DealIds))
    .gte('meeting_slot.scheduled_at', start)
    .lte('meeting_slot.scheduled_at', end);

  // Step 3: Build CloserLead[] (same pattern as current code)
  // ... fetch deals, profiles, map to CloserLead
}
```

Isso não afeta as queries de "Leads Realizados" nem "No-Shows" (que continuam filtrando por `closer_id` + `meeting_type = 'r1'`).

Nota: a query de R1 deal_ids **não é filtrada por período** para capturar R2s cujo R1 ocorreu antes do período selecionado (mesmo padrão de `useR1CloserMetrics`).

