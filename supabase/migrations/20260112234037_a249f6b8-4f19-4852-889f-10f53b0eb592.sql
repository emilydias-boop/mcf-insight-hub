-- Atualizar RPC para deduplicar por source (hubla tem prioridade sobre make/hubla_make_sync)
CREATE OR REPLACE FUNCTION get_incorporador_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL,
  p_products TEXT[] DEFAULT NULL,
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
  raw_data JSONB,
  source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
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
      ht.source,
      -- Prioriza hubla > kiwify > outros, e dentro da mesma source pega o mais recente
      ROW_NUMBER() OVER (
        PARTITION BY 
          LOWER(COALESCE(ht.customer_email, '')),
          -- Normaliza produto para agrupar variantes (A001, A001 + Club, etc)
          CASE 
            WHEN UPPER(ht.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(ht.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(ht.product_name) LIKE '%A008%' THEN 'A008'
            WHEN UPPER(ht.product_name) LIKE '%A005%' OR UPPER(ht.product_name) LIKE '%P2%' THEN 'A005'
            WHEN UPPER(ht.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(ht.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(ht.product_name) LIKE '%A002%' THEN 'A002'
            WHEN UPPER(ht.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(ht.product_name) LIKE '%A000%' OR UPPER(ht.product_name) LIKE '%CONTRATO%' THEN 'A000'
            ELSE UPPER(LEFT(ht.product_name, 30))
          END
        ORDER BY 
          CASE ht.source 
            WHEN 'hubla' THEN 1 
            WHEN 'kiwify' THEN 2 
            ELSE 3 
          END,
          ht.sale_date DESC
      ) as rn
    FROM hubla_transactions ht
    WHERE ht.sale_status = 'completed'
      AND ht.sale_date >= COALESCE(p_start_date, '2020-01-01'::timestamp)
      AND ht.sale_date <= COALESCE(p_end_date, NOW())
      AND (
        p_search IS NULL 
        OR ht.customer_name ILIKE '%' || p_search || '%'
        OR ht.customer_email ILIKE '%' || p_search || '%'
        OR ht.product_name ILIKE '%' || p_search || '%'
      )
      AND (
        p_products IS NULL
        OR ht.product_name = ANY(p_products)
      )
  )
  SELECT 
    ranked.id,
    ranked.hubla_id,
    ranked.product_name,
    ranked.product_category,
    ranked.product_price,
    ranked.net_value,
    ranked.customer_name,
    ranked.customer_email,
    ranked.customer_phone,
    ranked.sale_date,
    ranked.sale_status,
    ranked.installment_number,
    ranked.total_installments,
    ranked.is_offer,
    ranked.count_in_dashboard,
    ranked.raw_data,
    ranked.source
  FROM ranked
  WHERE ranked.rn = 1
  ORDER BY ranked.sale_date DESC
  LIMIT p_limit;
END;
$$;