
# Fix: Reuniao do Julio ainda mostrando "Cancelada" no Drawer

## Diagnostico

A correcao anterior aplicou o filtro apenas dentro do `CloserColumnCalendar.tsx` (na funcao `getMeetingsForSlot`). Isso fez o **grid do calendario** mostrar corretamente, mas o **drawer** continua recebendo o slot cancelado orfao por outra via.

O problema raiz esta em `Agenda.tsx`: a variavel `filteredMeetings` inclui **todos** os meeting slots, inclusive o slot orfao cancelado (`d2254bfc`, status `canceled`, 0 participantes). Esse array e passado para:
1. `relatedMeetings` do drawer -- que pode incluir o slot cancelado como "relacionado"
2. Outras views (AgendaCalendar, MeetingsList) que nao tem o filtro

## Solucao

Aplicar o filtro de slots orfaos cancelados **na origem** dos dados, no `filteredMeetings` dentro de `Agenda.tsx`, antes de passar para qualquer componente. Isso garante que nenhum componente (calendario, drawer, lista) veja esses slots fantasma.

## Alteracao

### Arquivo: `src/pages/crm/Agenda.tsx`

Dentro do `useMemo` de `filteredMeetings` (linhas 95-115), adicionar um filtro que exclui meeting slots com status `canceled` que tenham 0 participantes:

```text
let result = meetings;

// Remove orphan canceled slots (canceled with no attendees)
result = result.filter(m => {
  if (m.status === 'canceled' && (!m.attendees || m.attendees.length === 0)) return false;
  return true;
});

// ... resto dos filtros existentes
```

Isso resolve o problema na raiz, garantindo que:
- O grid do calendario nao exibe slots orfaos
- O drawer nao recebe slots orfaos como `meeting` nem como `relatedMeetings`
- A lista de reunioes tambem fica limpa
- Qualquer view futura tambem se beneficia

## Complexidade
Alteracao de 3 linhas em 1 arquivo. Sem efeitos colaterais -- reunioes canceladas com participantes continuam vissiveis normalmente.
