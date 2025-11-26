-- Migração: Corrigir categorias de produtos e dados de vendas de cursos

-- 1. Atualizar categorias em hubla_transactions
-- Produtos A010 e "Construir para..." devem ser 'curso'
UPDATE hubla_transactions 
SET product_category = 'curso'
WHERE product_name ILIKE '%A010%' 
   OR product_name ILIKE '%Construir para%';

-- Produtos com "Contrato" ou código A000/000 devem ser 'contrato'
UPDATE hubla_transactions 
SET product_category = 'contrato'
WHERE product_name ILIKE '%Contrato%'
   OR product_code IN ('A000', '000');

-- 2. Limpar a010_sales de vendas incorretas (contratos que foram inseridos como A010)
-- Remover vendas onde o customer_name corresponde a transações de contrato
DELETE FROM a010_sales 
WHERE id IN (
  SELECT a.id 
  FROM a010_sales a
  JOIN hubla_transactions h ON a.customer_name = h.customer_name 
    AND DATE(h.sale_date) = a.sale_date
  WHERE h.product_category = 'contrato'
);

-- 3. Inserir vendas de cursos corretas em a010_sales
-- Usar ON CONFLICT para evitar duplicatas baseado em customer_name e sale_date
INSERT INTO a010_sales (sale_date, customer_name, customer_email, customer_phone, net_value, status)
SELECT 
  DATE(sale_date)::date as sale_date, 
  customer_name, 
  customer_email, 
  customer_phone, 
  product_price as net_value, 
  sale_status as status
FROM hubla_transactions
WHERE product_category = 'curso'
  AND sale_status = 'completed'
ON CONFLICT DO NOTHING;