

## Fix: Leads reaparecem após transferência no Limbo

### Problema
Quando leads são transferidos (atribuídos a um SDR), o estado local `results` é atualizado corretamente (status muda para `com_dono`), mas os **dados persistidos** na tabela `limbo_uploads` no Supabase não são atualizados. Ao recarregar a página, o sistema carrega os resultados antigos e os leads reaparecem com o status original.

### Solução

**1. Novo mutation em `src/hooks/useLimboUpload.ts`**
- Criar `useUpdateLimboResults()` — mutation que faz UPDATE na `limbo_uploads` atualizando `comparison_results` pelo ID do upload mais recente
- Invalidar `['limbo-upload-latest']` no `onSuccess`

**2. Sincronizar após atribuição em `src/pages/crm/LeadsLimbo.tsx`**
- Após o `Promise.all` bem-sucedido no `handleBulkAssign`, chamar o novo mutation para persistir o estado atualizado de `results` de volta no Supabase
- Usar o `latestUpload.id` para saber qual registro atualizar
- Isso garante que ao recarregar a página, os leads já apareçam com `com_dono` e não voltem ao status anterior

### Detalhes técnicos
- O update é um simples `supabase.from('limbo_uploads').update({ comparison_results: updatedResults }).eq('id', uploadId)`
- A chamada é feita depois que o `setResults` local já atualizou, usando o valor mais recente do state

