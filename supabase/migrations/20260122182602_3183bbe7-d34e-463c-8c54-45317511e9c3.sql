-- Atualizar RPC get_all_hubla_transactions para excluir transações parent (containers de offers)
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
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name 
    AND pc.target_bu = 'incorporador'
    AND pc.is_active = true
  WHERE 
    ht.sale_status = 'completed'
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual')
    -- Excluir parents que têm ofertas filhas (evita duplicação)
    AND NOT EXISTS (
      SELECT 1 FROM hubla_transactions child 
      WHERE child.hubla_id LIKE ht.hubla_id || '-offer-%'
    )
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

-- Atualizar RPC get_hubla_transactions_by_bu para excluir transações parent
DROP FUNCTION IF EXISTS get_hubla_transactions_by_bu(text, text, timestamptz, timestamptz, integer);

CREATE FUNCTION get_hubla_transactions_by_bu(
  p_target_bu TEXT,
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
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name 
    AND pc.target_bu = p_target_bu
    AND pc.is_active = true
  WHERE 
    ht.sale_status = 'completed'
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual')
    -- Excluir parents que têm ofertas filhas (evita duplicação)
    AND NOT EXISTS (
      SELECT 1 FROM hubla_transactions child 
      WHERE child.hubla_id LIKE ht.hubla_id || '-offer-%'
    )
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