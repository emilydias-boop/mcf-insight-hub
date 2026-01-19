-- 1) Remover stages locais atuais do Inside Sales (IDs não batem com deals)
DELETE FROM local_pipeline_stages
WHERE origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

-- 2) Recriar stages locais usando o MESMO id das crm_stages (para casar com crm_deals.stage_id)
INSERT INTO local_pipeline_stages (id, name, color, stage_order, origin_id, is_active)
SELECT
  s.id,
  s.stage_name,
  s.color,
  s.stage_order,
  s.origin_id,
  s.is_active
FROM crm_stages s
WHERE s.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
  AND s.is_active = true
ORDER BY s.stage_order;