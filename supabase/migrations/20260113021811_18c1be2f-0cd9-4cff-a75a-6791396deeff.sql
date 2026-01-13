
-- Drop função antiga para permitir alteração do retorno
DROP FUNCTION IF EXISTS get_all_hubla_transactions(TEXT, TIMESTAMP, TIMESTAMP, INT);

-- Recriar com novo campo gross_winner
CREATE OR REPLACE FUNCTION get_all_hubla_transactions(
  p_search TEXT DEFAULT NULL,
  p_start_date TIMESTAMP DEFAULT NULL,
  p_end_date TIMESTAMP DEFAULT NULL,
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
  sale_date TIMESTAMP WITH TIME ZONE,
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
  WITH 
  -- Universo base de transações válidas (sem filtro de data)
  base_transactions AS (
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
    WHERE ht.sale_status = 'completed'
      AND ht.source = 'hubla'
      AND ht.hubla_id NOT LIKE 'newsale-%'
      -- Excluir transações pai que têm filhos -offer-
      AND NOT EXISTS (
        SELECT 1 FROM hubla_transactions child 
        WHERE child.hubla_id LIKE ht.hubla_id || '-offer-%'
        AND child.source = 'hubla'
      )
  ),
  -- Normaliza product_name para chave de deduplicação
  transactions_with_key AS (
    SELECT 
      bt.*,
      LOWER(TRIM(COALESCE(bt.customer_email, ''))) as norm_email,
      CASE 
        WHEN UPPER(bt.product_name) LIKE '%A009%' THEN 'A009'
        WHEN UPPER(bt.product_name) LIKE '%A005%' THEN 'A005'
        WHEN UPPER(bt.product_name) LIKE '%A004%' THEN 'A004'
        WHEN UPPER(bt.product_name) LIKE '%A003%' THEN 'A003'
        WHEN UPPER(bt.product_name) LIKE '%A001%' THEN 'A001'
        WHEN UPPER(bt.product_name) LIKE '%A010%' THEN 'A010'
        WHEN UPPER(bt.product_name) LIKE '%A000%' OR UPPER(bt.product_name) LIKE '%CONTRATO%' THEN 'A000'
        WHEN UPPER(bt.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
        ELSE UPPER(LEFT(COALESCE(bt.product_name, 'UNKNOWN'), 40))
      END as product_key
    FROM base_transactions bt
  ),
  -- Apenas parcela 1 para determinar vencedor do bruto
  first_installments AS (
    SELECT *
    FROM transactions_with_key
    WHERE COALESCE(installment_number, 1) = 1
  ),
  -- Vencedor global: transação mais antiga por email+produto (considerando TODO o histórico)
  global_winners AS (
    SELECT DISTINCT ON (norm_email, product_key)
      fi.id as winner_id,
      fi.norm_email,
      fi.product_key
    FROM first_installments fi
    WHERE fi.norm_email != '' -- Ignora emails vazios
    ORDER BY fi.norm_email, fi.product_key, fi.sale_date ASC NULLS LAST, fi.id ASC
  )
  -- Query final com filtro de datas e flag gross_winner
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
    -- gross_winner = TRUE apenas se:
    -- 1. É parcela 1 (ou null)
    -- 2. É a transação mais antiga por email+produto no histórico inteiro
    (
      COALESCE(twk.installment_number, 1) = 1 
      AND gw.winner_id IS NOT NULL
    ) as gross_winner
  FROM transactions_with_key twk
  LEFT JOIN global_winners gw ON gw.winner_id = twk.id
  WHERE 
    -- Filtro de datas (aplicado apenas na query final)
    (twk.sale_date AT TIME ZONE 'America/Sao_Paulo')::date >= COALESCE(p_start_date::date, '2020-01-01'::date)
    AND (twk.sale_date AT TIME ZONE 'America/Sao_Paulo')::date <= COALESCE(p_end_date::date, CURRENT_DATE)
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
