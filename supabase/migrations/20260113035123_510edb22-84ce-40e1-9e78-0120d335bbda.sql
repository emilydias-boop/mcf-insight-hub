-- Fix: Recalculate gross_winner inside the RPC since column doesn't exist
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  sale_date timestamp with time zone,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_winner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Normalize product key for deduplication
  normalized AS (
    SELECT 
      t.*,
      CASE 
        WHEN UPPER(t.product_name) LIKE '%A009%' THEN 'A009'
        WHEN UPPER(t.product_name) LIKE '%A005%' THEN 'A005'
        WHEN UPPER(t.product_name) LIKE '%A004%' THEN 'A004'
        WHEN UPPER(t.product_name) LIKE '%A003%' THEN 'A003'
        WHEN UPPER(t.product_name) LIKE '%A001%' THEN 'A001'
        WHEN UPPER(t.product_name) LIKE '%A010%' THEN 'A010'
        WHEN UPPER(t.product_name) LIKE '%A000%' OR UPPER(t.product_name) LIKE '%CONTRATO%' THEN 'A000'
        WHEN UPPER(t.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
        ELSE LEFT(UPPER(t.product_name), 40)
      END as product_key
    FROM hubla_transactions t
    WHERE 
      t.source IN ('hubla', 'manual')
      AND t.sale_status = 'completed'
      AND (t.hubla_id IS NULL OR t.hubla_id NOT LIKE 'newsale-%')
      AND NOT EXISTS (
        SELECT 1 FROM hubla_transactions child
        WHERE child.hubla_id LIKE t.hubla_id || '-offer-%'
      )
      AND LOWER(t.product_name) NOT LIKE ALL(ARRAY[
        '%efeito alavanca + assessoria%',
        '%construir para alugar%',
        '%a006 - renovação parceiro mcf%',
        '%mcf projetos%',
        '%sócio mcf%',
        '%viver de aluguel%',
        '%contrato - efeito alavanca%',
        '%como arrematar imóveis de leilão da caixa%',
        '%clube do arremate%'
      ])
  ),
  -- Find the oldest first-installment transaction per customer+product (from ALL data, not filtered)
  winners AS (
    SELECT DISTINCT ON (LOWER(n.customer_email), n.product_key)
      n.id as winner_id
    FROM normalized n
    WHERE n.installment_number = 1 OR n.installment_number IS NULL
    ORDER BY LOWER(n.customer_email), n.product_key, n.sale_date ASC
  )
  SELECT 
    n.id,
    n.product_name,
    n.product_category,
    n.product_price,
    n.net_value,
    n.customer_name,
    n.customer_email,
    n.sale_date,
    n.sale_status,
    n.installment_number,
    n.total_installments,
    n.source,
    (w.winner_id IS NOT NULL) as gross_winner
  FROM normalized n
  LEFT JOIN winners w ON w.winner_id = n.id
  WHERE 
    (p_search IS NULL 
      OR n.customer_name ILIKE '%' || p_search || '%'
      OR n.customer_email ILIKE '%' || p_search || '%'
      OR n.product_name ILIKE '%' || p_search || '%'
    )
    AND (p_start_date IS NULL OR n.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR n.sale_date <= p_end_date)
  ORDER BY n.sale_date DESC
  LIMIT p_limit;
END;
$$;