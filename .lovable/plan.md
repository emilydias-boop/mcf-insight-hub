

## Plano: Paginação infinita para mostrar todos os contatos

### Problema
O hook `useContactsEnriched` tem `.limit(500)` na query, mostrando apenas 465 contatos (após deduplicação). Existem ~118k contatos na base.

### Solução
Implementar **paginação com "Carregar mais"** no frontend, buscando contatos em lotes de 500 do Supabase e acumulando client-side.

### Alterações

**`src/hooks/useContactsEnriched.ts`**
- Substituir `useQuery` por `useInfiniteQuery` do TanStack Query
- Usar `.range(pageParam * 500, (pageParam + 1) * 500 - 1)` em vez de `.limit(500)`
- O `getNextPageParam` verifica se retornou 500 registros (há mais páginas)
- Flatten todas as páginas, depois aplicar deduplicação no conjunto acumulado
- Manter a resolução de profiles e activities por página

**`src/pages/crm/Contatos.tsx`**
- Adaptar para `useInfiniteQuery`: usar `data.pages.flat()` como lista de contatos
- Adicionar botão **"Carregar mais"** no final da grid (com contagem: "Mostrando X de Y")
- Usar `fetchNextPage`, `hasNextPage`, `isFetchingNextPage` do hook
- Manter filtros e busca funcionando sobre os contatos já carregados

### Resultado
- Inicialmente carrega 500 contatos (rápido)
- Usuário clica "Carregar mais" para trazer os próximos 500
- Todos os ~118k contatos ficam acessíveis progressivamente
- Deduplicação continua funcionando sobre o conjunto acumulado

