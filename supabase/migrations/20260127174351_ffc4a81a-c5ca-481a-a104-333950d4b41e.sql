-- Corrigir funções RPC: restaurar filtros de source e status
-- CRÍTICO: Apenas source IN ('hubla', 'manual') deve aparecer

-- 1. Recriar get_all_hubla_transactions com filtros corretos
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
    ht.product_price::numeric,
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
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
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

-- 2. Recriar get_hubla_transactions_by_bu com filtros corretos
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_bu text,
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
    ht.product_price::numeric,
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
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
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

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hubla_transactions_by_bu(text, text, text, text, integer) TO anon, authenticated;