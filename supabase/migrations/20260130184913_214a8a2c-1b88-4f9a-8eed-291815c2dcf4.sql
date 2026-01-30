-- Recriar função get_all_hubla_transactions sem referência a child_offer_ids
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
  WHERE ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual', 'make')
    -- Excluir transações make duplicadas quando existe oficial
    AND NOT (
      ht.source = 'make' 
      AND EXISTS (
        SELECT 1 FROM hubla_transactions ht_official
        WHERE ht_official.source IN ('hubla', 'manual')
          AND ht_official.sale_status IN ('completed', 'refunded')
          AND LOWER(COALESCE(ht_official.customer_email, '')) = LOWER(COALESCE(ht.customer_email, ''))
          AND DATE(ht_official.sale_date AT TIME ZONE 'America/Sao_Paulo') = DATE(ht.sale_date AT TIME ZONE 'America/Sao_Paulo')
          AND (
            (UPPER(ht.product_name) LIKE '%A009%' AND UPPER(ht_official.product_name) LIKE '%A009%')
            OR (UPPER(ht.product_name) LIKE '%A001%' AND UPPER(ht_official.product_name) LIKE '%A001%')
            OR (UPPER(ht.product_name) LIKE '%A000%' AND UPPER(ht_official.product_name) LIKE '%A000%')
            OR (UPPER(ht.product_name) LIKE '%A002%' AND UPPER(ht_official.product_name) LIKE '%A002%')
            OR (UPPER(ht.product_name) LIKE '%A003%' AND UPPER(ht_official.product_name) LIKE '%A003%')
            OR (UPPER(ht.product_name) LIKE '%A004%' AND UPPER(ht_official.product_name) LIKE '%A004%')
            OR (UPPER(ht.product_name) LIKE '%A005%' AND UPPER(ht_official.product_name) LIKE '%A005%')
            OR (UPPER(ht.product_name) LIKE '%A006%' AND UPPER(ht_official.product_name) LIKE '%A006%')
            OR (UPPER(ht.product_name) LIKE '%A007%' AND UPPER(ht_official.product_name) LIKE '%A007%')
            OR (UPPER(ht.product_name) LIKE '%A008%' AND UPPER(ht_official.product_name) LIKE '%A008%')
            OR (UPPER(ht.product_name) LIKE '%A010%' AND UPPER(ht_official.product_name) LIKE '%A010%')
            OR (UPPER(ht.product_name) LIKE '%INCORPORADOR%' AND UPPER(ht_official.product_name) LIKE '%INCORPORADOR%')
            OR (UPPER(ht.product_name) LIKE '%THE CLUB%' AND UPPER(ht_official.product_name) LIKE '%THE CLUB%')
          )
      )
    )
    -- Filtros de busca
    AND (
      p_search IS NULL 
      OR LOWER(ht.customer_name) LIKE '%' || LOWER(p_search) || '%'
      OR LOWER(ht.customer_email) LIKE '%' || LOWER(p_search) || '%'
      OR LOWER(ht.product_name) LIKE '%' || LOWER(p_search) || '%'
    )
    -- Filtros de data
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;