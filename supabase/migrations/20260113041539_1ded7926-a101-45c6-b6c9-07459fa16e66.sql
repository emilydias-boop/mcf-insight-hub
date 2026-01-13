-- Exclude parent transactions that are aggregates of -offer- transactions
-- Parent IDs are UUID prefixes found in -offer- hubla_ids

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
WITH parent_ids AS (
  -- Find parent IDs by extracting UUID prefix from -offer- hubla_ids
  SELECT DISTINCT SUBSTRING(hubla_id FROM '^([a-f0-9-]{36})-offer-') AS parent_hubla_id
  FROM hubla_transactions
  WHERE hubla_id LIKE '%-offer-%'
),
base_transactions AS (
  SELECT
    t.id,
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
    LOWER(TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(t.product_name, '\s*\(.*?\)\s*', '', 'g'),
      '\s+', ' ', 'g'
    ))) AS normalized_product
  FROM hubla_transactions t
  WHERE
    t.source IN ('hubla', 'manual')
    AND t.sale_status = 'completed'
    AND (t.hubla_id IS NULL OR t.hubla_id NOT LIKE 'newsale-%')
    -- Exclude parent transactions (their hubla_id matches a parent_hubla_id)
    AND NOT EXISTS (
      SELECT 1 FROM parent_ids p WHERE t.hubla_id = p.parent_hubla_id
    )
    AND NOT (LOWER(COALESCE(t.product_name, '')) LIKE ANY(ARRAY[
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
ranked_transactions AS (
  SELECT
    bt.*,
    CASE 
      WHEN COALESCE(bt.installment_number, 1) = 1 THEN
        ROW_NUMBER() OVER (
          PARTITION BY LOWER(TRIM(bt.customer_email)), bt.normalized_product
          ORDER BY bt.sale_date ASC NULLS LAST, bt.id ASC
        )
      ELSE NULL
    END AS rn
  FROM base_transactions bt
)
SELECT
  rt.id,
  rt.product_name,
  rt.product_category,
  rt.product_price,
  rt.net_value,
  rt.customer_name,
  rt.customer_email,
  rt.sale_date,
  rt.sale_status,
  rt.installment_number,
  rt.total_installments,
  rt.source,
  (rt.rn = 1) AS gross_winner
FROM ranked_transactions rt
WHERE
  (p_search IS NULL
    OR rt.customer_name ILIKE '%' || p_search || '%'
    OR rt.customer_email ILIKE '%' || p_search || '%'
    OR rt.product_name ILIKE '%' || p_search || '%'
  )
  AND (p_start_date IS NULL OR rt.sale_date >= p_start_date)
  AND (p_end_date IS NULL OR rt.sale_date <= p_end_date)
ORDER BY rt.sale_date DESC NULLS LAST, rt.id DESC
LIMIT p_limit;
$$;