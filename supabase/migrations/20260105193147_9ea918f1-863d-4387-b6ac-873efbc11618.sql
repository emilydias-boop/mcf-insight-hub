INSERT INTO deal_activities (deal_id, activity_type, from_stage, to_stage, description, metadata)
VALUES (
  'd7b130eb-a289-4ed9-92bb-50d1a6bdb781',
  'stage_change',
  'Lead Qualificado',
  'Reunião 01 Agendada',
  'Deal movido de Lead Qualificado para Reunião 01 Agendada',
  jsonb_build_object(
    'deal_user', 'caroline.souza@minhacasafinanciada.com',
    'owner_email', 'caroline.souza@minhacasafinanciada.com',
    'reprocessed', true,
    'contact_name', 'Thiago Oliveira',
    'contact_phone', '+5531973140635'
  )
);