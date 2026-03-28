

## Fix: SDR mostra dono de qualquer pipeline em vez de filtrar por Incorporador

### Causa raiz

A query de deals (linhas 463-465 e 592-594) busca **todos** os deals do contato sem filtrar por pipeline/origin. A função `mergeDealsIntoMap` usa o `owner.full_name` do **primeiro deal encontrado**, que pode ser de Consórcio, Crédito, etc. Resultado: o SDR exibido é "qualquer primeiro dono" e não o dono do deal na pipeline Incorporador.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Buscar origin IDs do Incorporador** no início da queryFn, via `bu_origin_mapping`:
```typescript
const { data: buOrigins } = await supabase
  .from('bu_origin_mapping')
  .select('entity_id')
  .eq('bu', 'incorporador')
  .eq('entity_type', 'origin');
const incorporadorOriginIds = new Set((buOrigins || []).map(o => o.entity_id));
```

2. **Adicionar `origin_id` ao select** das queries de deals (linhas 464 e 593):
```typescript
.select('id, contact_id, origin_id, owner_profile_id, ...')
```

3. **Modificar `mergeDealsIntoMap`** para receber o set de origin IDs do Incorporador e **priorizar deals da pipeline Incorporador**:
   - Adicionar campo `isIncorporador: boolean` ao `DealLookup`
   - Na merge: se o deal existente NÃO é incorporador mas o novo É, substituir (não apenas mesclar tags)
   - Se ambos são incorporador, mesclar tags normalmente
   - Se nenhum é incorporador, manter comportamento atual

4. **Resultado**: O SDR exibido será o dono do deal na pipeline Incorporador. Tags continuam sendo mescladas de todas as pipelines.

### Arquivos alterados
- `src/hooks/useCarrinhoAnalysisReport.ts`

