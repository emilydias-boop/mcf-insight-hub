-- Marcar transações Make como count_in_dashboard=false quando existe Hubla equivalente
-- Critério: mesmo email + mesma data + valor líquido similar (diferença < R$1)
UPDATE hubla_transactions make_tx
SET count_in_dashboard = false
WHERE make_tx.source = 'make'
  AND make_tx.count_in_dashboard = true
  AND EXISTS (
    SELECT 1 FROM hubla_transactions hubla_tx
    WHERE hubla_tx.source = 'hubla'
      AND hubla_tx.customer_email IS NOT NULL
      AND make_tx.customer_email IS NOT NULL
      AND LOWER(hubla_tx.customer_email) = LOWER(make_tx.customer_email)
      AND hubla_tx.sale_date::date = make_tx.sale_date::date
      AND ABS(COALESCE(hubla_tx.net_value, 0) - COALESCE(make_tx.net_value, 0)) < 1
  );