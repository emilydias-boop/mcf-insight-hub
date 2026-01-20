-- Move Valmiller Silva para R1 Agendada
UPDATE crm_deals 
SET stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53'
WHERE id = '8f88d07d-1079-486c-9b91-ce051a6abfe3';

-- Registrar atividade
INSERT INTO deal_activities (deal_id, activity_type, description, from_stage, to_stage, metadata)
VALUES (
  '8f88d07d-1079-486c-9b91-ce051a6abfe3',
  'stage_change',
  'Sincronizado manualmente - reunião já agendada',
  '3c81d73b-0d5d-480f-a3c9-ab7a6c7965a2',
  'a8365215-fd31-4bdc-bbe7-77100fa39e53',
  '{"via": "manual_sync"}'::jsonb
);