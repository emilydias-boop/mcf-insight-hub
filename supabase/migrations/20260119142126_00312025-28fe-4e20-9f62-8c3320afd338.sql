-- Limpar stages erradas do grupo Perpétuo X1
DELETE FROM local_pipeline_stages 
WHERE group_id = 'a6f3cbfc-0567-427f-a405-5a869aaa6010';

-- Inserir stages corretas do PIPELINE INSIDE SALES vinculadas à origem
INSERT INTO local_pipeline_stages (name, color, stage_order, origin_id)
SELECT 
  s.stage_name,
  s.color,
  s.stage_order,
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
FROM crm_stages s
WHERE s.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
  AND s.is_active = true
ORDER BY s.stage_order;