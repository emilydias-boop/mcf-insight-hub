CREATE OR REPLACE FUNCTION get_incorporador_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  hubla_id TEXT,
  product_name TEXT,
  product_category TEXT,
  product_price NUMERIC,
  net_value NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sale_date TIMESTAMPTZ,
  sale_status TEXT,
  installment_number INTEGER,
  total_installments INTEGER,
  is_offer BOOLEAN,
  count_in_dashboard BOOLEAN,
  raw_data JSONB,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id,
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
    ht.is_offer,
    ht.count_in_dashboard,
    ht.raw_data,
    ht.source
  FROM hubla_transactions ht
  WHERE ht.sale_status = 'completed'
    AND (
      ht.product_name ILIKE '%A000%'
      OR ht.product_name ILIKE '%A001%'
      OR ht.product_name ILIKE '%A003%'
      OR ht.product_name ILIKE '%A004%'
      OR ht.product_name ILIKE '%A005%'
      OR ht.product_name ILIKE '%A006%'
      OR ht.product_name ILIKE '%A007%'
      OR ht.product_name ILIKE '%A008%'
      OR ht.product_name ILIKE '%A009%'
      OR ht.product_name ILIKE '%P2%'
      OR ht.product_name ILIKE '%Anticrise%'
      OR ht.product_name ILIKE '%50k%'
      OR ht.product_name ILIKE '%INCORPORADOR%'
    )
    AND NOT (
      ht.product_name ILIKE '%clube_arremate%'
      OR ht.product_name ILIKE '%efeito_alavanca%'
      OR ht.product_name ILIKE '%imersao%'
    )
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date < (p_end_date + INTERVAL '1 day'))
    AND (
      p_search IS NULL 
      OR ht.customer_name ILIKE '%' || p_search || '%'
      OR ht.customer_email ILIKE '%' || p_search || '%'
      OR ht.product_name ILIKE '%' || p_search || '%'
    )
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;