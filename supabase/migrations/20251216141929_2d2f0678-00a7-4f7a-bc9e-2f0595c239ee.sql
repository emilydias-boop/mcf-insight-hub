-- 1. Marcar transações do Make que são duplicatas do Hubla (mesmo email, mesma data, valor similar)
UPDATE hubla_transactions make_tx
SET count_in_dashboard = false, updated_at = NOW()
WHERE make_tx.source = 'make'
  AND make_tx.count_in_dashboard = true
  AND EXISTS (
    SELECT 1 FROM hubla_transactions hubla_tx
    WHERE hubla_tx.source = 'hubla'
      AND LOWER(TRIM(hubla_tx.customer_email)) = LOWER(TRIM(make_tx.customer_email))
      AND DATE(hubla_tx.sale_date AT TIME ZONE 'America/Sao_Paulo') = DATE(make_tx.sale_date AT TIME ZONE 'America/Sao_Paulo')
      AND ABS(COALESCE(hubla_tx.net_value, 0) - COALESCE(make_tx.net_value, 0)) < 50
  );

-- 2. Marcar P2/A005 como não contável (é cobrança recorrente de parceria, não nova venda)
UPDATE hubla_transactions
SET count_in_dashboard = false, updated_at = NOW()
WHERE count_in_dashboard = true
  AND (
    product_name ILIKE '%P2%'
    OR product_name ILIKE '%A005%'
    OR product_category = 'p2'
  );