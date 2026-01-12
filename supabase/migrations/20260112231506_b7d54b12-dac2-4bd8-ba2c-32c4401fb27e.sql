-- Função RPC para buscar transações Incorporador sem limite de 1000 linhas
CREATE OR REPLACE FUNCTION get_incorporador_transactions(
  p_search TEXT DEFAULT NULL,
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
    -- Produtos Incorporador válidos (A000, A001, A003, A005, A008, A009)
    AND (
      ht.product_name ILIKE 'A000%' OR 
      ht.product_name ILIKE 'A001%' OR 
      ht.product_name ILIKE 'A003%' OR 
      ht.product_name ILIKE 'A005%' OR 
      ht.product_name ILIKE 'A008%' OR 
      ht.product_name ILIKE 'A009%'
    )
    -- Exclusões
    AND ht.product_name NOT ILIKE '%A006%'
    AND ht.product_name NOT ILIKE '%A010%'
    AND ht.product_name NOT ILIKE '%IMERSÃO SÓCIOS%'
    AND ht.product_name NOT ILIKE '%IMERSAO SOCIOS%'
    AND ht.product_name NOT ILIKE '%EFEITO ALAVANCA%'
    AND ht.product_name NOT ILIKE '%CLUBE DO ARREMATE%'
    AND ht.product_name NOT ILIKE '%CLUBE ARREMATE%'
    AND ht.product_name NOT ILIKE '%RENOVAÇÃO%'
    AND ht.product_name NOT ILIKE '%RENOVACAO%'
    -- Filtro de busca opcional
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