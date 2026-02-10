
# Fix: Reuniao do Julio mostrando como Cancelada

## Problema
Existem **dois meeting slots** para o Julio as 18:00 (21:00 UTC) no dia 11/02/2026:

1. Slot `d2254bfc` - status `canceled`, **sem participantes** (slot orfao/vazio)
2. Slot `b77e1a07` - status `scheduled`, participante **Alan Carlos Rodrigues de Lira**

O calendario pega ambos os slots no mesmo horario e usa o **primeiro da lista** (`slotMeetings[0]`) para renderizar. Como o slot cancelado vem primeiro, a celula inteira aparece como "Cancelada", escondendo a reuniao valida com o Alan.

## Solucao

### Alterar `CloserColumnCalendar.tsx`

Na funcao `getMeetingsForSlot`, filtrar slots cancelados que nao possuem participantes (slots orfaos). Isso remove os "ghost slots" sem afetar reunioes canceladas legitimas (que tem participantes vinculados).

Adicionalmente, ao consolidar multiplos slots no mesmo horario, priorizar o slot com status ativo (scheduled/completed) sobre cancelados.

### Detalhes Tecnicos

**Arquivo**: `src/components/crm/CloserColumnCalendar.tsx`

1. Modificar `getMeetingsForSlot` para excluir slots com status `canceled` que tenham zero attendees:
```text
meetings.filter(m => {
  // ... existing time/closer checks ...
  // Exclude orphan canceled slots (no attendees)
  if (m.status === 'canceled' && (!m.attendees || m.attendees.length === 0)) return false;
  return true;
})
```

2. Ao selecionar `firstMeeting` da lista de slots consolidados (linha ~296), ordenar para que slots nao-cancelados venham primeiro:
```text
const sortedMeetings = slotMeetings.sort((a, b) => {
  if (a.status === 'canceled' && b.status !== 'canceled') return 1;
  if (a.status !== 'canceled' && b.status === 'canceled') return -1;
  return 0;
});
const firstMeeting = sortedMeetings[0];
```

Isso garante que mesmo se houver um slot cancelado COM participantes no mesmo horario, o slot ativo sera exibido como principal.
