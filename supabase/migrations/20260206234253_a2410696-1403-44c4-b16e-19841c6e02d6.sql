-- Dropar função antiga e recriar com linked_attendee_id
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer, text[]);
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamp with time zone, timestamp with time zone, integer);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL::text, 
  p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, 
  p_limit integer DEFAULT 5000, 
  p_products text[] DEFAULT NULL::text[]
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
  gross_override numeric,
  linked_attendee_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    ht.gross_override,
    ht.linked_attendee_id
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name
  WHERE pc.target_bu = 'incorporador'
    AND pc.is_active = true
    AND pc.count_in_dashboard = true
    AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify', 'make')
    AND (ht.hubla_id IS NULL OR ht.hubla_id NOT LIKE 'newsale-%')
    AND (p_search IS NULL OR (
      ht.customer_name ILIKE '%' || p_search || '%' OR
      ht.customer_email ILIKE '%' || p_search || '%' OR
      ht.product_name ILIKE '%' || p_search || '%'
    ))
    AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
    AND (p_products IS NULL OR ht.product_name = ANY(p_products))
  ORDER BY ht.sale_date DESC
  LIMIT p_limit;
END;
$function$;