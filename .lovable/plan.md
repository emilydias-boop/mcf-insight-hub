

# Filtrar pré-agendados também no hook useR2MeetingsExtended

## Problema

O filtro de `pre_scheduled` foi aplicado apenas em `useR2AgendaMeetings.ts` (usado pela aba "Calendário"), mas a aba **"Por Sócio"** e outras views usam `useR2MeetingsExtended.ts`, que não filtra attendees pré-agendados. Por isso os badges "Pré" continuam aparecendo na grade.

## Solução

| Arquivo | Alteração |
|---|---|
| `src/hooks/useR2MeetingsExtended.ts` | Na linha ~265 onde os attendees são mapeados, adicionar filtro para excluir `pre_scheduled` antes do `.map()` |

### Alteração (linha ~265)

```typescript
// ANTES:
attendees: attendeesArr.map(att => {

// DEPOIS:
attendees: attendeesArr
  .filter(att => (att.status as string) !== 'pre_scheduled' && (att.status as string) !== 'cancelled')
  .map(att => {
```

E na linha ~226, o filtro de meetings vazios já existe (`attendeesArr.length > 0`), mas precisa considerar o filtro de attendees. Ajustar para filtrar attendees **antes** de verificar se o meeting tem attendees:

```typescript
// Linha ~226-228: mover o filtro de attendees para antes da verificação
return (meetings || []).filter(meeting => {
  const attendeesArr = ((meeting as Record<string, unknown>).attendees || []) as Array<Record<string, unknown>>;
  const visibleAttendees = attendeesArr.filter(att => 
    (att.status as string) !== 'pre_scheduled' && (att.status as string) !== 'cancelled'
  );
  return visibleAttendees.length > 0;
}).map(meeting => {
```

Isso remove pré-agendados de **todas** as views da Agenda R2 (Por Sócio, Lista, Calendário), mantendo-os apenas na aba "Pré-Agendados".

