
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      ht.sale_status = 'completed'
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
  WHERE rn = 1

  UNION

  SELECT ht2.id
  FROM hubla_transactions ht2
  INNER JOIN product_configurations pc2
    ON LOWER(ht2.product_name) = LOWER(pc2.product_name)
    AND pc2.target_bu = 'incorporador'
    AND pc2.is_active = true
  WHERE
    ht2.sale_status = 'refunded'
    AND ht2.hubla_id NOT LIKE 'newsale-%'
    AND ht2.source IN ('hubla', 'manual', 'make')
    AND NOT (ht2.source = 'make' AND ht2.sale_date >= '2026-04-01T00:00:00-03:00'::timestamptz)
    AND ht2.hubla_id NOT IN (SELECT DISTINCT SPLIT_PART(hubla_id, '-offer-', 1) FROM hubla_transactions WHERE hubla_id LIKE '%-offer-%')
    AND NOT (
      ht2.source = 'make'
      AND LOWER(ht2.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
    );
END;
$$;
