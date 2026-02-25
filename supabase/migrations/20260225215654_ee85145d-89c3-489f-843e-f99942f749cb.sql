-- Correção de dados: ajustar effective_from dos registros A009 (19500 → 24500) para início do dia BRT
UPDATE product_price_history 
SET effective_from = '2026-02-25T00:00:00-03:00'
WHERE old_price = 19500 AND new_price = 24500 
  AND effective_from::date = '2026-02-25';