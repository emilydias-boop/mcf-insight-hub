-- Corrigir deal do Thiago Oliveira com origin_id e stage_id corretos
UPDATE crm_deals 
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53',
  updated_at = now()
WHERE id = 'd7b130eb-a289-4ed9-92bb-50d1a6bdb781';