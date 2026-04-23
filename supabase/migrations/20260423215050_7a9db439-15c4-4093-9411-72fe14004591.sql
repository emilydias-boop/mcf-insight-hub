CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL::text,
  p_start_date text DEFAULT NULL::text,
  p_end_date text DEFAULT NULL::text,
  p_limit integer DEFAULT 5000,
  p_products text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  id uuid, hubla_id text, product_name text, product_category text,
  product_price numeric, net_value numeric, customer_name text,
  customer_email text, customer_phone text, sale_date timestamp with time zone,
  sale_status text, installment_number integer, total_installments integer,
  source text, gross_override numeric, reference_price numeric,
  linked_attendee_id uuid, sale_origin text
)
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
    -- FIX: usar preço vigente na data da venda (igual get_hubla_transactions_by_bu)
    COALESCE(
      public.get_effective_price(pc.id, ht.sale_date),
      pc.reference_price
    ) as reference_price,
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