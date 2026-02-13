
-- Sincronizar product_category em hubla_transactions para A000 - Contrato
UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name LIKE 'A000 - Contrato%'
  AND (product_category IS NULL OR product_category != 'contrato');

UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name = '000 - Contrato'
  AND (product_category IS NULL OR product_category != 'contrato');
