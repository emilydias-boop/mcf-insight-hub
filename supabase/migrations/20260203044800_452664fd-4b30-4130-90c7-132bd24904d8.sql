-- Deletar deals duplicados (attendees já foram movidos)
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
    (SELECT COUNT(*) FROM deal_activities da WHERE da.deal_id = d.id::text) +
    (SELECT COUNT(*) FROM meeting_slot_attendees msa WHERE msa.deal_id = d.id) as activity_count,
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
deals_to_delete AS (
  SELECT da.deal_id FROM deal_analysis da WHERE da.rn > 1
)
DELETE FROM crm_deals WHERE id IN (SELECT deal_id FROM deals_to_delete);

-- Criar índice único para prevenir futuros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS crm_deals_contact_origin_unique 
ON crm_deals (contact_id, origin_id) 
WHERE contact_id IS NOT NULL 
  AND origin_id IS NOT NULL 
  AND data_source = 'webhook';