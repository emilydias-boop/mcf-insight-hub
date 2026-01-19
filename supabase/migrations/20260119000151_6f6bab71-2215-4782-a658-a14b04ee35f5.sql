-- Cria RPC para buscar transações filtradas por BU
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_target_bu TEXT,
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_winner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    ht.sale_date,
    ht.sale_status,
    ht.installment_number,
    ht.total_installments,
    ht.source,
    ht.gross_winner
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON (
    -- Match by product_code (exact match, case-insensitive)
    UPPER(TRIM(ht.product_name)) = UPPER(TRIM(pc.product_code))
    OR
    -- Match by product_name (contains, case-insensitive)
    LOWER(TRIM(ht.product_name)) LIKE '%' || LOWER(TRIM(pc.product_name)) || '%'
    OR
    LOWER(TRIM(pc.product_name)) LIKE '%' || LOWER(TRIM(ht.product_name)) || '%'
  )
  WHERE 
    -- Filtro por BU
    pc.target_bu = p_target_bu
    -- Filtro de busca
    AND (
      p_search IS NULL 
      OR LOWER(ht.customer_name) LIKE '%' || LOWER(p_search) || '%'
      OR LOWER(ht.customer_email) LIKE '%' || LOWER(p_search) || '%'
      OR LOWER(ht.product_name) LIKE '%' || LOWER(p_search) || '%'
    )
    -- Filtro de data inicial
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    -- Filtro de data final
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;