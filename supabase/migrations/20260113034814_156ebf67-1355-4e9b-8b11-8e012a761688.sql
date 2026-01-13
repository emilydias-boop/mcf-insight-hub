-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

-- Recreate with optimized fields (removes: customer_phone, hubla_id, is_offer, count_in_dashboard)
-- Also includes EXCLUDED_PRODUCTS filter in SQL for better performance
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
    t.gross_winner
  FROM hubla_transactions t
  WHERE 
    -- Include both hubla and manual sources
    t.source IN ('hubla', 'manual')
    -- Only completed sales
    AND t.sale_status = 'completed'
    -- Exclude newsale-% transactions (aggregates)
    AND (t.hubla_id IS NULL OR t.hubla_id NOT LIKE 'newsale-%')
    -- Exclude parent transactions (that have child -offer- transactions)
    AND NOT EXISTS (
      SELECT 1 FROM hubla_transactions child
      WHERE child.hubla_id LIKE t.hubla_id || '-offer-%'
    )
    -- Exclude specific products (moved from frontend for performance)
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
  ORDER BY t.sale_date DESC
  LIMIT p_limit;
END;
$$;