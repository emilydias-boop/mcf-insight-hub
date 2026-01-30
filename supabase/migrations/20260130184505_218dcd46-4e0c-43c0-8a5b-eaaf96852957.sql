-- Excluir transações make duplicadas quando já existe transação hubla/manual para mesmo cliente/produto/data

DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);

CREATE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000
)
RETURNS TABLE(
  id text,
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
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id::text,
    ht.hubla_id::text,
    COALESCE(pc.display_name, ht.product_name)::text as product_name,
    pc.product_code::text as product_category,
    COALESCE(ht.gross_override, pc.reference_price, ht.product_price)::numeric as product_price,
    ht.net_value::numeric,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number::integer,
    ht.total_installments::integer,
    ht.source::text,
    ht.gross_override::numeric
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON LOWER(ht.product_name) = LOWER(pc.product_name)
  WHERE 
    ht.sale_status IN ('completed', 'refunded')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual', 'make')
    -- Excluir offers filhas (child_offer_ids)
    AND NOT EXISTS (
      SELECT 1 FROM product_configurations pc_parent
      WHERE pc_parent.child_offer_ids IS NOT NULL
        AND ht.hubla_id = ANY(pc_parent.child_offer_ids)
    )
    -- NOVO: Excluir transações make quando já existe transação oficial hubla/manual
    AND NOT (
      ht.source = 'make' 
      AND EXISTS (
        SELECT 1 FROM hubla_transactions ht_official
        INNER JOIN product_configurations pc_off 
          ON LOWER(ht_official.product_name) = LOWER(pc_off.product_name)
        WHERE ht_official.source IN ('hubla', 'manual')
          AND ht_official.sale_status IN ('completed', 'refunded')
          AND LOWER(ht_official.customer_email) = LOWER(ht.customer_email)
          AND DATE(ht_official.sale_date AT TIME ZONE 'America/Sao_Paulo') = DATE(ht.sale_date AT TIME ZONE 'America/Sao_Paulo')
          -- Mesmo produto normalizado (código do produto)
          AND (
            (UPPER(ht.product_name) LIKE '%A009%' AND UPPER(ht_official.product_name) LIKE '%A009%')
            OR (UPPER(ht.product_name) LIKE '%A005%' AND UPPER(ht_official.product_name) LIKE '%A005%')
            OR (UPPER(ht.product_name) LIKE '%A004%' AND UPPER(ht_official.product_name) LIKE '%A004%')
            OR (UPPER(ht.product_name) LIKE '%A003%' AND UPPER(ht_official.product_name) LIKE '%A003%')
            OR (UPPER(ht.product_name) LIKE '%A001%' AND UPPER(ht_official.product_name) LIKE '%A001%')
            OR (UPPER(ht.product_name) LIKE '%A010%' AND UPPER(ht_official.product_name) LIKE '%A010%')
            OR (UPPER(ht.product_name) LIKE '%A000%' AND UPPER(ht_official.product_name) LIKE '%A000%')
            OR (UPPER(ht.product_name) LIKE '%CONTRATO%' AND UPPER(ht_official.product_name) LIKE '%CONTRATO%')
            OR (UPPER(ht.product_name) LIKE '%PLANO CONSTRUTOR%' AND UPPER(ht_official.product_name) LIKE '%PLANO CONSTRUTOR%')
          )
      )
    )
    AND (p_search IS NULL OR 
         ht.customer_name ILIKE '%' || p_search || '%' OR 
         ht.customer_email ILIKE '%' || p_search || '%' OR
         ht.product_name ILIKE '%' || p_search || '%')
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;