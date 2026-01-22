-- Create RPC function to get the first transaction IDs per client+product (global)
-- This ignores date filters and considers the entire history

CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(first_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (
    LOWER(TRIM(COALESCE(customer_email, ''))),
    UPPER(
      CASE 
        WHEN product_name ILIKE '%A009%' THEN 'A009'
        WHEN product_name ILIKE '%A005%' THEN 'A005'
        WHEN product_name ILIKE '%A004%' THEN 'A004'
        WHEN product_name ILIKE '%A003%' THEN 'A003'
        WHEN product_name ILIKE '%A001%' THEN 'A001'
        WHEN product_name ILIKE '%A010%' THEN 'A010'
        WHEN product_name ILIKE '%A000%' OR product_name ILIKE '%CONTRATO%' THEN 'A000'
        WHEN product_name ILIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
        ELSE LEFT(UPPER(TRIM(COALESCE(product_name, ''))), 40)
      END
    )
  )
  ht.id
  FROM hubla_transactions ht
  WHERE product_category = 'incorporador'
  ORDER BY 
    LOWER(TRIM(COALESCE(customer_email, ''))),
    UPPER(
      CASE 
        WHEN product_name ILIKE '%A009%' THEN 'A009'
        WHEN product_name ILIKE '%A005%' THEN 'A005'
        WHEN product_name ILIKE '%A004%' THEN 'A004'
        WHEN product_name ILIKE '%A003%' THEN 'A003'
        WHEN product_name ILIKE '%A001%' THEN 'A001'
        WHEN product_name ILIKE '%A010%' THEN 'A010'
        WHEN product_name ILIKE '%A000%' OR product_name ILIKE '%CONTRATO%' THEN 'A000'
        WHEN product_name ILIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
        ELSE LEFT(UPPER(TRIM(COALESCE(product_name, ''))), 40)
      END
    ),
    sale_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;