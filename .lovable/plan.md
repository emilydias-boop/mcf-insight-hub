
# Plano: Corrigir Exibicao de Multiplos Slots no Mesmo Horario

## Problema Identificado

Na view "Por Closer" (`CloserColumnCalendar.tsx`), a funcao `getMeetingForSlot` usa `.find()` que retorna apenas o **primeiro** meeting encontrado:

```typescript
const getMeetingForSlot = (closerId: string, slotTime: Date) => {
  return meetings.find((m) => {  // <-- find retorna apenas 1
    ...
  });
};
```

**Dados no banco:**
- Slot 8b1107c6: Mateus, 21:00, Claudia + Guilherme
- Slot 3c3602f2: Mateus, 21:00, Oldai

O `.find()` retorna apenas o primeiro slot, ignorando o Oldai.

---

## Solucao

Alterar a funcao para retornar **todos** os meetings e combinar os attendees na renderizacao.

---

## Alteracoes

### Arquivo: `src/components/crm/CloserColumnCalendar.tsx`

**1. Renomear funcao e usar `filter` (linhas 144-154):**

De:
```typescript
const getMeetingForSlot = (closerId: string, slotTime: Date) => {
  return meetings.find((m) => {
    if (m.closer_id !== closerId) return false;
    const meetingTime = parseISO(m.scheduled_at);
    return (
      isSameDay(meetingTime, slotTime) &&
      meetingTime.getHours() === slotTime.getHours() &&
      meetingTime.getMinutes() === slotTime.getMinutes()
    );
  });
};
```

Para:
```typescript
const getMeetingsForSlot = (closerId: string, slotTime: Date) => {
  return meetings.filter((m) => {
    if (m.closer_id !== closerId) return false;
    const meetingTime = parseISO(m.scheduled_at);
    return (
      isSameDay(meetingTime, slotTime) &&
      meetingTime.getHours() === slotTime.getHours() &&
      meetingTime.getMinutes() === slotTime.getMinutes()
    );
  });
};
```

**2. Atualizar `isSlotAvailable` (linha 140):**

De:
```typescript
const hasMeeting = getMeetingForSlot(closerId, slotTime);
return !hasMeeting;
```

Para:
```typescript
const hasMeetings = getMeetingsForSlot(closerId, slotTime);
return hasMeetings.length === 0;
```

**3. Atualizar uso na renderizacao (linhas 277-288):**

De:
```typescript
const meeting = getMeetingForSlot(closer.id, slot);
...
{meeting ? (
```

Para:
```typescript
const slotMeetings = getMeetingsForSlot(closer.id, slot);
const hasMeetings = slotMeetings.length > 0;
// Combinar attendees de todos os meetings
const allAttendees = slotMeetings.flatMap(m => m.attendees || []);
const firstMeeting = slotMeetings[0];
...
{hasMeetings ? (
```

**4. Atualizar renderizacao de attendees para usar `allAttendees`:**

Onde o codigo itera sobre `meeting.attendees`, usar `allAttendees` para exibir attendees de todos os slots combinados.

---

## Resultado Esperado

- O Oldai aparecera junto com Claudia e Guilherme na celula do Mateus as 18:00
- Qualquer quantidade de slots do mesmo closer no mesmo horario sera combinada
- Consistente com a view "Calendario" que ja combina multiplos slots

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `CloserColumnCalendar.tsx` | Mudar `find` para `filter` e combinar attendees |
