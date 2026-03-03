

## Problema

A aba "Lista" na Agenda R1 mostra o **status do slot** (`meeting_slots.status`) que normalmente é apenas `completed` ou `scheduled`. Os status granulares como **No-show**, **Reagendado**, **Contrato Pago** ficam no nível do **participante** (`meeting_slot_attendees.status`), por isso nunca aparecem na lista.

O filtro de status também opera sobre `meeting_slots.status`, então filtrar por "No-show" ou "Reagendadas" retorna zero resultados.

## Correção

### 1. Reformular a listagem para nível de attendee (`MeetingsList.tsx`)

Em vez de iterar sobre `meetings` (slots), a lista deve **expandir cada slot em linhas por attendee**. Cada linha mostra:
- Data/Hora do slot
- Nome do lead (attendee individual, não todos agrupados)
- Closer do slot
- **Status do attendee** (invited→Agendada, completed→Realizada, no_show→No-show, rescheduled→Reagendada, contract_paid→Contrato Pago)
- Ações contextuais

Isso alinha a lista com o que o calendário já mostra visualmente.

### 2. Ajustar o filtro de status (`Agenda.tsx`)

Mudar o `filteredMeetings` para que, quando um `statusFilter` está ativo, filtre meetings que **tenham ao menos 1 attendee** com aquele status (em vez de filtrar por `m.status`):

```typescript
if (statusFilter) {
  // Map filter values to attendee-level statuses
  const attendeeStatusMap: Record<string, string[]> = {
    'scheduled': ['invited', 'scheduled'],
    'rescheduled': ['rescheduled'],
    'completed': ['completed'],
    'no_show': ['no_show'],
    'canceled': ['cancelled', 'canceled'],
    'contract_paid': ['contract_paid'],
  };
  const validStatuses = attendeeStatusMap[statusFilter] || [statusFilter];
  result = result.filter(m => 
    m.attendees?.some(att => validStatuses.includes(att.status))
  );
}
```

### 3. Na `MeetingsList`, exibir status por attendee

Reformular o componente para que cada attendee (excluindo sócios/`is_partner`) gere uma linha com seu status individual. Isso elimina a confusão de ver "Realizada" quando na verdade um dos leads deu no-show.

### Resultado

- A lista mostrará No-show, Reagendado, Contrato Pago corretamente
- O filtro de status funcionará com base nos status reais dos attendees
- Consistência entre a visão de calendário e a visão de lista

