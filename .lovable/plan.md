

## Ordenar cards do Kanban por tempo na stage (mais recente primeiro)

### Problema
O sort padrão "Mais Novo" ordena por `created_at` (data de criação do deal no sistema). Isso faz com que um lead que acabou de entrar numa stage (ex: Contrato Pago há 1h) fique abaixo de leads que estão ali há dias, porque foram criados antes no sistema.

### Alterações

**`src/components/crm/StageSortDropdown.tsx`**
- Adicionar duas novas opções ao tipo `SortOption`: `'stage_newest'` e `'stage_oldest'`
- Adicionar grupo de opções "Por Stage": `{ value: 'stage_newest', label: 'Recente na Stage' }` e `{ value: 'stage_oldest', label: 'Antigo na Stage' }`
- Renderizar esse novo grupo no popover

**`src/components/crm/DealKanbanBoard.tsx`**
- Mudar o default sort de `'newest'` para `'stage_newest'` (linha 153)
- Adicionar cases no `sortDeals` switch:
  - `'stage_newest'`: ordena por `stage_moved_at` descendente (mais recente primeiro)
  - `'stage_oldest'`: ordena por `stage_moved_at` ascendente
- Fallback para `created_at` quando `stage_moved_at` for null

### Resultado
- Por padrão, leads que entraram mais recentemente na stage aparecem no topo
- O Epson (1h na stage) aparecerá acima de leads com 24d
- O usuário pode trocar para qualquer outro critério via dropdown

