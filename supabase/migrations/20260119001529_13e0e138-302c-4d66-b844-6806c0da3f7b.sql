DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);

CREATE FUNCTION public.get_hubla_transactions_by_bu(
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
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    ht.source
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON (
      ht.product_code = pc.product_code 
      OR ht.product_name = pc.product_name
    )
  WHERE pc.target_bu = p_target_bu
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' 
      OR ht.customer_email ILIKE '%' || p_search || '%'
      OR ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;