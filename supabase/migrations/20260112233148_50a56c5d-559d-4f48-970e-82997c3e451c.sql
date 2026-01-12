-- Atualizar função get_incorporador_transactions para aceitar array de produtos
CREATE OR REPLACE FUNCTION get_incorporador_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_products TEXT[] DEFAULT NULL,
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND (p_products IS NULL OR ht.product_name = ANY(p_products))
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
$$;

-- Criar função para listar produtos distintos
CREATE OR REPLACE FUNCTION get_distinct_products()
RETURNS TABLE (product_name TEXT, transaction_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ht.product_name,
    COUNT(*) as transaction_count
  FROM hubla_transactions ht
  WHERE ht.sale_status = 'completed'
  GROUP BY ht.product_name
  ORDER BY ht.product_name;
$$;