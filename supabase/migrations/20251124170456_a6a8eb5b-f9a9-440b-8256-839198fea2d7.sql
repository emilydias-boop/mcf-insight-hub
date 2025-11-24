-- Correção: Vincular "PIPELINE INSIDE SALES" ao grupo "Perpétuo - X1"
UPDATE crm_origins 
SET group_id = (SELECT id FROM crm_groups WHERE name = 'Perpétuo - X1' LIMIT 1),
    updated_at = NOW()
WHERE name = 'PIPELINE INSIDE SALES' 
  AND group_id IS NULL;