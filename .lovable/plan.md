

## Corrigir contagem duplicada de leads reagendados nos KPIs R2 (mantendo historico visual)

### Problema

Quando um lead da no-show e e reagendado, o sistema cria dois registros de attendee:
1. O original com `status: 'rescheduled'` (slot antigo)
2. Um novo com `is_reschedule: true` (novo slot)

Ambos sao contados nos KPIs porque o filtro atual so exclui `status !== 'cancelled'`. Isso infla o numero de "R2 Agendadas".

O lead **deve continuar aparecendo no slot antigo** no calendario para historico, mas **nao deve ser contado duas vezes nos KPIs**.

### Solucao

Excluir attendees com `status === 'rescheduled'` **apenas nas contagens de KPIs**, sem alterar a visualizacao do calendario nem a query de dados da agenda.

### Alteracoes

**1. `src/hooks/useR2MeetingSlotsKPIs.ts`**
- Linha 39-41: Adicionar `&& a.status !== "rescheduled"` ao filtro de `r2Agendadas`
- Attendees reagendados nao contam como "agendados" pois ja foram movidos para outro slot

**2. `src/hooks/useR2CarrinhoKPIs.ts`**
- Linha 60-63: Filtrar attendees com `status === 'rescheduled'` do calculo de `r2Agendadas`
- Os attendees sao contados via `m.attendees?.length` sem filtro; precisa excluir os rescheduled

**3. `src/hooks/useMeetingSlotsKPIs.ts`** (R1 - mesma consistencia)
- Linha 41-43: Adicionar `&& a.status !== "rescheduled"` ao filtro de `totalAgendadas`

### O que NAO muda

- **`useR2AgendaMeetings.ts`**: continua retornando todos os attendees (incluindo rescheduled) para que o calendario mostre o historico no slot antigo
- **`R2CloserColumnCalendar.tsx`**: continua exibindo attendees rescheduled no slot original
- **`useR2MeetingsExtended.ts`**: continua retornando dados completos para o drawer de detalhes

### Resultado esperado

- KPIs contam cada lead apenas uma vez (o registro ativo)
- Lead reagendado continua visivel no slot antigo do calendario para consulta de historico
- Numeros de "R2 Agendadas" refletem a realidade sem inflacao

