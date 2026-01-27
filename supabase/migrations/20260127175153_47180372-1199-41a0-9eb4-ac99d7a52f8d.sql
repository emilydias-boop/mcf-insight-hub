-- ============================================
-- FIX: Remove ambiguous function signatures
-- Keep only TEXT signature for dates
-- ============================================

-- 1) Drop the timestamptz signatures that cause ambiguity
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer);
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, timestamptz, timestamptz, integer);

-- 2) Drop existing text signatures to recreate cleanly
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_hubla_transactions_by_bu(text, text, text, text, integer);

-- 3) Recreate get_all_hubla_transactions with TEXT signature
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  sale_date timestamptz,
  customer_name text,
  customer_email text,
  product_name text,
  gross_value numeric,
  net_value numeric,
  fee_value numeric,
  sale_status text,
  payment_method text,
  installment_number integer,
  total_installments integer,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.sale_date,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.product_name::text,
    ht.gross_value,
    ht.net_value,
    ht.fee_value,
    ht.sale_status::text,
    ht.payment_method::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.created_at
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- 4) Recreate get_hubla_transactions_by_bu with TEXT signature
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(
  p_bu text,
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id uuid,
  hubla_id text,
  sale_date timestamptz,
  customer_name text,
  customer_email text,
  product_name text,
  gross_value numeric,
  net_value numeric,
  fee_value numeric,
  sale_status text,
  payment_method text,
  installment_number integer,
  total_installments integer,
  source text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.sale_date,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.product_name::text,
    ht.gross_value,
    ht.net_value,
    ht.fee_value,
    ht.sale_status::text,
    ht.payment_method::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.created_at
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- 5) Grant permissions
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hubla_transactions_by_bu(text, text, text, text, integer) TO anon, authenticated;