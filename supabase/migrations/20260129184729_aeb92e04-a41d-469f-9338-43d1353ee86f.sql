-- Copiar etapas de crm_stages para local_pipeline_stages onde não existem
INSERT INTO local_pipeline_stages (id, origin_id, name, stage_order, is_active, color)
SELECT 
  cs.id,
  cs.origin_id,
  cs.stage_name as name,
  cs.stage_order,
  true as is_active,
  null as color
FROM crm_stages cs
WHERE NOT EXISTS (
  SELECT 1 FROM local_pipeline_stages lps 
  WHERE lps.origin_id = cs.origin_id
)
ON CONFLICT (id) DO NOTHING;