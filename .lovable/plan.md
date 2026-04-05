

# Scroll infinito + contador na fila do Cockpit SDR

## Alteracoes

### 1. `src/hooks/useSDRCockpit.ts` — novo hook `useSDRQueueInfinite`

Substituir `useSDRQueue` por um hook baseado em `useInfiniteQuery` do TanStack:
- `getNextPageParam`: se a pagina retornou `limit` itens (50), proximo offset = offset + 50; senao `undefined`
- `queryFn` chama `supabase.rpc('get_sdr_cockpit_queue', { p_owner_id, p_limit: 50, p_offset: pageParam })`
- Exportar dados achatados (`pages.flatMap`), `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`
- Primeira chamada tambem faz um COUNT separado: `supabase.rpc('get_sdr_cockpit_queue', { p_owner_id, p_limit: 999999, p_offset: 0 })` e conta `.length` — OU melhor, criar uma query simples `select count` de `crm_deals` com filtro de owner para obter o total. Alternativa mais leve: usar a RPC com limit 1 offset 0 apenas para saber se ha mais, e estimar "50+" no header. Na pratica, o mais simples: retornar `totalEstimated` como `null` e no header mostrar "Fila (50+)" quando `hasNextPage`, e "Fila (N)" quando nao ha mais paginas.

Decisao: para evitar query extra de COUNT, mostrar "Fila (N carregados)" quando ha mais paginas e "Fila (N)" quando todas foram carregadas. Isso e suficiente e nao requer alteracao no banco.

### 2. `src/pages/sdr/SDRCockpit.tsx`

- Importar `useSDRQueueInfinite` em vez de `useSDRQueue`
- Desestruturar: `{ data: queue, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage }`
- Passar `fetchNextPage`, `hasNextPage`, `isFetchingNextPage` para `CockpitQueue`

### 3. `src/components/sdr/cockpit/CockpitQueue.tsx`

- Adicionar `IntersectionObserver` num elemento sentinela renderizado 5 cards antes do final da lista
- Quando visivel e `hasNextPage && !isFetchingNextPage`, chamar `fetchNextPage()`
- Atualizar header: mostrar `Fila (N)` quando todas carregadas, `Fila (N carregados...)` quando ha mais
- Mostrar spinner de loading no final da lista durante `isFetchingNextPage`
- Remover o botao "Ver mais" manual (substituido pelo scroll infinito)
- Atualizar props: `onLoadMore` e `hasMore` substituidos por `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `totalLoaded`

## Arquivos alterados
1. `src/hooks/useSDRCockpit.ts`
2. `src/pages/sdr/SDRCockpit.tsx`
3. `src/components/sdr/cockpit/CockpitQueue.tsx`

