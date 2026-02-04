
# Plano: Consolidar Todos os Participantes no Drawer

## Problema

Quando existem multiplos meeting_slots no mesmo horario/closer, o drawer exibe **tabs separadas** para cada slot. O usuario precisa clicar em cada tab para ver os participantes de cada slot.

**Comportamento atual:**
- Slot 1 (8b1107c6): Claudia + Guilherme
- Slot 2 (3c3602f2): Oldai
- Drawer mostra tabs "Lead" | "Lead" e exibe participantes de apenas um slot por vez

**Comportamento desejado:**
- Uma unica lista com todos: Claudia, Guilherme, Oldai

---

## Solucao

Modificar o drawer para combinar os attendees de todos os meetings relacionados em uma unica lista, em vez de exibir tabs separadas.

---

## Alteracoes

### Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx`

**1. Combinar attendees de todos os meetings (perto da linha 224):**

De:
```typescript
const allMeetings = meeting ? [meeting, ...relatedMeetings.filter(m => m.id !== meeting.id)] : [];
const activeMeeting = allMeetings.find(m => m.id === selectedMeetingId) || meeting;
```

Para:
```typescript
const allMeetings = meeting ? [meeting, ...relatedMeetings.filter(m => m.id !== meeting.id)] : [];
// Usar primeiro meeting como referencia para dados do slot (closer, horario, etc)
const activeMeeting = meeting;
```

**2. Atualizar funcao `getParticipantsList` para combinar attendees de todos os meetings (linhas ~430-470):**

Modificar para iterar sobre `allMeetings` em vez de apenas `activeMeeting`:

```typescript
const getParticipantsList = () => {
  // Combinar attendees de TODOS os meetings no mesmo slot
  const allAttendees: MeetingAttendee[] = [];
  for (const m of allMeetings) {
    if (m.attendees) {
      allAttendees.push(...m.attendees);
    }
  }
  
  // Mapear para formato de participante (codigo existente)
  return allAttendees.map(att => {
    // ... manter logica existente de mapeamento ...
  });
};
```

**3. Remover ou simplificar as tabs de meetings (linhas 496-511):**

Como todos os participantes serao exibidos juntos, as tabs nao sao mais necessarias. Remover a secao:

```typescript
{/* Tabs for multiple meetings */}
{allMeetings.length > 1 && (
  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
    {allMeetings.map((m) => (
      // ...
    ))}
  </div>
)}
```

**4. Atualizar titulo para refletir consolidacao:**

```typescript
<SheetTitle className="text-lg">
  Reuniao às {format(parseISO(meeting.scheduled_at), 'HH:mm')}
</SheetTitle>
```

**5. Ajustar referencias a `activeMeeting` onde necessario:**

Para acoes como:
- `video_conference_link`: usar do primeiro meeting ou buscar do closer
- `deal_id`: cada participante ja tem seu proprio `dealId`
- Status updates: ja usam `attendeeId` individual

---

## Resultado Esperado

- Drawer exibe "Reuniao às 18:00"
- "Participantes (3)" mostrando Claudia, Guilherme e Oldai juntos
- Cada participante mantem suas proprias acoes (status, notas, etc)
- Sem necessidade de tabs para alternar entre slots

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `AgendaMeetingDrawer.tsx` | Consolidar attendees de todos meetings, remover tabs |
