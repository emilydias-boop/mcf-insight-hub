

## Corrigir leads com R2 concluida ainda aparecendo como No-Show

### Problema

O lead "Lourenco Junior Moraes de Oliveira" (deal `faa309c2`) tem 4 registros R2:

```text
20/02  no_show     (parent_attendee_id: null)
21/02  no_show     (parent_attendee_id: null)
23/02  rescheduled (parent_attendee_id: null)
25/02  completed   (parent_attendee_id: 0329e9db → do 23/02)
```

O filtro atual so remove no-shows que foram reagendados via `parent_attendee_id` (ou seja, que tem um "filho"). Os dois no-shows de 20/02 e 21/02 nunca foram formalmente reagendados pelo sistema - foram abandonados e novas reunioes foram criadas separadamente. Por isso, nao tem filhos e continuam aparecendo.

A logica correta e: se o mesmo `deal_id` ja tem um R2 attendee com status `completed`, todos os no-shows antigos desse deal devem ser removidos da lista.

### Alteracoes

**`src/hooks/useR2NoShowLeads.ts`**

1. **`useR2NoShowLeads` (linha ~130-295)**: Apos coletar os `dealIds` dos no-shows (ja feito na linha 178-184), consultar se algum desses deals possui um attendee R2 com status `completed` ou `contract_paid`. Criar um `Set<string>` de deals com R2 concluida e filtrar os no-shows:

```typescript
// Apos coletar dealIds (linha ~184)
// Verificar quais deals ja tem R2 concluida
let dealsWithCompletedR2 = new Set<string>();
if (dealIds.size > 0) {
  const { data: completedR2 } = await supabase
    .from('meeting_slot_attendees')
    .select('deal_id, meeting_slot:meeting_slots!inner(meeting_type)')
    .in('deal_id', Array.from(dealIds))
    .eq('meeting_slots.meeting_type', 'r2')
    .in('status', ['completed', 'contract_paid']);

  dealsWithCompletedR2 = new Set(
    (completedR2 || []).map(a => a.deal_id).filter(Boolean)
  );
}
```

Depois, no loop de transformacao (linha ~245-293), adicionar verificacao:

```typescript
// Skip se o deal ja tem R2 concluida
if (att.deal_id && dealsWithCompletedR2.has(att.deal_id)) {
  return;
}
```

2. **`useR2NoShowsCount` (linha ~308-368)**: Mesma logica - apos obter os no-show attendees e seus deal_ids (ja busca na linha 340-343), verificar deals com R2 completed e subtrair do count.

### Resultado

Leads que deram no-show mas depois completaram uma R2 (como o Lourenco) serao automaticamente removidos da lista e contagem de no-shows.

