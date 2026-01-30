-- 1. Recriar função get_all_hubla_transactions com filtro de source expandido
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  hubla_id text,
  product_name text,
  product_category text,
  product_price numeric,
  net_value numeric,
  customer_name text,
  customer_email text,
  customer_phone text,
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND pc.is_active = true
    AND pc.count_in_dashboard = true
    AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify')
    AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- 2. Adicionar produtos faltantes do Asaas/Kiwify
INSERT INTO product_configurations (product_name, product_code, target_bu, reference_price, is_active, count_in_dashboard)
VALUES 
  ('A009 - Incorporador Completo + The Club', 'A009', 'incorporador', 19500, true, true),
  ('A001 - Incorporador Completo', 'A001', 'incorporador', 14500, true, true)
ON CONFLICT (product_name) DO NOTHING;