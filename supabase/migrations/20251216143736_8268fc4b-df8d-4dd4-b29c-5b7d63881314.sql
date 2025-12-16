-- Marcar NewSale com net_value=0 como não contável (são apenas notificações)
UPDATE hubla_transactions
SET count_in_dashboard = false
WHERE hubla_id LIKE 'newsale-%'
  AND (net_value = 0 OR net_value IS NULL);