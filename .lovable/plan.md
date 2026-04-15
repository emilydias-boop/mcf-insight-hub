

## Plano: Indicador visual para leads encaixados

### Problema
Leads encaixados na safra atual (com `carrinho_week_start = 2026-04-09`) aparecem na lista "Todas R2s" agrupados pela data real da reunião (ex: 30/03, 01/04). Sem nenhum indicador visual, parece que são leads de outra semana que não deveriam estar ali.

### Solução
Adicionar um badge "Encaixado" nos leads que vieram de outra semana via encaixe, para que fique claro por que aparecem na safra atual mesmo com datas antigas.

### Alterações

**1. `src/hooks/useR2CarrinhoData.ts`**
- Adicionar campo `is_encaixado: boolean` à interface `R2CarrinhoAttendee`
- Em `fetchAttendeesFromQuery`: marcar `is_encaixado = false` para todos
- Em `fetchEncaixadosForWeek`: marcar `is_encaixado = true` para todos (já que são leads trazidos especificamente pelo encaixe)
- Para leads que vêm via `fetchAttendeesFromQuery` mas têm `carrinho_week_start` igual ao `weekStartStr`, também marcar `is_encaixado = true` (caso a reunião esteja dentro da boundary E seja encaixada)

**2. `src/components/crm/R2AgendadasList.tsx`**
- Na tabela, ao lado do nome ou do horário, exibir um badge pequeno "Encaixado" (cor roxa/amarela) quando `att.is_encaixado === true`
- Isso deixa claro que o lead está na lista por ter sido manualmente atribuído a esta safra

**3. `src/components/crm/R2AprovadosList.tsx`**
- Mesmo tratamento: badge "Encaixado" para leads com `is_encaixado === true`

Nenhuma alteração de lógica de dados — apenas visibilidade.

