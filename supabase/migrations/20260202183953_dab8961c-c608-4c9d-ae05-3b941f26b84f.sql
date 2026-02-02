-- Espelhar stages de "Efeito Alavanca + Clube" para crm_stages (FK compatibility)
INSERT INTO crm_stages (id, clint_id, stage_name, color, origin_id, stage_order, is_active)
SELECT 
  id,
  'local-' || id::text as clint_id,
  name as stage_name,
  color,
  origin_id,
  stage_order,
  is_active
FROM local_pipeline_stages
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
ON CONFLICT (id) DO UPDATE SET
  stage_name = EXCLUDED.stage_name,
  color = EXCLUDED.color,
  stage_order = EXCLUDED.stage_order,
  is_active = EXCLUDED.is_active;

-- Corrigir o deal órfão criado via webhook
UPDATE crm_deals
SET stage_id = 'b5af7d28-7a0f-4da5-a115-094489fbc07d'
WHERE id = '907e22e8-d704-46c3-94b8-847000cec6d7'
  AND stage_id IS NULL;