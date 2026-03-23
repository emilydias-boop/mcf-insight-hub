

## Plano: Filtrar "Pendentes Hoje" por BU

### Problema

O hook `useMeetingsPendentesHoje` consulta `meeting_slot_attendees` sem nenhum filtro de BU. Ele conta R1 pendentes de **todas as BUs** (incorporador + consórcio), resultando em 60. A agenda do incorporador mostra 46 porque filtra por closers da BU correta.

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useMeetingsPendentesHoje.ts` | Aceitar parâmetro `buFilter` opcional. Fazer JOIN com `meeting_slots.closer_id` → `closers.bu` para filtrar pela BU |
| `src/pages/crm/ReunioesEquipe.tsx` | Passar o squad ativo (ex: `'incorporador'`) para o hook |

### Detalhes

A query passará a fazer JOIN com `closers` via `meeting_slots.closer_id` e filtrar `closers.bu = buFilter`:

```typescript
// useMeetingsPendentesHoje.ts
export function useMeetingsPendentesHoje(buFilter?: string) {
  // ...
  const { data, error } = await supabase
    .from("meeting_slot_attendees")
    .select(`
      status,
      is_partner,
      meeting_slot:meeting_slots!inner(
        scheduled_at, 
        meeting_type, 
        closer_id
      )
    `)
    .gte("meeting_slot.scheduled_at", startISO)
    .lte("meeting_slot.scheduled_at", endISO)
    .eq("meeting_slot.meeting_type", "r1");

  // After fetching, filter by BU if needed
  // Fetch closer BUs and cross-reference
```

Como o Supabase client não suporta facilmente JOIN de 3 níveis, a abordagem será:
1. Buscar os `closer_id`s dos closers da BU ativa (query rápida em `closers`)
2. Filtrar os attendees cujo `meeting_slot.closer_id` está nessa lista

### Resultado
- "Pendentes Hoje" mostrará ~46 (apenas incorporador), consistente com a agenda e as metas

