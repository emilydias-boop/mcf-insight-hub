-- Atualizar deals que tem reunião R1 agendada mas estão em stages anteriores
WITH deals_to_fix AS (
  SELECT DISTINCT msa.deal_id
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d ON d.id = msa.deal_id
  JOIN crm_stages s ON s.id = d.stage_id
  WHERE ms.meeting_type = 'r1'
    AND msa.status NOT IN ('cancelled', 'no_show')
    AND LOWER(s.stage_name) IN ('novo lead', 'lead qualificado')
)
UPDATE crm_deals 
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53',
  updated_at = NOW()
WHERE id IN (SELECT deal_id FROM deals_to_fix);