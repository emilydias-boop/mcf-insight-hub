-- Atualizar product_name das transações Make de 'Contrato' para 'A000 - Contrato'
UPDATE hubla_transactions 
SET product_name = 'A000 - Contrato', updated_at = now()
WHERE source = 'make' AND product_name = 'Contrato';