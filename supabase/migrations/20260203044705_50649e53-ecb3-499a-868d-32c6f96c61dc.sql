-- Primeiro, mover meeting_slot_attendees para o deal correto (o que será mantido)
WITH duplicated_contacts AS (
  SELECT 
    d.contact_id,
    d.origin_id
  FROM crm_deals d
  WHERE d.data_source = 'webhook'
    AND d.contact_id IS NOT NULL
    AND d.origin_id IS NOT NULL
  GROUP BY d.contact_id, d.origin_id
  HAVING COUNT(*) > 1
),
deal_analysis AS (
  SELECT 
    d.id as deal_id,
    d.contact_id,
    d.origin_id,
    d.created_at,
    (SELECT COUNT(*) FROM deal_activities da WHERE da.deal_id = d.id::text) as activity_count,
    (SELECT COUNT(*) FROM meeting_slot_attendees msa WHERE msa.deal_id = d.id) as meeting_count,
    ROW_NUMBER() OVER (
      PARTITION BY d.contact_id, d.origin_id 
      ORDER BY 
        (SELECT COUNT(*) FROM deal_activities da WHERE da.deal_id = d.id::text) +
        (SELECT COUNT(*) FROM meeting_slot_attendees msa WHERE msa.deal_id = d.id) DESC,
        d.created_at ASC
    ) as rn
  FROM crm_deals d
  JOIN duplicated_contacts dc 
    ON d.contact_id = dc.contact_id 
    AND d.origin_id = dc.origin_id
),
deals_to_keep AS (
  SELECT deal_id, contact_id, origin_id FROM deal_analysis WHERE rn = 1
),
deals_to_delete AS (
  SELECT da.deal_id, da.contact_id, da.origin_id
  FROM deal_analysis da
  WHERE da.rn > 1
)
-- Mover meeting_slot_attendees dos deals a deletar para os deals a manter
UPDATE meeting_slot_attendees msa
SET deal_id = dtk.deal_id
FROM deals_to_delete dtd
JOIN deals_to_keep dtk ON dtd.contact_id = dtk.contact_id AND dtd.origin_id = dtk.origin_id
WHERE msa.deal_id = dtd.deal_id;