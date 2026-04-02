
## Remover completamente a funcionalidade "Duplicados" do CRM

### O que muda
Remove a aba "Duplicados", página, hooks, modal de simulação, Edge Function e RPCs associadas. A verificação de duplicidade na criação manual de deals (DealFormDialog) continua funcionando normalmente.

### Arquivos a deletar
- `src/pages/crm/ContatosDuplicados.tsx` — página principal
- `src/hooks/useDuplicateContacts.ts` — hooks (useDuplicateContacts, useMergeDuplicates, useMergeAllDuplicates, useConsolidateDeals, useFullCleanup)
- `src/components/crm/SimulationResultsModal.tsx` — modal de simulação detalhada
- `supabase/functions/merge-duplicate-contacts/index.ts` — Edge Function

### Arquivos a editar

1. **`src/App.tsx`**
   - Remover import `ContatosDuplicados` (linha 57)
   - Remover as 2 rotas `contatos-duplicados` (linhas 194 e 266)

2. **`src/pages/CRM.tsx`** (linha 27)
   - Remover item `{ to: '/crm/contatos-duplicados', label: 'Duplicados', icon: Copy }`

3. **`src/pages/crm/BUCRMLayout.tsx`**
   - Remover `'contatos-duplicados'` do array de tabs (linha 27)
   - Remover item de navegação `contatos-duplicados` (linha 94)

### Edge Function a remover do deploy
- `merge-duplicate-contacts`

### O que NÃO muda
- Verificação de duplicidade no DealFormDialog (prevenção na entrada)
- RPCs `get_duplicate_contact_emails` e `get_duplicate_contact_phones` ficam no banco (não causam problema, podem ser removidas futuramente via migration)
