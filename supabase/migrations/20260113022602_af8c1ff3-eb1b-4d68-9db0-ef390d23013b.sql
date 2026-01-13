-- Fix the ambiguous column reference in get_all_hubla_transactions RPC
-- The installment_number column needs the twk. alias in the first_installments CTE

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 5000
)
RETURNS TABLE (
  id UUID,
  hubla_id TEXT,
  product_name TEXT,
  product_category TEXT,
  product_price NUMERIC,
  net_value NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sale_date TIMESTAMPTZ,
  sale_status TEXT,
  installment_number INT,
  total_installments INT,
  is_offer BOOLEAN,
  count_in_dashboard BOOLEAN,
  source TEXT,
  gross_winner BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_transactions AS (
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
      ht.is_offer,
      ht.count_in_dashboard,
      ht.source
    FROM hubla_transactions ht
    WHERE ht.source = 'hubla'
      AND NOT (ht.hubla_id LIKE 'newsale-%')
      -- Exclude parent transactions that have children (offers)
      AND NOT EXISTS (
        SELECT 1 FROM hubla_transactions child
        WHERE child.hubla_id LIKE ht.hubla_id || '-offer-%'
          AND child.source = 'hubla'
      )
      AND (p_search IS NULL OR (
        ht.customer_name ILIKE '%' || p_search || '%' OR
        ht.customer_email ILIKE '%' || p_search || '%' OR
        ht.product_name ILIKE '%' || p_search || '%'
      ))
      AND (p_start_date IS NULL OR ht.sale_date >= p_start_date)
      AND (p_end_date IS NULL OR ht.sale_date <= p_end_date)
  ),
  -- Create a normalized key for deduplication (email + normalized product name)
  transactions_with_key AS (
    SELECT 
      ft.*,
      LOWER(COALESCE(ft.customer_email, '')) || '::' || 
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(COALESCE(ft.product_name, '')),
          '\s*\(parcela\s*\d+/\d+\)\s*', '', 'gi'
        ),
        '\s+', ' ', 'g'
      ) AS dedup_key
    FROM filtered_transactions ft
  ),
  -- For each dedup_key, find the first occurrence (by id) to mark as gross_winner
  first_installments AS (
    SELECT DISTINCT ON (twk.dedup_key)
      twk.id AS winner_id
    FROM transactions_with_key twk
    WHERE COALESCE(twk.installment_number, 1) = 1
    ORDER BY twk.dedup_key, twk.id
  )
  SELECT 
    twk.id,
    twk.hubla_id,
    twk.product_name,
    twk.product_category,
    twk.product_price,
    twk.net_value,
    twk.customer_name,
    twk.customer_email,
    twk.customer_phone,
    twk.sale_date,
    twk.sale_status,
    twk.installment_number,
    twk.total_installments,
    twk.is_offer,
    twk.count_in_dashboard,
    twk.source,
    (fi.winner_id IS NOT NULL) AS gross_winner
  FROM transactions_with_key twk
  LEFT JOIN first_installments fi ON fi.winner_id = twk.id
  ORDER BY twk.sale_date DESC
  LIMIT p_limit;
END;
$$;