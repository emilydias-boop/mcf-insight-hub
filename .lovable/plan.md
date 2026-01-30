

# Plano de Correção - Erro "column pc_parent.child_offer_ids does not exist"

## Diagnóstico

A migration anterior incluiu uma cláusula `NOT EXISTS` que referencia uma coluna **inexistente** na tabela `product_configurations`:

```sql
-- Esta parte do código está errada:
AND NOT EXISTS (
  SELECT 1 FROM product_configurations pc_parent
  WHERE pc_parent.child_offer_ids IS NOT NULL  -- ❌ COLUNA NÃO EXISTE
    AND ht.hubla_id = ANY(pc_parent.child_offer_ids)
)
```

### Schema Real da Tabela `product_configurations`:
A tabela **não possui** a coluna `child_offer_ids`. Ela contém apenas:
- `id`, `product_name`, `product_code`, `display_name`
- `product_category`, `target_bu`, `reference_price`
- `is_active`, `count_in_dashboard`, `notes`
- `created_at`, `updated_at`

---

## Solução

Criar uma nova migration para remover a cláusula `NOT EXISTS` que está causando o erro:

### Alteração na Função `get_all_hubla_transactions`:

```sql
-- REMOVER esta parte inteira:
AND NOT EXISTS (
  SELECT 1 FROM product_configurations pc_parent
  WHERE pc_parent.child_offer_ids IS NOT NULL
    AND ht.hubla_id = ANY(pc_parent.child_offer_ids)
)
```

A exclusão de transações "parent" já está sendo feita pela cláusula `AND ht.hubla_id NOT LIKE 'newsale-%'`, então a verificação adicional com `child_offer_ids` não é necessária.

---

## SQL da Correção

```sql
-- Fix: Remover referência a pc_parent.child_offer_ids (coluna inexistente)

DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);

CREATE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id text,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamp with time zone,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id::text,
    ht.hubla_id::text,
    COALESCE(pc.display_name, ht.product_name)::text as product_name,
    pc.product_code::text as product_category,
    COALESCE(ht.gross_override, pc.reference_price, ht.product_price)::numeric as product_price,
    ht.net_value::numeric,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number::integer,
    ht.total_installments::integer,
    ht.source::text,
    ht.gross_override::numeric
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON LOWER(ht.product_name) = LOWER(pc.product_name)
  WHERE 
    ht.sale_status IN ('completed', 'refunded')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual', 'make')
    -- NOT EXISTS removido (child_offer_ids não existe)
    AND (p_search IS NULL OR 
         ht.customer_name ILIKE '%' || p_search || '%' OR 
         ht.customer_email ILIKE '%' || p_search || '%' OR
         ht.product_name ILIKE '%' || p_search || '%')
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;
```

---

## Resumo das Correções Feitas

| Migration | Erro Corrigido |
|-----------|----------------|
| 1ª | `ht.gross_value` → `ht.product_price` (calculado) |
| 2ª | `pc.original_name` → `pc.product_name` |
| 3ª (esta) | Remover `pc_parent.child_offer_ids` (coluna inexistente) |

---

## Resultado Esperado

1. Erro "column pc_parent.child_offer_ids does not exist" corrigido
2. Transações carregam normalmente na página de vendas
3. Exclusão de duplicatas mantida via `NOT LIKE 'newsale-%'`
4. Source `make` incluído conforme planejado

