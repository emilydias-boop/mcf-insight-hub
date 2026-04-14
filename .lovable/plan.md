

## Plano: Limitar pré-agendamentos a 2 por horário + restringir faixa 09:00-20:00

### Problema

No modo pré-agendamento, todos os horários de 08:00 a 21:00 são exibidos sem verificação de capacidade. Qualquer quantidade de leads pode ser pré-agendada no mesmo horário.

### Alterações

**1. `src/hooks/useR2CloserAvailableSlots.ts`**

- Adicionar uma query extra que busca `meeting_slot_attendees` (via join com `meeting_slots`) para contar attendees ativos (`pre_scheduled`, `invited`, `scheduled`) por horário do closer na data selecionada
- Expor um novo campo `preScheduledCounts: Record<string, number>` no retorno do hook (mapa de "HH:mm" para quantidade de attendees)

**2. `src/components/crm/R2QuickScheduleModal.tsx`**

- Alterar `allFreeTimeSlots` para gerar horários de **09:00 a 20:00** (em vez de 08:00 a 21:00)
- No modo pré-agendamento, usar `preScheduledCounts` do hook para:
  - Mostrar "(1/2)" quando há 1 attendee no horário
  - Mostrar "(lotado)" em vermelho e `disabled` quando há 2+ attendees
- Constante `MAX_PRE_SCHEDULE_PER_SLOT = 2`
- Horários fora da faixa 09:00-20:00 não aparecem para pré-agendamento; se o responsável da agenda quiser agendar fora desse range, usará o modo normal (não pré-agendamento)

### Detalhes técnicos

A query de contagem usará:
```sql
meeting_slot_attendees(count) 
  via meeting_slots(closer_id, scheduled_at)
  where status in ('pre_scheduled','invited','scheduled')
```

Agrupada por horário formatado `HH:mm`, retornando a contagem total de attendees por slot.

### Resultado

- Pré-agendamentos limitados a 2 leads por horário por closer
- Faixa de horários reduzida para 09:00-20:00 no modo pré-agendamento
- Horários fora dessa faixa ficam a critério do responsável da agenda via modo normal

