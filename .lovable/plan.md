

## Correção: Consolidação de Deals retornando 0

### Problema

A função `consolidateDeals` falha silenciosamente porque a query na linha 544 usa `crm_stages(order)` que causa um erro PostgREST por FK ambígua (existem múltiplas FKs para `crm_stages`). Quando a query falha, a função retorna sem processar nada — por isso "309 pares encontrados" mas "0 consolidados".

Além disso, a mesma referência incorreta (`order` em vez de `stage_order`) existe no helper `getMaxStageOrder` e na ordenação dentro de `mergeContacts`, afetando também o merge de contatos.

### Correções

**Arquivo:** `supabase/functions/merge-duplicate-contacts/index.ts`

1. **`consolidateDeals` (linha 544):** Mudar `crm_stages(order)` para `crm_stages!crm_deals_stage_id_fkey(stage_order)` e atualizar referências de `.order` para `.stage_order`

2. **`getMaxStageOrder` (linha 42):** Mudar `d.crm_stages?.order` para `d.crm_stages?.stage_order`

3. **`mergeContacts` ordenação (linhas 261, 424):** Mudar `.order` para `.stage_order` nas referências de `crm_stages`

4. **Query principal `consolidate_only` (linhas 168-172):** Adicionar `.limit(10000)` para não ser limitada a 1000 rows

5. **Query `full_cleanup` (linhas 113-117):** Mesma correção de limite

### Impacto

Após deploy, o botão "Consolidar Deals" vai efetivamente deletar os 309+ deals duplicados, mantendo o mais avançado no funil e transferindo reuniões/atividades.

