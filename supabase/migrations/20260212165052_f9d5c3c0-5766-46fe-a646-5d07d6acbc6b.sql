
-- =====================================================
-- 1. Corrigir dados existentes: marcar duplicatas Make
-- =====================================================
UPDATE hubla_transactions make_tx
SET count_in_dashboard = false
WHERE make_tx.source = 'make'
  AND make_tx.product_category = 'parceria'
  AND make_tx.count_in_dashboard = true
  AND EXISTS (
    SELECT 1 FROM hubla_transactions hubla_tx
    WHERE hubla_tx.source = 'hubla'
      AND LOWER(hubla_tx.customer_email) = LOWER(make_tx.customer_email)
      AND hubla_tx.sale_date::date = make_tx.sale_date::date
      AND hubla_tx.product_price BETWEEN make_tx.product_price * 0.95
                                     AND make_tx.product_price * 1.05
      AND hubla_tx.net_value > 0
  );

-- =====================================================
-- 2. Atualizar RPC com deduplicação NOT EXISTS
-- =====================================================
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, text, text, integer, text[]);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search text DEFAULT NULL,
  p_start_date text DEFAULT NULL,
  p_end_date text DEFAULT NULL,
  p_limit integer DEFAULT 5000,
  p_products text[] DEFAULT NULL
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
  sale_date timestamptz,
  sale_status text,
  installment_number integer,
  total_installments integer,
  source text,
  gross_override numeric,
  reference_price numeric,
  linked_attendee_id uuid,
  sale_origin text
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
    AND ht.source IN ('hubla', 'manual', 'make')
    AND NOT (ht.source = 'make' AND LOWER(ht.product_name) IN ('contrato', 'ob construir para alugar'))
    AND ht.hubla_id NOT LIKE 'newsale-%'
    -- === DEDUPLICAÇÃO: Excluir transações Make quando existe Hubla equivalente ===
    AND NOT (
      ht.source = 'make'
      AND ht.product_category = 'parceria'
      AND EXISTS (
        SELECT 1 FROM hubla_transactions h2
        WHERE h2.source = 'hubla'
          AND LOWER(h2.customer_email) = LOWER(ht.customer_email)
          AND h2.sale_date::date = ht.sale_date::date
          AND h2.product_price BETWEEN ht.product_price * 0.95 AND ht.product_price * 1.05
          AND h2.net_value > 0
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
$$;
