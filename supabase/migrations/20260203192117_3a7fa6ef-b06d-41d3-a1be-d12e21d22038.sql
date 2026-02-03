-- ============================================
-- MIGRAÇÃO V6: PASSO 2 - Transferir referências FK
-- ============================================

-- Transferir meeting_slot_attendees usando JOIN
UPDATE meeting_slot_attendees msa
SET deal_id = pipeline_deal.id
FROM crm_deals hubla_deal
JOIN crm_origins o ON hubla_deal.origin_id = o.id
JOIN crm_deals pipeline_deal ON hubla_deal.contact_id = pipeline_deal.contact_id
WHERE msa.deal_id = hubla_deal.id
  AND o.name ILIKE '%a010%hubla%'
  AND pipeline_deal.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

-- Transferir deal_activities (TEXT comparison)
UPDATE deal_activities da
SET deal_id = pipeline_deal.id::text
FROM crm_deals hubla_deal
JOIN crm_origins o ON hubla_deal.origin_id = o.id
JOIN crm_deals pipeline_deal ON hubla_deal.contact_id = pipeline_deal.contact_id
WHERE da.deal_id = hubla_deal.id::text
  AND o.name ILIKE '%a010%hubla%'
  AND pipeline_deal.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

-- Transferir deal_tasks
UPDATE deal_tasks dt
SET deal_id = pipeline_deal.id
FROM crm_deals hubla_deal
JOIN crm_origins o ON hubla_deal.origin_id = o.id
JOIN crm_deals pipeline_deal ON hubla_deal.contact_id = pipeline_deal.contact_id
WHERE dt.deal_id = hubla_deal.id
  AND o.name ILIKE '%a010%hubla%'
  AND pipeline_deal.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';

-- Transferir calls
UPDATE calls c
SET deal_id = pipeline_deal.id
FROM crm_deals hubla_deal
JOIN crm_origins o ON hubla_deal.origin_id = o.id
JOIN crm_deals pipeline_deal ON hubla_deal.contact_id = pipeline_deal.contact_id
WHERE c.deal_id = hubla_deal.id
  AND o.name ILIKE '%a010%hubla%'
  AND pipeline_deal.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c';