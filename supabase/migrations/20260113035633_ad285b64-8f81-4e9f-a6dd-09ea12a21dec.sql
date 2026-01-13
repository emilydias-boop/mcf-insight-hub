-- Performance fix: rewrite get_all_hubla_transactions as SQL and compute gross_winner using product_code (fast)
-- Avoid statement timeouts caused by heavy full-row CTE scans

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH all_time AS (
  SELECT
    t.id,
    t.hubla_id,
    t.product_name,
    t.product_category,
    t.product_price,
    t.net_value,
    t.customer_name,
    t.customer_email,
    t.sale_date,
    t.sale_status,
    t.installment_number,
    t.total_installments,
    t.source,
    COALESCE(NULLIF(t.product_code, ''),
      CASE
        WHEN UPPER(t.product_name) LIKE '%A009%' THEN 'A009'
        WHEN UPPER(t.product_name) LIKE '%A005%' THEN 'A005'
        WHEN UPPER(t.product_name) LIKE '%A004%' THEN 'A004'
        WHEN UPPER(t.product_name) LIKE '%A003%' THEN 'A003'
        WHEN UPPER(t.product_name) LIKE '%A001%' THEN 'A001'
        WHEN UPPER(t.product_name) LIKE '%A010%' THEN 'A010'
        WHEN UPPER(t.product_name) LIKE '%A000%' OR UPPER(t.product_name) LIKE '%CONTRATO%' THEN 'A000'
        WHEN UPPER(t.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
        ELSE LEFT(UPPER(COALESCE(t.product_name,'')), 40)
      END
    ) AS product_key
  FROM hubla_transactions t
  WHERE
    t.source IN ('hubla','manual')
    AND t.sale_status = 'completed'
    AND (t.hubla_id IS NULL OR t.hubla_id NOT LIKE 'newsale-%')
    AND NOT EXISTS (
      SELECT 1 FROM hubla_transactions child
      WHERE child.hubla_id LIKE t.hubla_id || '-offer-%'
    )
    AND NOT (LOWER(COALESCE(t.product_name,'')) LIKE ANY(ARRAY[
      '%efeito alavanca + assessoria%',
      '%construir para alugar%',
      '%a006 - renovação parceiro mcf%',
      '%mcf projetos%',
      '%sócio mcf%',
      '%viver de aluguel%',
      '%contrato - efeito alavanca%',
      '%como arrematar imóveis de leilão da caixa%',
      '%clube do arremate%'
    ]))
),
-- pick winner across ALL TIME (ignores date filters) for first installment
winners AS (
  SELECT DISTINCT ON (LOWER(a.customer_email), a.product_key)
    a.id AS winner_id
  FROM all_time a
  WHERE a.customer_email IS NOT NULL
    AND COALESCE(a.installment_number, 1) = 1
  ORDER BY LOWER(a.customer_email), a.product_key, a.sale_date ASC NULLS LAST, a.id ASC
),
filtered AS (
  SELECT a.*
  FROM all_time a
  WHERE
    (p_search IS NULL
      OR a.customer_name ILIKE '%' || p_search || '%'
      OR a.customer_email ILIKE '%' || p_search || '%'
      OR a.product_name ILIKE '%' || p_search || '%'
    )
    AND (p_start_date IS NULL OR a.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR a.sale_date <= p_end_date)
)
SELECT
  f.id,
  f.product_name,
  f.product_category,
  f.product_price,
  f.net_value,
  f.customer_name,
  f.customer_email,
  f.sale_date,
  f.sale_status,
  f.installment_number,
  f.total_installments,
  f.source,
  (w.winner_id IS NOT NULL) AS gross_winner
FROM filtered f
LEFT JOIN winners w ON w.winner_id = f.id
ORDER BY f.sale_date DESC NULLS LAST, f.id DESC
LIMIT p_limit;
$$;

-- Helpful indexes to avoid timeouts
CREATE INDEX IF NOT EXISTS hubla_transactions_completed_email_code_date_idx
ON public.hubla_transactions (sale_status, lower(customer_email), product_code, sale_date)
WHERE sale_status = 'completed';

CREATE INDEX IF NOT EXISTS hubla_transactions_completed_source_date_idx
ON public.hubla_transactions (sale_status, source, sale_date)
WHERE sale_status = 'completed';
