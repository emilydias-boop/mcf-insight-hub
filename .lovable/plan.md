

## Fix: Attendees com no_show em slots rescheduled

### Problema

A migration anterior corrigiu apenas attendees com status `invited`/`scheduled` em slots reagendados. Porem, existem **15 attendees** que ja tinham sido marcados como `no_show` ANTES do reagendamento e nao foram atualizados para `rescheduled`.

Exemplo real dos dados: attendee `9b4aacba` tem `status: no_show` mas notas com "--- Reagendado em 17/03/2026 14:14 ---" e o slot tem `status: rescheduled`.

### Correcao

**Nova migration SQL** que atualiza os 15 registros restantes:

```sql
UPDATE meeting_slot_attendees msa
SET status = 'rescheduled'
FROM meeting_slots ms
WHERE msa.meeting_slot_id = ms.id
  AND ms.status = 'rescheduled'
  AND msa.status = 'no_show';
```

Isso e tudo. O codigo do `useRescheduleMeeting` ja esta correto (linha 1352-1355 atualiza TODOS os attendees para `rescheduled`), entao novos reagendamentos vao funcionar. So precisa corrigir os dados historicos.

