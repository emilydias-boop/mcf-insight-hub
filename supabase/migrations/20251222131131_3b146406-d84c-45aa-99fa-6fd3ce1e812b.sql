-- Corrigir custo de Ads do dia 19/12/2025 (valor estava 10x maior)
UPDATE daily_costs 
SET amount = 9311.30, updated_at = NOW() 
WHERE date = '2025-12-19' 
  AND cost_type = 'ads' 
  AND amount = 93113;