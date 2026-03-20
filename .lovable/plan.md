

## Plano: Bloquear agendamento server-side em slots lotados

### Problema raiz
A validação de capacidade é **apenas visual** (UI). Existem 3 caminhos para adicionar leads a um slot, e nenhum valida capacidade no servidor:

1. **QuickScheduleModal** — botão desabilitado para SDRs, mas coordenadores podem agendar sem limite. A edge function `calendly-create-event` não valida.
2. **useAddMeetingAttendee** (botão UserPlus na agenda) — insere direto no Supabase sem nenhuma verificação de capacidade.
3. **Drag-and-drop** — move leads entre slots sem checar se o destino está lotado.

### Alterações

| Arquivo | O que muda |
|---------|------------|
| `src/hooks/useAgendaData.ts` — `useAddMeetingAttendee` | Antes de inserir, buscar contagem atual de attendees + max_leads do slot. Se `count >= max`, lançar erro "Slot lotado". |
| `src/hooks/useAgendaData.ts` — `useCreateMeeting` | Antes de chamar a edge function, verificar capacidade. Se lotado e não for coordenador+, lançar erro. |
| `supabase/functions/calendly-create-event/index.ts` | Adicionar validação server-side: contar attendees do slot (mesmo closer + horário), buscar max_leads, rejeitar se cheio. |
| `src/components/crm/AgendaCalendar.tsx` | No handler de drop (drag-and-drop), verificar capacidade do slot destino antes de mover. |

### Detalhes

**useAddMeetingAttendee** — a mudança mais crítica. Antes do `insert`:
```typescript
// 1. Buscar meeting_slot para saber closer_id e scheduled_at
const { data: slot } = await supabase
  .from('meeting_slots')
  .select('closer_id, scheduled_at')
  .eq('id', meetingSlotId)
  .single();

// 2. Contar attendees atuais neste slot
const { count } = await supabase
  .from('meeting_slot_attendees')
  .select('id', { count: 'exact', head: true })
  .eq('meeting_slot_id', meetingSlotId);

// 3. Buscar max_leads
const maxLeads = await getMaxLeadsForSlot(slot.closer_id, slot.scheduled_at);

if ((count ?? 0) >= maxLeads) {
  throw new Error('Slot lotado — não é possível adicionar mais leads');
}
```

**Edge function `calendly-create-event`** — mesma lógica no servidor:
- Antes de criar o meeting_slot + attendee, contar meetings existentes para aquele closer no mesmo horário
- Buscar `max_leads` de `closer_meeting_links` (override) ou `closers.max_leads_per_slot` (global)
- Se cheio, retornar `{ error: 'slot_full', message: 'Horário lotado' }`

**Drag-and-drop (AgendaCalendar)** — no handler `handleDrop`/`handleMoveAttendee`:
- Calcular capacidade do slot destino usando `getSlotCapacityStatus`
- Se lotado, exibir `toast.error('Horário destino está lotado')` e cancelar a operação

### Bypass para coordenadores
Manter o bypass existente: coordenadores/managers/admins podem agendar mesmo em slots lotados, com o aviso visual amarelo que já existe no QuickScheduleModal. No `useAddMeetingAttendee`, aceitar um parâmetro `bypassCapacity?: boolean` que só pode ser true se o caller verificar o role.

