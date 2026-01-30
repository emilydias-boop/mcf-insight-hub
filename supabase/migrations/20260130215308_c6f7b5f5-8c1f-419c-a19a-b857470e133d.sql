CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 1000
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
  installment_number INT,
  total_installments INT,
  source TEXT,
  gross_override NUMERIC
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
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND pc.is_active = true
    AND pc.count_in_dashboard = true
    AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify', 'make')
    AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;