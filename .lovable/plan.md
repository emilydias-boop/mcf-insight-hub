

## Corrigir erro "'meeting_slots' is not an embedded resource" na aba Pendentes

### Problema
O PostgREST atualizado exige que filtros em recursos embarcados usem o **alias** definido no `.select()` (`meeting_slot`) em vez do nome da tabela (`meeting_slots`). Todas as queries em `useR2PendingLeads.ts` (e possivelmente `useR2SemSucesso.ts`) usam `.eq('meeting_slots.meeting_type', ...)` quando deveriam usar `.eq('meeting_slot.meeting_type', ...)`.

### Correção

**`src/hooks/useR2PendingLeads.ts`** — 4 ocorrências:
- Linha 93: `.eq('meeting_slots.meeting_type', 'r1')` → `.eq('meeting_slot.meeting_type', 'r1')`
- Linha 172: `.eq('meeting_slots.meeting_type', 'r2')` → `.eq('meeting_slot.meeting_type', 'r2')`
- Linha 188: `.eq('meeting_slots.meeting_type', 'r2')` → `.eq('meeting_slot.meeting_type', 'r2')`
- Linha 320: `.eq('meeting_slots.meeting_type', 'r1')` → `.eq('meeting_slot.meeting_type', 'r1')`
- Linha 321: `.order('meeting_slots(scheduled_at)', ...)` → `.order('meeting_slot(scheduled_at)', ...)`

**`src/hooks/useR2SemSucesso.ts`** — 1 ocorrência:
- Linha 123: `.eq('meeting_slots.meeting_type', 'r1')` → `.eq('meeting_slot.meeting_type', 'r1')`

Nenhuma alteração de lógica — apenas renomear a referência do filtro para usar o alias consistente com o `.select()`.

