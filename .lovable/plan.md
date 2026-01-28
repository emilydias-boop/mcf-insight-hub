
# Corrigir Notas Históricas em Leads Reagendados (R1)

## Problema
Quando um lead é reagendado na R1, as notas antigas não aparecem porque:
1. Um **novo** `meeting_slot_attendee` é criado com novo ID
2. As notas antigas estão vinculadas ao ID do attendee anterior
3. O componente `AttendeeNotesSection` só busca notas do attendee atual

## Solução
Modificar o `AttendeeNotesSection` e `useAttendeeNotes` para buscar notas de **TODOS os attendees** relacionados ao mesmo `deal_id`.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useAttendeeNotes.ts` | Adicionar busca por deal_id |
| `src/components/crm/AttendeeNotesSection.tsx` | Adicionar prop dealId e usar nova lógica |
| `src/components/crm/AgendaMeetingDrawer.tsx` | Passar dealId do attendee para o componente |

---

## Mudanças Detalhadas

### 1. Atualizar `useAttendeeNotes.ts`

Adicionar parâmetro opcional `dealId` e buscar notas de todos os attendees relacionados:

```typescript
export function useAttendeeNotes(
  attendeeId: string | null | undefined,
  dealId?: string | null  // NOVO: opcional para buscar notas históricas
) {
  return useQuery({
    queryKey: ['attendee-notes', attendeeId, dealId],
    queryFn: async () => {
      if (!attendeeId && !dealId) return [];
      
      // Se tiver dealId, buscar TODOS os attendeeIds relacionados
      let allAttendeeIds: string[] = [];
      
      if (dealId) {
        const { data: allAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select('id')
          .eq('deal_id', dealId);
        
        allAttendeeIds = (allAttendees || []).map(a => a.id);
      }
      
      // Adicionar attendeeId atual se não estiver na lista
      if (attendeeId && !allAttendeeIds.includes(attendeeId)) {
        allAttendeeIds.push(attendeeId);
      }
      
      // Se não tiver nenhum ID, usar só o attendeeId original
      if (allAttendeeIds.length === 0 && attendeeId) {
        allAttendeeIds = [attendeeId];
      }
      
      const { data, error } = await supabase
        .from('attendee_notes')
        .select(`id, attendee_id, note, note_type, created_by, created_at`)
        .in('attendee_id', allAttendeeIds)  // ← Busca de TODOS
        .order('created_at', { ascending: true });
      
      // ... resto do código (mapear profiles)
    },
    enabled: !!(attendeeId || dealId),
  });
}
```

### 2. Atualizar `AttendeeNotesSection.tsx`

Adicionar prop `dealId` e atualizar a query de scheduling notes:

```typescript
interface AttendeeNotesSectionProps {
  attendeeId: string | null | undefined;
  dealId?: string | null;  // NOVO
  participantName: string;
  canAddNotes?: boolean;
}

export function AttendeeNotesSection({ 
  attendeeId, 
  dealId,  // NOVO
  participantName,
  canAddNotes = true 
}: AttendeeNotesSectionProps) {
  // Passar dealId para buscar notas históricas
  const { data: notes = [], isLoading } = useAttendeeNotes(attendeeId, dealId);
  
  // Também buscar scheduling notes de TODOS os attendees do deal
  const { data: schedulingNotes, isLoading: isLoadingSchedulingNotes } = useQuery({
    queryKey: ['attendee-scheduling-notes', attendeeId, dealId],
    queryFn: async () => {
      let allAttendeeIds: string[] = [];
      
      if (dealId) {
        const { data: allAttendees } = await supabase
          .from('meeting_slot_attendees')
          .select('id')
          .eq('deal_id', dealId);
        allAttendeeIds = (allAttendees || []).map(a => a.id);
      }
      
      if (attendeeId && !allAttendeeIds.includes(attendeeId)) {
        allAttendeeIds.push(attendeeId);
      }
      
      if (allAttendeeIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('meeting_slot_attendees')
        .select(`
          id, notes, booked_by, created_at,
          booked_by_profile:profiles!meeting_slot_attendees_booked_by_fkey(id, full_name, email)
        `)
        .in('id', allAttendeeIds)
        .not('notes', 'is', null);
      
      return data || [];
    },
    enabled: !!(attendeeId || dealId),
  });
  
  // ... resto do componente combinando todas as notas
}
```

### 3. Atualizar `AgendaMeetingDrawer.tsx`

Obter o `deal_id` do attendee e passá-lo para o componente:

```typescript
// Linha ~444 em getParticipantsList
return {
  id: att.id,
  name,
  phone,
  dealId: att.deal_id,  // NOVO: incluir deal_id
  // ... resto
};

// Linha ~814 onde AttendeeNotesSection é usado
<AttendeeNotesSection
  attendeeId={selectedParticipant.id}
  dealId={selectedParticipant.dealId || activeMeeting?.deal_id}  // NOVO
  participantName={selectedParticipant.name}
  canAddNotes={true}
/>
```

---

## Fluxo de Dados Corrigido

```
Antes (Bugado):
┌─────────────────┐    ┌─────────────────┐
│ Attendee Atual  │ →  │ Notas atuais    │  ← Só notas do attendee atual
│ (ID: abc123)    │    │ (1 nota)        │
└─────────────────┘    └─────────────────┘

Depois (Corrigido):
┌─────────────────┐    ┌─────────────────┐
│ Deal ID         │ →  │ Todos Attendees │ → │ Todas Notas │
│ (deal-xyz)      │    │ (abc123, def456)│   │ (5 notas)   │
└─────────────────┘    └─────────────────┘   └─────────────┘
```

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| Lead reagendado 1x | Só nota do reagendamento | Nota original + reagendamento |
| Lead reagendado 3x | Só última nota | Todas as 4 notas (original + 3 reagend.) |
| Lead novo | 1 nota | 1 nota (sem mudança) |

---

## Sequência de Implementação

1. Modificar `useAttendeeNotes` para aceitar `dealId` opcional
2. Atualizar query para buscar notas de todos os attendees do deal
3. Atualizar `AttendeeNotesSection` com nova prop e lógica
4. Atualizar `getParticipantsList` para incluir `dealId`
5. Passar `dealId` para `AttendeeNotesSection` no drawer
6. Testar com lead reagendado para verificar notas históricas
