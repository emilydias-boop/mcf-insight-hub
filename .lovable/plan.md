
# Plano: Corrigir Filtro de Source na Função RPC

## Problema Identificado

A última migration removeu filtros críticos das funções RPC:

| Filtro | Antes (correto) | Agora (incorreto) |
|--------|-----------------|-------------------|
| Source | `ht.source IN ('hubla', 'manual')` | ❌ Sem filtro |
| Status | `ht.sale_status IN ('completed', 'refunded')` | ❌ Sem filtro |
| JOIN | `INNER JOIN product_configurations` | `LEFT JOIN` (retorna tudo) |

**Resultado**: Transações com source `hubla_make_sync` e `make` estão aparecendo indevidamente.

## Solução

Recriar as funções RPC com:
1. ✅ Filtro de source: `ht.source IN ('hubla', 'manual')`
2. ✅ Filtro de status: `ht.sale_status IN ('completed', 'refunded')`
3. ✅ INNER JOIN com product_configurations
4. ✅ Campo `hubla_id` no retorno (para agrupamento)

## Alteração Técnica

### Migration SQL Corretiva

```sql
-- Recriar get_all_hubla_transactions
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(...)
RETURNS TABLE(
  id uuid,
  hubla_id text,  -- Manter para agrupamento
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ...
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')  -- CRÍTICO: Filtrar sources
    AND ...
END;
$$;
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 4.316 transações (inclui hubla_make_sync) | Apenas hubla + manual |
| Fonte: hubla, hubla_make_sync, make | Fonte: hubla, manual |

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[timestamp]_fix_source_filter.sql` | Restaura filtros críticos de source e status |
