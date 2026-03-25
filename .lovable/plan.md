

## Adicionar exclusão individual e em massa de leads (coordenadores+)

### Contexto
Atualmente não existe funcionalidade de excluir deals/leads no CRM. A feature deve permitir excluir leads individualmente (dentro do card/drawer) e em massa (via seleção no Kanban), visível apenas para roles `admin`, `manager` e `coordenador`.

### Alterações

#### 1. Hook `src/hooks/useDeleteDeals.ts` (novo)
- Criar mutation `useDeleteDeal` (single) e `useDeleteDeals` (bulk)
- Deleta de `crm_deals` por ID(s)
- Invalida queries `['crm-deals']` após sucesso
- Toast de confirmação/erro

#### 2. `src/components/crm/BulkActionsBar.tsx` — Adicionar botão "Excluir"
- Nova prop opcional `onDelete`, `isDeleting`
- Renderizar botão vermelho "Excluir" com ícone `Trash2` quando `onDelete` existe
- Pedir confirmação antes de executar (dialog inline ou window.confirm)

#### 3. `src/pages/crm/Negocios.tsx` — Integrar exclusão em massa
- Importar `useDeleteDeals`
- Verificar role: só passa `onDelete` ao `BulkActionsBar` se role é `admin`, `manager` ou `coordenador`
- Callback executa delete dos IDs selecionados e limpa seleção

#### 4. `src/components/crm/DealKanbanCard.tsx` ou `DealDetailsDrawer.tsx` — Botão excluir individual
- Verificar se já existe menu de contexto/ações no card
- Adicionar opção "Excluir lead" visível apenas para coordenadores+
- Confirmar via `AlertDialog` antes de executar

#### 5. Confirmação de exclusão `src/components/crm/DeleteDealsConfirmDialog.tsx` (novo)
- Dialog com aviso do número de leads a excluir
- Input de confirmação ("digite EXCLUIR") para bulk > 5 leads
- Botão destrutivo

### Visibilidade por role
```typescript
const canDelete = ['admin', 'manager', 'coordenador'].includes(role || '');
```
Apenas essas roles verão os botões de exclusão. SDRs, closers e demais não terão acesso.

### Arquivos
- **Novo**: `src/hooks/useDeleteDeals.ts`, `src/components/crm/DeleteDealsConfirmDialog.tsx`
- **Editados**: `src/components/crm/BulkActionsBar.tsx`, `src/pages/crm/Negocios.tsx`, drawer/card de deal

