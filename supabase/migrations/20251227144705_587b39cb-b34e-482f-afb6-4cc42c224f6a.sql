-- Correção: Inserir activities faltantes para webhooks de R1 Agendada
-- Baseado em webhook_events que não têm deal_activities correspondentes

-- 1. Criar activities para webhooks de R1 Agendada dos últimos 30 dias
WITH webhooks_r1_agendada AS (
  SELECT 
    we.id as webhook_id,
    we.event_data->>'deal_id' as clint_deal_id,
    we.event_data->>'contact_email' as contact_email,
    we.event_data->>'contact_name' as contact_name,
    we.event_data->>'deal_stage' as deal_stage,
    we.event_data->>'deal_old_stage' as deal_old_stage,
    we.event_data->>'deal_user' as deal_user,
    we.event_data->>'deal_origin' as deal_origin,
    we.created_at as webhook_date
  FROM webhook_events we
  WHERE we.event_type = 'deal.stage_changed'
    AND we.status = 'success'
    AND we.created_at >= NOW() - INTERVAL '30 days'
    AND (
      we.event_data->>'deal_stage' ILIKE '%Reunião 01 Agendada%'
      OR we.event_data->>'deal_stage' ILIKE '%R1 Agendada%'
    )
),
-- Buscar deals correspondentes
webhooks_with_deals AS (
  SELECT 
    w.*,
    d.id as deal_id,
    d.name as deal_name
  FROM webhooks_r1_agendada w
  LEFT JOIN crm_contacts c ON LOWER(c.email) = LOWER(w.contact_email)
  LEFT JOIN crm_deals d ON d.contact_id = c.id
  WHERE d.id IS NOT NULL
),
-- Verificar quais já têm activities (deal_id em deal_activities é TEXT)
missing_activities AS (
  SELECT 
    w.*
  FROM webhooks_with_deals w
  WHERE NOT EXISTS (
    SELECT 1 
    FROM deal_activities da
    WHERE da.deal_id = w.deal_id::text
      AND da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Agendada%'
      AND da.created_at >= w.webhook_date - INTERVAL '5 minutes'
      AND da.created_at <= w.webhook_date + INTERVAL '5 minutes'
  )
)
INSERT INTO deal_activities (
  deal_id,
  activity_type,
  description,
  from_stage,
  to_stage,
  created_at,
  metadata
)
SELECT 
  m.deal_id::text,
  'stage_change',
  CASE 
    WHEN m.deal_old_stage IS NULL OR m.deal_old_stage = '' 
    THEN 'Deal movido para ' || m.deal_stage
    ELSE 'Deal movido de ' || m.deal_old_stage || ' para ' || m.deal_stage
  END,
  NULLIF(m.deal_old_stage, ''),
  m.deal_stage,
  m.webhook_date,
  jsonb_build_object(
    'deal_id', m.clint_deal_id,
    'owner_email', m.deal_user,
    'deal_user', m.deal_user,
    'deal_origin', m.deal_origin,
    'contact_email', m.contact_email,
    'contact_name', m.contact_name,
    'reprocessed', true,
    'original_webhook_id', m.webhook_id
  )
FROM missing_activities m;