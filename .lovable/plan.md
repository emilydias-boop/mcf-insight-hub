

## Fix: Slots fantasma ("Lead" sem dados) após transferência ou remoção de horário

### Problema
Após transferir um attendee para outro closer ou remover um horário, o slot original continua aparecendo no calendário mostrando "Lead" sem dados. Isso acontece por dois motivos:

1. **Slots com status `scheduled`/`rescheduled` mas sem attendees**: Após transferência, o attendee é movido mas o slot original pode não ser cancelado corretamente (ex: status permanece `scheduled` com 0 attendees).
2. **Slots cancelados ainda sendo exibidos**: A query não filtra slots cancelados, e o filtro no componente (`getConsolidatedMeetingForSlot`) tenta filtrar mas falha em edge cases.

### Solução

**1. `src/components/crm/R2CloserColumnCalendar.tsx`** — `getConsolidatedMeetingForSlot`

Adicionar filtro: qualquer meeting sem attendees (array vazio) deve ser tratado como inexistente, independente do status:

```typescript
const validMeetings = slotMeetings.filter(m => 
  m.attendees && m.attendees.length > 0
);
if (validMeetings.length === 0) return undefined;
```

Isso elimina slots fantasma no calendário visual.

**2. `src/hooks/useR2AgendaMeetings.ts`** — query principal

Após o fetch, filtrar meetings que estão canceladas E sem attendees (limpeza no nível dos dados):

```typescript
return (data || [])
  .filter(meeting => {
    // Remove orphan slots: canceled with no attendees
    if (meeting.status === 'canceled' && (!meeting.attendees || meeting.attendees.length === 0)) return false;
    // Remove slots with no attendees at all (orphan scheduled slots)
    if (!meeting.attendees || meeting.attendees.length === 0) return false;
    return true;
  })
  .map(meeting => ({ ... }));
```

**3. `src/hooks/useTransferR2Attendee.ts`** — cleanup mais robusto

Garantir que o slot original seja sempre cancelado quando ficar sem attendees (já faz isso, mas reforçar):
- Sem mudança necessária, a lógica já está correta (linhas 148-159).

### Resumo
- Componente do calendário: não renderizar slots sem attendees
- Hook de dados: filtrar na query slots sem attendees  
- Ambos cenários cobertos: transferência e remoção de horário

