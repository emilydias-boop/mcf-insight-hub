-- Corrigir count_in_dashboard para transações hubla_make_sync
-- Estas transações precisam aparecer no dashboard
UPDATE hubla_transactions 
SET count_in_dashboard = true 
WHERE source = 'hubla_make_sync' 
  AND (count_in_dashboard IS NULL OR count_in_dashboard = false);