
# Plano: Corrigir Reagendamento R2 para Atualizar Status do Attendee

## Problema Identificado

O Jhonatan Garcia Felicio foi reagendado após no-show, mas o registro está inconsistente:

| Campo | Valor Atual | Valor Esperado |
|-------|-------------|----------------|
| `meeting_slots.status` | `rescheduled` ✅ | ✅ |
| `meeting_slot_attendees.status` | `no_show` ❌ | `rescheduled` |
| `is_reschedule` | `false` ❌ | `true` |
| Novo attendee vinculado | Não existe ❌ | Deveria existir |

## Causa Raiz

O hook `useRescheduleR2Meeting` em `src/hooks/useR2AgendaData.ts` apenas atualiza o slot, mas **não cria um novo attendee** nem **atualiza o status do attendee original** como faz o R1.

## Solução

### Mudança 1: Refatorar `useRescheduleR2Meeting`

Aplicar a mesma lógica do R1 (`MoveAttendeeModal.tsx`):

1. **Para no-show sendo reagendado para outro dia:**
   - Criar NOVO attendee vinculado ao original via `parent_attendee_id`
   - Marcar `is_reschedule = true` e `status = 'rescheduled'`
   - Manter o attendee original com status `no_show` (histórico)
   - Atualizar `crm_deals.custom_fields` com `is_rescheduled`, `reschedule_count`, `last_reschedule_at`

2. **Para reagendamento no mesmo dia:**
   - Apenas mover o attendee existente
   - Atualizar `status = 'rescheduled'` e `is_reschedule = true`

### Mudança 2: Atualizar `R2RescheduleModal`

Passar informação adicional para o hook:
- `attendeeId` - para vincular o novo attendee
- `originalAttendeeStatus` - para detectar se é no-show
- `originalDate` - para detectar se mudou de dia

### Correção de Dados Históricos

Executar SQL para corrigir o Jhonatan e casos similares:

```sql
-- Corrigir attendees de slots reagendados que estão com status no_show
UPDATE meeting_slot_attendees msa
SET status = 'rescheduled', is_reschedule = true
FROM meeting_slots ms
WHERE msa.meeting_slot_id = ms.id
  AND ms.status = 'rescheduled'
  AND msa.status = 'no_show';
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2AgendaData.ts` | Refatorar `useRescheduleR2Meeting` para criar histórico igual ao R1 |
| `src/components/crm/R2RescheduleModal.tsx` | Passar `attendeeId`, `originalStatus`, `originalDate` para o hook |

## Detalhes Técnicos

### useR2AgendaData.ts - Novo Hook

```typescript
export function useRescheduleR2Meeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      meetingId, 
      newDate, 
      closerId,
      attendeeId,
      originalDate,
      originalCloserId,
      originalAttendeeStatus,
      rescheduleNote 
    }) => {
      
      const isNoShow = originalAttendeeStatus === 'no_show';
      const isDifferentDay = !isSameDay(newDate, new Date(originalDate));
      
      if (isNoShow && isDifferentDay && attendeeId) {
        // 1. Buscar dados do attendee original
        const { data: originalAttendee } = await supabase
          .from('meeting_slot_attendees')
          .select('contact_id, deal_id, booked_by, lead_profile, video_status, ...')
          .eq('id', attendeeId)
          .single();
        
        // 2. Criar ou encontrar slot de destino
        let targetSlotId = await findOrCreateSlot(closerId, newDate);
        
        // 3. Criar NOVO attendee vinculado ao original
        const { data: newAttendee } = await supabase
          .from('meeting_slot_attendees')
          .insert({
            meeting_slot_id: targetSlotId,
            ...originalAttendee,
            status: 'rescheduled',
            is_reschedule: true,
            parent_attendee_id: attendeeId,
          })
          .select()
          .single();
        
        // 4. Marcar slot original como rescheduled
        await supabase
          .from('meeting_slots')
          .update({ status: 'rescheduled' })
          .eq('id', meetingId);
        
        // 5. Atualizar deal com marcação de reagendamento
        if (originalAttendee.deal_id) {
          // Atualizar custom_fields...
        }
        
        return { newAttendeeId: newAttendee.id };
      }
      
      // Para reagendamento no mesmo dia: atualizar attendee existente
      await supabase
        .from('meeting_slot_attendees')
        .update({ 
          status: 'rescheduled',
          is_reschedule: true 
        })
        .eq('id', attendeeId);
      
      // Atualizar slot
      await supabase
        .from('meeting_slots')
        .update({ 
          scheduled_at: newDate.toISOString(),
          status: 'rescheduled',
          closer_id: closerId 
        })
        .eq('id', meetingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['r2-agenda-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['r2-meetings-extended'] });
      queryClient.invalidateQueries({ queryKey: ['r2-noshows'] });
      toast.success('Reunião R2 reagendada');
    },
  });
}
```

### R2RescheduleModal.tsx - Passar dados adicionais

```typescript
rescheduleMeeting.mutate({
  meetingId: meeting.id,
  newDate,
  closerId: selectedCloser,
  attendeeId: attendee?.id,                    // ← NOVO
  originalDate: meeting.scheduled_at,          // ← NOVO  
  originalCloserId: meeting.closer?.id,        // ← NOVO
  originalAttendeeStatus: attendee?.status,    // ← NOVO
  rescheduleNote: rescheduleNote.trim(),
});
```

## Resultado Esperado

1. **Imediato:** Jhonatan aparecerá corretamente com badge "Reag." (amarelo) após correção via SQL
2. **Futuro:** Novos reagendamentos criarão histórico completo via `parent_attendee_id`
3. **Rastreabilidade:** Deal terá campos `is_rescheduled`, `reschedule_count` atualizados
4. **Consistência:** R2 funcionará igual ao R1 para reagendamentos após no-show
