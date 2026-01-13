-- Recria a função para calcular gross_winner considerando TODA a base histórica,
-- e aplicar filtros de data apenas no SELECT final
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
  is_offer boolean,
  count_in_dashboard boolean,
  source text,
  gross_winner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- CTE 1: Buscar TODAS as transações da base (SEM filtro de data)
  all_transactions AS (
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
      AND ht.sale_status = 'completed'
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.hubla_id NOT LIKE 'parent-%'
  ),
  
  -- CTE 2: Criar chave de deduplicação (email + produto normalizado)
  transactions_with_key AS (
    SELECT 
      at.*,
      LOWER(COALESCE(at.customer_email, '')) || '|' || 
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            LOWER(COALESCE(at.product_name, '')),
            ' - parcela \d+/\d+', '', 'gi'
          ),
          ' \d+x r\$[\d.,]+', '', 'gi'
        ),
        ' - oferta.*$', '', 'gi'
      ) AS dedup_key
    FROM all_transactions at
  ),
  
  -- CTE 3: Determinar o winner_id considerando TODA a base histórica
  -- A transação mais antiga (menor id) de cada combinação email+produto
  first_installments AS (
    SELECT DISTINCT ON (twk.dedup_key) 
      twk.id AS winner_id
    FROM transactions_with_key twk
    WHERE COALESCE(twk.installment_number, 1) = 1
    ORDER BY twk.dedup_key, twk.id ASC
  )
  
  -- SELECT final: aplicar filtros de data, search e limit AQUI
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
  WHERE 
    -- Filtro de data aplicado apenas no resultado final
    (p_start_date IS NULL OR twk.sale_date >= p_start_date)
    AND (p_end_date IS NULL OR twk.sale_date <= p_end_date)
    -- Filtro de busca
    AND (
      p_search IS NULL 
      OR twk.customer_name ILIKE '%' || p_search || '%'
      OR twk.customer_email ILIKE '%' || p_search || '%'
      OR twk.product_name ILIKE '%' || p_search || '%'
    )
  ORDER BY twk.sale_date DESC
  LIMIT p_limit;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer) TO anon, authenticated;