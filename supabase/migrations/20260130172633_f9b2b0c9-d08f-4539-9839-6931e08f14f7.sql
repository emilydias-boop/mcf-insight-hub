-- Fix: Excluir transações Make auxiliares que duplicam vendas Hubla
-- Produtos auxiliares: 'parceria', 'contrato', 'ob construir para alugar'

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
    -- Excluir transações Make auxiliares que duplicam vendas Hubla
    AND NOT (
      ht.source = 'make' 
      AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
    )
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