

## Remover completamente a funcionalidade "Órfãos" do CRM

### O que muda
Remove a aba/página "Órfãos", seus hooks, filtros e a Edge Function associada. Os deals órfãos continuam no banco mas sem interface dedicada.

### Arquivos a deletar
- `src/pages/crm/DealsOrfaos.tsx` — página principal
- `src/hooks/useOrphanDeals.ts` — hooks de dados e mutações
- `src/components/crm/OrphanDealsFilters.tsx` — componente de filtros
- `supabase/functions/backfill-orphan-owners/index.ts` — Edge Function

### Arquivos a editar

1. **`src/App.tsx`**
   - Remover import `DealsOrfaos` (linha 54)
   - Remover as 2 rotas `deals-orfaos` (linhas 192 e 264)

2. **`src/pages/CRM.tsx`** (linha 25)
   - Remover item `{ to: '/crm/deals-orfaos', label: 'Órfãos', icon: UserX }` e import `UserX` se ficar órfão

3. **`src/pages/crm/BUCRMLayout.tsx`**
   - Remover `'deals-orfaos'` do array de tabs permitidas (linha 26)
   - Remover item de navegação `deals-orfaos` (linha 92)

4. **Edge Function** — deletar `backfill-orphan-owners` do Supabase via ferramenta de deploy

### O que NÃO muda
- Comentários com "orphan" em outros arquivos (Agenda, R2, Outside Detection) — são comentários descritivos não relacionados à feature

