

## Plano: Capacidade individual por horário (R1) — com bloqueio rígido

### Problema

Hoje `max_leads_per_slot` é global por closer. O usuário quer definir capacidades diferentes por horário (ex: 11:30 = 3, 17:00 = 1) e o sistema **deve bloquear** agendamento quando o limite for atingido.

### Alterações

**1. Migration SQL**
- Adicionar coluna `max_leads` (INTEGER, nullable) na tabela `closer_meeting_links`
- Quando `null`, usa o padrão global do closer

**2. UI — `CloserAvailabilityConfig.tsx`**
Na lista de links por dia (linhas 343-363), adicionar um input numérico compacto ao lado de cada horário:

```text
11:30  [https://meet.google.com/...]  [3 👥]  🗑️
17:00  [https://meet.google.com/...]  [1 👥]  🗑️
```

- Input tipo number, largura ~16, min=1, max=10
- Placeholder mostra o padrão global do closer
- Ao alterar (onBlur), salva via mutation direta no `closer_meeting_links`

**3. Hook — `useCloserMeetingLinks.ts`**
- Incluir `max_leads` no select e no tipo `CloserMeetingLink`
- Adicionar mutation `useUpdateCloserMeetingLinkMaxLeads` para atualizar o campo

**4. Lógica de bloqueio — `CloserColumnCalendar.tsx`**
Na função `isSlotAvailable` (linha 184-203):
- Buscar o link específico do slot no array de `closer_meeting_links` (pelo `closer_id` + `start_time` + `day_of_week`)
- Usar `link.max_leads ?? closer.max_leads_per_slot ?? 4` como capacidade
- Manter o bloqueio rígido: `totalAttendees < capacity` retorna `false` quando cheio (não permite agendar)

**5. Hook — `useAgendaData.ts`**
- Incluir `max_leads` ao buscar `closer_meeting_links` para disponibilizar nos dados do calendário

### Prioridade de capacidade

1. `closer_meeting_links.max_leads` (override por slot)
2. `closers.max_leads_per_slot` (padrão global do closer)
3. Fallback: 4

### Comportamento

Slot cheio = **bloqueado**, não permite agendar mais leads naquele horário. Isso já é o comportamento atual em `isSlotAvailable`, apenas passará a usar a capacidade do slot específico em vez do global.

