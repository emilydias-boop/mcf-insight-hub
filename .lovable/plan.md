
# Plano: Corrigir Referencia de Tabela nas Funcoes RPC

## Problema Identificado

As funcoes `get_all_hubla_transactions` e `get_hubla_transactions_by_bu` estao tentando fazer JOIN com a tabela `hubla_products`, que **nao existe**. A tabela correta e `product_configurations`.

| Funcao | Erro Atual | Correcao |
|--------|-----------|----------|
| `get_all_hubla_transactions` | `INNER JOIN hubla_products hp` | `INNER JOIN product_configurations pc` |
| `get_hubla_transactions_by_bu` | `INNER JOIN hubla_products hp` | `INNER JOIN product_configurations pc` |

## Estrutura da Tabela Correta

A tabela `product_configurations` possui:
- `product_name` (text) - para fazer o JOIN
- `target_bu` (text) - para filtrar por BU ('incorporador', 'consorcio', etc)

## Solucao

Criar uma migration SQL que recria ambas as funcoes usando a tabela `product_configurations` ao inves de `hubla_products`.

## Arquivo a Criar

| Arquivo | Tipo |
|---------|------|
| `supabase/migrations/XXXXXXXX_fix_rpc_table_reference.sql` | Criar |

## SQL da Migration

```sql
-- Recriar get_all_hubla_transactions com tabela correta
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
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
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.product_name,
    ht.product_category,
    ht.product_price,
    ht.net_value,
    ht.customer_name,
    ht.customer_email,
    ht.customer_phone,
    ht.sale_date,
    ht.sale_status,
    ht.installment_number,
    ht.total_installments,
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- Recriar get_hubla_transactions_by_bu com tabela correta
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_target_bu text,
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
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
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.product_name,
    ht.product_category,
    ht.product_price,
    ht.net_value,
    ht.customer_name,
    ht.customer_email,
    ht.customer_phone,
    ht.sale_date,
    ht.sale_status,
    ht.installment_number,
    ht.total_installments,
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_target_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

## Resultado Esperado

Apos a execucao:
1. As funcoes RPC farao JOIN com `product_configurations` (que existe)
2. Transacoes aparecerao na lista de vendas
3. Filtro por BU funcionara corretamente
4. Status `completed` e `refunded` serao incluidos

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| Nova migration SQL | Criar |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
