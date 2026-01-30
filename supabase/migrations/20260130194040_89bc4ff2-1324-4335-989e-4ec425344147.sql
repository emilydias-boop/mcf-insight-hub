-- Corrigir função get_all_hubla_transactions para usar product_configurations
-- Em vez de filtrar por product_category, agora filtra por target_bu na tabela de configurações

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 5000
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
    -- Filtro dinâmico usando product_configurations
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