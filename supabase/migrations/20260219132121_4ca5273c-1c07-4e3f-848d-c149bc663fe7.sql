-- 1. Deletar registros NewSale duplicados do A010 (quando já existe invoice.payment_succeeded)
DELETE FROM hubla_transactions
WHERE id IN (
  SELECT t1.id
  FROM hubla_transactions t1
  WHERE t1.event_type = 'NewSale'
    AND t1.product_category = 'a010'
    AND EXISTS (
      SELECT 1 FROM hubla_transactions t2
      WHERE t2.event_type = 'invoice.payment_succeeded'
        AND t2.product_category = 'a010'
        AND LOWER(t2.customer_email) = LOWER(t1.customer_email)
        AND t2.sale_date::date = t1.sale_date::date
        AND t2.product_name = t1.product_name
        AND t2.sale_status = t1.sale_status
    )
);

-- 2. Atualizar RPC get_incorporador_transactions para excluir offers do A010
-- e prevenir duplicatas NewSale vs invoice.payment_succeeded
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
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
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
      ht.event_type
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
    WHERE pc.target_bu = 'incorporador'
      AND ht.sale_status = 'completed'
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
  ),
  ranked AS (
    SELECT 
      b.*,
      -- Deduplicar: prioriza hubla > kiwify > outros, e invoice > NewSale
      ROW_NUMBER() OVER (
        PARTITION BY 
          LOWER(COALESCE(b.customer_email, '')),
          CASE 
            WHEN UPPER(b.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(b.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(b.product_name) LIKE '%A008%' THEN 'A008'
            WHEN UPPER(b.product_name) LIKE '%A005%' OR UPPER(b.product_name) LIKE '%P2%' THEN 'A005'
            WHEN UPPER(b.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(b.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(b.product_name) LIKE '%A002%' THEN 'A002'
            WHEN UPPER(b.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(b.product_name) LIKE '%A000%' OR UPPER(b.product_name) LIKE '%CONTRATO%' THEN 'A000'
            ELSE UPPER(LEFT(b.product_name, 30))
          END,
          -- Incluir is_offer na partição para não deduplicar offers com mains
          COALESCE(b.is_offer, false)
        ORDER BY 
          CASE b.source 
            WHEN 'hubla' THEN 1 
            WHEN 'kiwify' THEN 2 
            ELSE 3 
          END,
          CASE b.event_type
            WHEN 'invoice.payment_succeeded' THEN 1
            WHEN 'NewSale' THEN 2
            ELSE 3
          END,
          b.sale_date DESC
      ) as rn
    FROM base b
    -- Excluir offers do A010 (são order bumps capturados em produtos separados)
    WHERE NOT (b.product_category = 'a010' AND COALESCE(b.is_offer, false) = true)
      AND NOT (b.product_category = 'a010' AND b.hubla_id LIKE '%-offer-%')
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
