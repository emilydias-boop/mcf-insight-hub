
-- 1. Deletar deals backfill duplicados por telefone
DELETE FROM crm_deals
WHERE id IN (
  SELECT d1.id
  FROM crm_deals d1
  JOIN crm_contacts c1 ON d1.contact_id = c1.id
  WHERE d1.created_at >= '2026-03-24'
    AND d1.tags @> ARRAY['Backfill']
    AND d1.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND c1.phone IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM crm_deals d2
      JOIN crm_contacts c2 ON d2.contact_id = c2.id
      WHERE d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
        AND d2.id != d1.id
        AND d2.created_at < '2026-03-24'
        AND c2.phone IS NOT NULL
        AND RIGHT(REGEXP_REPLACE(c2.phone, '\D', '', 'g'), 9) 
          = RIGHT(REGEXP_REPLACE(c1.phone, '\D', '', 'g'), 9)
    )
);

-- 2. Deletar contatos órfãos do backfill
DELETE FROM crm_contacts
WHERE tags @> ARRAY['Backfill']
  AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = crm_contacts.id);
