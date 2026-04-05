
# Adicionar total real na fila do Cockpit SDR

## Alteracoes

### 1. `src/hooks/useSDRCockpit.ts`
- Exportar novo hook `useSDRQueueCount` com `useQuery` chamando `supabase.rpc('get_sdr_cockpit_count', { p_owner_id: user.email })`, `staleTime: 60000`, retornando `data as number`
- Retornar `totalCount` do hook

### 2. `src/pages/sdr/SDRCockpit.tsx`
- Importar e chamar `useSDRQueueCount`
- Passar `totalCount` como prop para `CockpitQueue`

### 3. `src/components/sdr/cockpit/CockpitQueue.tsx`
- Adicionar `totalCount?: number | null` na interface de props
- Header: se `totalCount` e `hasNextPage` → `Fila (${deals.length} de ${totalCount})`; senao → `Fila (${totalCount ?? deals.length})`

## Arquivos alterados
3 arquivos, mudancas minimas em cada.
