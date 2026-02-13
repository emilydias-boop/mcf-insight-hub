
-- Adicionar produto na configuracao
INSERT INTO product_configurations (product_name, product_code, product_category, target_bu, reference_price, count_in_dashboard, is_active)
VALUES ('A000 - Contrato MCF', 'A000', 'contrato', 'incorporador', 497, true, true);

-- Corrigir category das transacoes existentes
UPDATE hubla_transactions
SET product_category = 'contrato'
WHERE product_name = 'A000 - Contrato MCF'
  AND product_category = 'incorporador';
