
-- 1. Garantir que Imersão tem target_bu e categoria corretos
UPDATE product_configurations
SET product_category = 'imersao', target_bu = 'consorcio', reference_price = 497, count_in_dashboard = true, is_active = true
WHERE product_name = 'Imersão: Do Zero ao Milhão na Construção';

-- 2. Corrigir categorias em product_configurations
UPDATE product_configurations
SET product_category = 'contrato'
WHERE product_name LIKE 'A000 - Contrato%' AND product_category = 'incorporador';

UPDATE product_configurations
SET product_category = 'ob_construir_alugar'
WHERE product_name = 'Construir Para Alugar' AND target_bu = 'consorcio';

-- 3. Corrigir categorias NULL em hubla_transactions
UPDATE hubla_transactions
SET product_category = 'incorporador'
WHERE product_name = 'A005 - MCF P2' AND product_category IS NULL;

UPDATE hubla_transactions
SET product_category = 'incorporador'
WHERE product_name = 'A009 - MCF INCORPORADOR + THE CLUB' AND product_category IS NULL;
