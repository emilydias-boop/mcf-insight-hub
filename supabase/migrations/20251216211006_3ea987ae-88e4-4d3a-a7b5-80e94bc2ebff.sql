
-- Corrigir Custo Escritório de dezembro/2025 para R$ 21.376
UPDATE operational_costs 
SET amount = 21376, updated_at = now()
WHERE month = '2025-12-01' AND cost_type = 'office';

-- Marcar contratos duplicados do Marcelo Luiz Maciel como não contar no dashboard
UPDATE hubla_transactions 
SET count_in_dashboard = false, updated_at = now()
WHERE id IN (
  'e49c139b-692b-4f92-9c0d-b018f37219ce',
  'b0f4082e-7115-42ab-b3cf-ff813a71fb91'
);
