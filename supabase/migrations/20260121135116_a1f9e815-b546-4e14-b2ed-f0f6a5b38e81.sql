-- Incluir produtos A010 na função RPC get_all_hubla_transactions
DROP FUNCTION IF EXISTS get_all_hubla_transactions(text, timestamptz, timestamptz, integer);

CREATE FUNCTION get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE (
  id UUID,
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
  source TEXT,
  gross_override NUMERIC
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
    ht.customer_phone,
    ht.sale_date,
    ht.sale_status,
    ht.installment_number,
    ht.total_installments,
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  WHERE 
    ht.sale_status = 'completed'
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND (
      ht.product_name ILIKE 'A000%' OR 
      ht.product_name ILIKE 'A001%' OR 
      ht.product_name ILIKE 'A003%' OR 
      ht.product_name ILIKE 'A004%' OR 
      ht.product_name ILIKE 'A005%' OR 
      ht.product_name ILIKE 'A008%' OR 
      ht.product_name ILIKE 'A009%' OR
      ht.product_name ILIKE 'A010%'
    )
    AND ht.product_name NOT ILIKE '%A006%'
    AND ht.product_name NOT ILIKE '%IMERSÃO SÓCIOS%'
    AND ht.product_name NOT ILIKE '%IMERSAO SOCIOS%'
    AND ht.product_name NOT ILIKE '%EFEITO ALAVANCA%'
    AND ht.product_name NOT ILIKE '%CLUBE DO ARREMATE%'
    AND ht.product_name NOT ILIKE '%CLUBE ARREMATE%'
    AND ht.product_name NOT ILIKE '%RENOVAÇÃO%'
    AND ht.product_name NOT ILIKE '%RENOVACAO%'
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
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