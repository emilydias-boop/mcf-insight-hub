-- HOTFIX: Ultra-fast RPC to stop timeouts immediately
-- Removes expensive NOT EXISTS for offers and simplifies gross_winner to false temporarily
-- This allows transactions to appear NOW while we implement the proper solution

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
  -- Temporarily return true for installment 1 as gross_winner (simple heuristic)
  -- Will be replaced with proper pre-computed winners table
  (COALESCE(t.installment_number, 1) = 1) AS gross_winner
FROM hubla_transactions t
WHERE
  t.source IN ('hubla', 'manual')
  AND t.sale_status = 'completed'
  AND (t.hubla_id IS NULL OR t.hubla_id NOT LIKE 'newsale-%')
  -- Exclude banned products
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
  -- Search filter
  AND (
    p_search IS NULL
    OR t.customer_name ILIKE '%' || p_search || '%'
    OR t.customer_email ILIKE '%' || p_search || '%'
    OR t.product_name ILIKE '%' || p_search || '%'
  )
  -- Date filters
  AND (p_start_date IS NULL OR t.sale_date >= p_start_date)
  AND (p_end_date IS NULL OR t.sale_date <= p_end_date)
ORDER BY t.sale_date DESC NULLS LAST, t.id DESC
LIMIT p_limit;
$$;