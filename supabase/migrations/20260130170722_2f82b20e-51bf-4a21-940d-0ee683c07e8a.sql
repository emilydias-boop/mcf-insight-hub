-- Fix: Recriar get_all_hubla_transactions com schema correto
-- Inclui source 'make' e exclui newsale-% (transações parent)

DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

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
  INNER JOIN product_configurations pc ON LOWER(ht.product_name) = LOWER(pc.original_name)
  WHERE 
    ht.sale_status IN ('completed', 'refunded')
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual', 'make')
    AND NOT EXISTS (
      SELECT 1 FROM product_configurations pc_parent
      WHERE pc_parent.child_offer_ids IS NOT NULL
        AND ht.hubla_id = ANY(pc_parent.child_offer_ids)
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

-- Atualizar também get_first_transaction_ids para incluir source 'make'
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH parent_ids AS (
    SELECT DISTINCT SPLIT_PART(hubla_id, '-offer-', 1) as parent_id
    FROM hubla_transactions 
    WHERE hubla_id LIKE '%-offer-%'
  ),
  ranked_transactions AS (
    SELECT 
      ht.id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          LOWER(COALESCE(NULLIF(TRIM(ht.customer_email), ''), 'unknown')),
          CASE 
            WHEN UPPER(ht.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(ht.product_name) LIKE '%A005%' THEN 'A005'
            WHEN UPPER(ht.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(ht.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(ht.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(ht.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(ht.product_name) LIKE '%A000%' OR UPPER(ht.product_name) LIKE '%CONTRATO%' THEN 'A000'
            WHEN UPPER(ht.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
            ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
          END
        ORDER BY ht.sale_date ASC
      ) AS rn
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc 
      ON LOWER(ht.product_name) = LOWER(pc.original_name)
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE 
      ht.sale_status IN ('completed', 'refunded')
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual', 'make')
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, text, text, integer) TO anon, authenticated;