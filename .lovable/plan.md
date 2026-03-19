

## Plano: Enforcar limite de "Leads por Reunião" na Agenda R1

### Problema

O `useCheckSlotAvailability` na linha 1298 de `useAgendaData.ts` retorna **sempre** `available: true` — nunca consulta `max_leads_per_slot` nem `closer_meeting_links.max_leads`. O modal de agendamento R1 (`QuickScheduleModal`) também hardcoda `isFull: false` na linha 452. Resultado: o limite configurado no slider "Leads por Reunião" é ignorado.

### Alterações

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAgendaData.ts` — `useCheckSlotAvailability` | Buscar `max_leads_per_slot` do closer e `max_leads` do `closer_meeting_links` para o slot específico. Calcular `available = currentCount < maxLeads`. Retornar `{ available, currentCount, maxLeads, attendees }` |
| `src/components/crm/QuickScheduleModal.tsx` — `getTimeSlotStatus` | Usar `slotAvailability.available` e `slotAvailability.maxLeads` em vez de hardcodar `isFull: false` |
| `src/components/crm/QuickScheduleModal.tsx` — UI do horário | Mostrar contagem `(X/Y)` em cada opção de horário. Desabilitar horários lotados (exceto coordenadores). Mostrar badge de alerta no indicador de disponibilidade |
| `src/components/crm/QuickScheduleModal.tsx` — botão Agendar | Adicionar check: se `slotAvailability?.available === false` e usuário não é coordenador, desabilitar botão e mostrar aviso |

### Lógica de prioridade do limite (já existente no `CloserColumnCalendar`)

```
maxLeads = closer_meeting_links.max_leads (override por slot)
         ?? closers.max_leads_per_slot (global do closer)
         ?? 4 (fallback)
```

### Detalhes técnicos

**`useCheckSlotAvailability`**: Adicionar query ao `closer_meeting_links` para o `closer_id` + `day_of_week` + `start_time` do slot selecionado para buscar o `max_leads` override. Buscar `max_leads_per_slot` do closer. Aplicar hierarquia de prioridade. Comparar com `currentCount`.

**Coordenadores**: Podem agendar mesmo com slot lotado (bypass), mas verão um aviso visual amarelo indicando que estão excedendo a capacidade.

**Cross-BU**: A contagem de attendees já é feita corretamente por `lead_type`, então não precisa de mudança no filtro — apenas adicionar a comparação com o limite.

