-- Drop da função existente para recriar com novo retorno
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer);

-- Recria a função para incluir gross_winner calculado
CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 5000
)
RETURNS TABLE (
  id UUID,
  product_name TEXT,
  product_category TEXT,
  product_price NUMERIC,
  net_value NUMERIC,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  sale_date TIMESTAMPTZ,
  sale_status TEXT,
  installment_number INTEGER,
  total_installments INTEGER,
  source TEXT,
  gross_override NUMERIC,
  gross_winner BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH first_transactions AS (
    -- Identifica a primeira transação de cada cliente+produto (considerando TODO o histórico)
    -- Se não tem email, usa o próprio ID como chave única (conta como venda única)
    SELECT DISTINCT ON (
      LOWER(COALESCE(NULLIF(TRIM(ht2.customer_email), ''), ht2.id::TEXT)),
      pc2.normalized_key
    )
      ht2.id AS first_id
    FROM hubla_transactions ht2
    INNER JOIN product_configurations pc2 
      ON ht2.product_name = pc2.product_name 
      AND pc2.target_bu = 'incorporador'
      AND pc2.is_active = true
    WHERE 
      ht2.sale_status = 'completed'
      AND ht2.hubla_id NOT LIKE 'newsale-%'
      AND ht2.source IN ('hubla', 'manual')
    ORDER BY 
      LOWER(COALESCE(NULLIF(TRIM(ht2.customer_email), ''), ht2.id::TEXT)),
      pc2.normalized_key,
      ht2.sale_date ASC
  )
  SELECT 
    ht.id,
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
    -- gross_winner: true se é primeira transação do grupo E parcela 1 (ou sem parcela)
    (
      ft.first_id IS NOT NULL 
      AND (ht.installment_number IS NULL OR ht.installment_number <= 1)
    ) AS gross_winner
  FROM hubla_transactions ht
  INNER JOIN product_configurations pc 
    ON ht.product_name = pc.product_name 
    AND pc.target_bu = 'incorporador'
    AND pc.is_active = true
  LEFT JOIN first_transactions ft ON ft.first_id = ht.id
  WHERE 
    ht.sale_status = 'completed'
    AND ht.hubla_id NOT LIKE 'newsale-%'
    AND ht.source IN ('hubla', 'manual')
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