-- Função para retornar a primeira transação de cada par cliente+produto
-- Usado para deduplicação de Bruto considerando histórico completo

CREATE OR REPLACE FUNCTION get_first_transaction_dates()
RETURNS TABLE (
  customer_email TEXT,
  product_key TEXT,
  first_sale_date TIMESTAMPTZ,
  first_transaction_id UUID
) 
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (
    LOWER(TRIM(ht.customer_email)),
    CASE 
      WHEN ht.product_name ILIKE '%A009%' THEN 'A009'
      WHEN ht.product_name ILIKE '%A005%' THEN 'A005'
      WHEN ht.product_name ILIKE '%A004%' THEN 'A004'
      WHEN ht.product_name ILIKE '%A003%' THEN 'A003'
      WHEN ht.product_name ILIKE '%A001%' THEN 'A001'
      WHEN ht.product_name ILIKE '%A010%' THEN 'A010'
      WHEN ht.product_name ILIKE '%A000%' OR ht.product_name ILIKE '%CONTRATO%' THEN 'A000'
      WHEN ht.product_name ILIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
      ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
    END
  )
    LOWER(TRIM(ht.customer_email)) as customer_email,
    CASE 
      WHEN ht.product_name ILIKE '%A009%' THEN 'A009'
      WHEN ht.product_name ILIKE '%A005%' THEN 'A005'
      WHEN ht.product_name ILIKE '%A004%' THEN 'A004'
      WHEN ht.product_name ILIKE '%A003%' THEN 'A003'
      WHEN ht.product_name ILIKE '%A001%' THEN 'A001'
      WHEN ht.product_name ILIKE '%A010%' THEN 'A010'
      WHEN ht.product_name ILIKE '%A000%' OR ht.product_name ILIKE '%CONTRATO%' THEN 'A000'
      WHEN ht.product_name ILIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
      ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
    END as product_key,
    ht.sale_date as first_sale_date,
    ht.id as first_transaction_id
  FROM hubla_transactions ht
  WHERE ht.customer_email IS NOT NULL 
    AND ht.customer_email != ''
  ORDER BY 
    LOWER(TRIM(ht.customer_email)),
    CASE 
      WHEN ht.product_name ILIKE '%A009%' THEN 'A009'
      WHEN ht.product_name ILIKE '%A005%' THEN 'A005'
      WHEN ht.product_name ILIKE '%A004%' THEN 'A004'
      WHEN ht.product_name ILIKE '%A003%' THEN 'A003'
      WHEN ht.product_name ILIKE '%A001%' THEN 'A001'
      WHEN ht.product_name ILIKE '%A010%' THEN 'A010'
      WHEN ht.product_name ILIKE '%A000%' OR ht.product_name ILIKE '%CONTRATO%' THEN 'A000'
      WHEN ht.product_name ILIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
      ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
    END,
    ht.sale_date ASC;
$$;