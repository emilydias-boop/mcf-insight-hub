

## Fix: No-show persiste após reagendamento via "+ Agendar R2"

### Problema
Quando um lead dá no-show e é reagendado pelo botão "Reagendar R2" (no card de no-show), o sistema usa `parent_attendee_id` para vincular o novo attendee ao original, e o filtro de no-shows detecta isso e remove da lista.

Porém, quando o reagendamento é feito via **"+ Agendar R2"** (botão geral), nenhum `parent_attendee_id` é setado. O filtro não detecta que o deal já tem uma nova R2 agendada, e o lead continua aparecendo na aba No-Shows.

### Solução
Adicionar uma verificação por `deal_id` no hook `useR2NoShowLeads`: se o deal do no-show já possui outro attendee R2 com status ativo (`invited`, `scheduled`, `pre_scheduled`, `completed`, `contract_paid`), excluir da lista de no-shows.

### Mudanças

**`src/hooks/useR2NoShowLeads.ts`**

1. **Na função `useR2NoShowLeads`** (após a query de `dealsWithCompletedR2`, ~linha 233): adicionar query para buscar deals que já possuem um attendee R2 com status ativo (`invited`, `scheduled`, `pre_scheduled`). Criar set `dealsWithActiveR2`. No loop de transformação (~linha 267), adicionar filtro: `if (att.deal_id && dealsWithActiveR2.has(att.deal_id)) return;`

2. **Na função `useR2NoShowsCount`** (~linha 385): mesma lógica — buscar deals com attendee R2 ativo e subtrair do count final.

Isso cobre ambos os cenários: reagendamento via botão dedicado (parent_attendee_id) e via agendamento geral (deal com nova R2 ativa).

