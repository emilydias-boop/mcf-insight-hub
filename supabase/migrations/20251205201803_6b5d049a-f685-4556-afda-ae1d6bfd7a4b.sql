-- Atualizar custo escritório para R$ 21.376/mês (R$ 5.344/semana × 4)
UPDATE operational_costs 
SET amount = 21376, updated_at = now()
WHERE cost_type = 'office' AND month = '2025-11-01';