-- Corrigir custos operacionais de Dezembro 2025
UPDATE operational_costs 
SET amount = 92650, updated_at = now() 
WHERE month = '2025-12-01' AND cost_type = 'team';

UPDATE operational_costs 
SET amount = 22900, updated_at = now() 
WHERE month = '2025-12-01' AND cost_type = 'office';