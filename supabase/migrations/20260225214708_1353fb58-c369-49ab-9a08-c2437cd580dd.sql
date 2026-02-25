-- 1. Adicionar policy de UPDATE na product_price_history
CREATE POLICY "Authenticated users can update price history"
ON product_price_history FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Corrigir effective_from dos registros existentes do A001
UPDATE product_price_history 
SET effective_from = '2026-02-25T00:00:00-03:00'
WHERE new_price = 16500 AND old_price = 14500 
  AND effective_from::date = '2026-02-25';