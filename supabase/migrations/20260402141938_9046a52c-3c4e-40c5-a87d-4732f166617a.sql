
-- 1. get_all_hubla_transactions
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(p_search text DEFAULT NULL::text, p_start_date text DEFAULT NULL::text, p_end_date text DEFAULT NULL::text, p_limit integer DEFAULT 5000, p_products text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, hubla_id text, product_name text, product_category text, product_price numeric, net_value numeric, customer_name text, customer_email text, customer_phone text, sale_date timestamp with time zone, sale_status text, installment_number integer, total_installments integer, source text, gross_override numeric, reference_price numeric, linked_attendee_id uuid, sale_origin text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ht.product_category::text,
    ht.product_price,
    ht.net_value,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.gross_override,
    pc.reference_price,
    ht.linked_attendee_id,
    ht.sale_origin::text
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')
    AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
    AND NOT (ht.source = 'make' AND LOWER(ht.product_name) IN ('contrato', 'ob construir para alugar'))
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND NOT (
      ht.source = 'make'
      AND LOWER(ht.product_name) = 'parceria'
      AND EXISTS (
        SELECT 1 FROM hubla_transactions ht2
        WHERE ht2.source IN ('hubla', 'kiwify', 'mcfpay')
          AND LOWER(ht2.customer_email) = LOWER(ht.customer_email)
          AND (ht2.sale_date AT TIME ZONE 'America/Sao_Paulo')::date = (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date
          AND ht2.sale_status IN ('completed', 'refunded')
      )
    )
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date::timestamptz)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date::timestamptz)
    AND (p_products IS NULL OR ht.product_name = ANY(p_products))
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$function$;

-- 2. get_hubla_transactions_by_bu
CREATE OR REPLACE FUNCTION public.get_hubla_transactions_by_bu(p_bu text, p_search text DEFAULT NULL::text, p_start_date text DEFAULT NULL::text, p_end_date text DEFAULT NULL::text, p_limit integer DEFAULT 5000)
 RETURNS TABLE(id uuid, hubla_id text, product_name text, product_category text, product_price numeric, net_value numeric, customer_name text, customer_email text, customer_phone text, sale_date timestamp with time zone, sale_status text, installment_number integer, total_installments integer, source text, gross_override numeric, reference_price numeric, linked_attendee_id uuid, sale_origin text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ht.id,
    ht.hubla_id::text,
    ht.product_name::text,
    ht.product_category::text,
    ht.product_price,
    ht.net_value,
    ht.customer_name::text,
    ht.customer_email::text,
    ht.customer_phone::text,
    ht.sale_date,
    ht.sale_status::text,
    ht.installment_number,
    ht.total_installments,
    ht.source::text,
    ht.gross_override,
    COALESCE(
      public.get_effective_price(pc.id, ht.sale_date),
      pc.reference_price
    ) as reference_price,
    ht.linked_attendee_id,
    ht.sale_origin::text
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc ON ht.product_name = pc.product_name
  WHERE pc.target_bu = p_bu
    AND ht.sale_status IN ('completed', 'refunded')
    AND ht.source IN ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')
    AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
    AND ht.hubla_id NOT ILIKE 'newsale-%'
    AND NOT (
      ht.source = 'make'
      AND LOWER(ht.product_name) = 'parceria'
      AND EXISTS (
        SELECT 1 FROM hubla_transactions ht2
        WHERE ht2.source IN ('hubla', 'kiwify', 'mcfpay')
          AND LOWER(ht2.customer_email) = LOWER(ht.customer_email)
          AND (ht2.sale_date AT TIME ZONE 'America/Sao_Paulo')::date = (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date
          AND ht2.sale_status IN ('completed', 'refunded')
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
$function$;

-- 3. get_first_transaction_ids
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
 RETURNS TABLE(id uuid)
 LANGUAGE plpgsql
 STABLE
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
        ORDER BY ht.sale_date ASC,
          CASE ht.source
            WHEN 'hubla' THEN 1
            WHEN 'manual' THEN 2
            ELSE 3
          END ASC
      ) AS rn
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc
      ON LOWER(ht.product_name) = LOWER(pc.product_name)
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE
      ht.sale_status IN ('completed', 'refunded')
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual', 'make')
      AND NOT (ht.source = 'make' AND ht.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)
      AND NOT (
        ht.source = 'make'
        AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
      )
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;
