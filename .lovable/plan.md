

## Corrigir slot cinza apos transferencia de lead R2

### Problema

Quando um lead e transferido de um closer para outro, o hook `useTransferR2Attendee` move o attendee para o novo slot e, se o slot original ficar vazio (0 attendees), marca-o como `status: 'canceled'` (linha 154-158).

Porem, esse slot cancelado e vazio **continua existindo no banco** e e retornado pela query `useR2AgendaMeetings` (que nao filtra por status).

No componente `R2CloserColumnCalendar.tsx`, a funcao `getConsolidatedMeetingForSlot` (linha 71-95) tem esta logica:

```text
1. Busca todas as meetings no horario
2. Filtra canceladas SEM attendees → validMeetings
3. Se validMeetings vazio → retorna slotMeetings[0] (o slot cancelado!)
```

Ou seja, quando so existe o slot cancelado vazio, ele **retorna o slot cancelado** em vez de `undefined`. O calendario entao renderiza com o estilo `canceled: "bg-muted/60 line-through"` — a celula cinza com risquinho.

Se um novo lead e agendado no mesmo horario, ha agora 2 meetings: a cancelada (vazia) e a nova (scheduled). A consolidacao prioriza a scheduled, mas o bug visual pode persistir dependendo da ordem.

### Correcao

**`src/components/crm/R2CloserColumnCalendar.tsx` - linha 81-84**

Alterar para retornar `undefined` quando todas as meetings sao canceladas e vazias, em vez de retornar o slot cancelado:

```typescript
// ANTES:
if (validMeetings.length === 0) {
  // All are empty canceled slots - show the canceled state
  return slotMeetings[0];
}

// DEPOIS:
if (validMeetings.length === 0) {
  // All are empty canceled slots - treat as no meeting (slot is free)
  return undefined;
}
```

Isso faz com que a celula caia no branch `available ? (botao "Livre")` ou no branch vazio, dependendo da configuracao do slot — comportamento correto.

### Resultado

Apos transferir um lead, o horario original no closer de origem aparecera como "Livre" (botao roxo tracejado) se o slot estiver configurado, em vez de cinza com risquinho.

