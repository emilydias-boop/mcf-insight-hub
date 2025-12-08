-- Corrigir transação OB Construir com valor errado (R$ 9.318 trilhões → R$ 93.18)
UPDATE hubla_transactions 
SET net_value = 93.18, product_price = 93.18
WHERE hubla_id = 'make_ob_construir_1765222700115_gustavor'
AND net_value > 1000000;