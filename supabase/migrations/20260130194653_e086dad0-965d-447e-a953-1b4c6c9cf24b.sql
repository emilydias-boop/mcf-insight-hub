-- ============================================================
-- CORREÇÃO: Eliminar ambiguidade de get_all_hubla_transactions
-- e usar product_configurations como fonte de verdade
-- ============================================================

-- 1) Dropar TODAS as versões existentes da função
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(timestamp with time zone, timestamp with time zone, text, integer);
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

-- 2) Recriar UMA única versão canônica
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamp with time zone DEFAULT NULL,
  p_end_date timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamp with time zone,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    ht.source,
    ht.gross_override
  FROM hubla_transactions ht
  WHERE ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    -- Filtro baseado em product_configurations (source of truth)
    AND EXISTS (
      SELECT 1 FROM product_configurations pc
      WHERE pc.target_bu = 'incorporador'
        AND pc.is_active = true
        AND ht.product_name = pc.product_name
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

-- 3) Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer) TO anon, authenticated;