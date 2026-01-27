

# Plano: Corrigir Colunas Inexistentes nas Funções RPC

## Problema Identificado

A última migration criou funções RPC que referenciam colunas inexistentes:

| Coluna na Função | Status | Coluna Correta |
|------------------|--------|----------------|
| `ht.gross_value` | ❌ Não existe | Usar `ht.product_price` |
| `ht.fee_value` | ❌ Não existe | Remover (calcular no frontend) |

## Colunas que EXISTEM na tabela `hubla_transactions`

```text
id, hubla_id, product_name, product_category, product_price, 
net_value, customer_name, customer_email, customer_phone, 
sale_date, sale_status, installment_number, total_installments, 
source, gross_override, is_offer, payment_method, created_at, updated_at
```

## Campos que o Frontend Espera (interface HublaTransaction)

```text
id, hubla_id, product_name, product_category, product_price, 
net_value, customer_name, customer_email, customer_phone, 
sale_date, sale_status, installment_number, total_installments, 
source, gross_override
```

## Solução

Recriar as funções RPC com os campos corretos que existem na tabela e são esperados pelo frontend.

## Alteração Técnica

### Migration SQL Corretiva

```sql
-- Dropar funções atuais com schema incorreto
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, text, text, integer);

-- Recriar get_all_hubla_transactions com campos corretos
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamptz,
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
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ht.product_category::text,
    ht.product_price,
    ht.net_value,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.gross_override
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND (p_search IS NULL OR (...))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;
```

## Mapeamento de Campos

| RETURNS TABLE | SELECT | Origem |
|---------------|--------|--------|
| `id uuid` | `ht.id` | Tabela |
| `hubla_id text` | `ht.hubla_id::text` | Tabela |
| `product_name text` | `ht.product_name::text` | Tabela |
| `product_category text` | `ht.product_category::text` | Tabela |
| `product_price numeric` | `ht.product_price` | Tabela |
| `net_value numeric` | `ht.net_value` | Tabela |
| `customer_name text` | `ht.customer_name::text` | Tabela |
| `customer_email text` | `ht.customer_email::text` | Tabela |
| `customer_phone text` | `ht.customer_phone::text` | Tabela |
| `sale_date timestamptz` | `ht.sale_date` | Tabela |
| `sale_status text` | `ht.sale_status::text` | Tabela |
| `installment_number integer` | `ht.installment_number` | Tabela |
| `total_installments integer` | `ht.total_installments` | Tabela |
| `source text` | `ht.source::text` | Tabela |
| `gross_override numeric` | `ht.gross_override` | Tabela |

## Filtros Mantidos

| Filtro | SQL |
|--------|-----|
| Source | `ht.source IN ('hubla', 'manual')` |
| Status | `ht.sale_status IN ('completed', 'refunded')` |
| BU | `INNER JOIN product_configurations` + `pc.target_bu = 'incorporador'` |

## Resultado Esperado

Após a correção:
- A página `/bu-incorporador/transacoes` exibirá as transações normalmente
- Os campos retornados são compatíveis com a interface `HublaTransaction` do frontend
- Os filtros de source e status continuam aplicados
- O agrupamento por `hubla_id` para parent/order bumps continua funcionando

## Arquivos a Modificar

| Tipo | Arquivo | Alteração |
|------|---------|-----------|
| Migration | `supabase/migrations/[timestamp]_fix_column_names.sql` | Recriar funções com campos corretos |

