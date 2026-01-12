CREATE OR REPLACE FUNCTION get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL,
  p_limit INT DEFAULT 5000
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
  sale_date TIMESTAMP WITH TIME ZONE,
  sale_status TEXT,
  installment_number INT,
  total_installments INT,
  is_offer BOOLEAN,
  count_in_dashboard BOOLEAN,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
    ht.source
  FROM hubla_transactions ht
  WHERE ht.sale_status = 'completed'
    AND ht.source = 'hubla'
    AND ht.sale_date >= COALESCE(p_start_date, '2020-01-01'::timestamp)
    AND ht.sale_date <= COALESCE(p_end_date, NOW())
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