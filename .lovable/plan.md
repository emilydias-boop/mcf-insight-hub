
# Plano: Incluir Reembolsos no Cálculo de Bruto

## Problema Identificado

A função `get_first_transaction_ids` (que identifica qual transação é a "primeira compra" de cada cliente/produto e deve ter o valor bruto contabilizado) está filtrando apenas transações com status `completed`.

**Código atual (linha 44):**
```sql
WHERE ht.sale_status = 'completed'
```

**Resultado:** 
- Transações reembolsadas (`refunded`) **nunca** são incluídas no conjunto de "primeiras compras"
- Por isso, o bruto delas aparece como R$ 0,00 (dup) na interface

## Dados Afetados

| Status | Transações "Primeira Compra" | Valor Bruto |
|--------|------------------------------|-------------|
| completed | 15.826 | R$ 18.201.498,57 |
| refunded | 1.570 | R$ 1.847.562,55 (não contabilizado atualmente) |

## Solução

Alterar a função RPC `get_first_transaction_ids` para incluir reembolsos na análise de primeira compra.

**Código corrigido:**
```sql
WHERE ht.sale_status IN ('completed', 'refunded')
```

## Lógica de Negócio

- Uma venda reembolsada ainda é considerada a "primeira compra" do cliente para aquele produto
- O valor bruto deve ser contabilizado normalmente, mesmo que depois tenha sido reembolsado
- Isso permite visualizar o impacto financeiro total, incluindo reembolsos

## Alteração Técnica

Criar uma migration SQL que atualiza a função `get_first_transaction_ids`:

```sql
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH parent_ids AS (
    SELECT DISTINCT SPLIT_PART(hubla_id, '-offer-', 1) as parent_id
    FROM hubla_transactions 
    WHERE hubla_id LIKE '%-offer-%'
  ),
  ranked_transactions AS (
    SELECT 
      ht.id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          LOWER(COALESCE(NULLIF(TRIM(ht.customer_email), ''), 'unknown')),
          CASE 
            WHEN UPPER(ht.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(ht.product_name) LIKE '%A005%' THEN 'A005'
            WHEN UPPER(ht.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(ht.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(ht.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(ht.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(ht.product_name) LIKE '%A000%' OR UPPER(ht.product_name) LIKE '%CONTRATO%' THEN 'A000'
            WHEN UPPER(ht.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
            ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
          END
        ORDER BY ht.sale_date ASC
      ) AS rn
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc 
      ON ht.product_name = pc.product_name 
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE 
      ht.sale_status IN ('completed', 'refunded')  -- ALTERADO: Incluir refunded
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual')
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;
```

## Resultado Esperado

Após a correção:
1. Transações reembolsadas que são "primeira compra" terão bruto contabilizado
2. O total bruto aumentará em aproximadamente R$ 1,8 milhão
3. A coluna "Tipo" mostrará "Novo" corretamente para reembolsos que são primeira compra
4. Consistência entre a listagem de vendas e os dashboards

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/migrations/[timestamp]_include_refunded_in_first_ids.sql` | Migration com a função atualizada |
