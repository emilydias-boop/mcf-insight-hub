-- Atualiza get_first_transaction_ids para incluir transações reembolsadas
-- Isso garante que vendas reembolsadas que são "primeira compra" tenham bruto contabilizado

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
      ON ht.product_name = pc.product_name 
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE 
      ht.sale_status IN ('completed', 'refunded')
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual')
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;