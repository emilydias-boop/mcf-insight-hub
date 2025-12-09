-- Marcar transações de recorrência para não contar no Faturamento Bruto
-- Cláudio Ângelo Peruffo - parcela mensal A009 (não é primeira compra)
UPDATE hubla_transactions 
SET installment_number = 2
WHERE hubla_id = '64556969-4c3c-4c95-92c1-c826d38aedcd';

-- Elton Ferreira 08/12 - pagamento adicional do contrato (Hubla)
UPDATE hubla_transactions 
SET installment_number = 2
WHERE hubla_id = '175e2c5f-796a-40b4-b030-e2f7c1296cc5';

-- Elton Ferreira 08/12 - Make Parceria também é adicional
UPDATE hubla_transactions 
SET installment_number = 2
WHERE hubla_id = 'make_parceria_1765227205775_celton13ya';

-- Francislaine Carlos Rocha - já era cliente, não é primeira compra
UPDATE hubla_transactions 
SET installment_number = 2
WHERE hubla_id = 'd94e1a55-fa79-4c9f-ba46-1d43a1cfcfd4';