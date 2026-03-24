
-- 1. Deletar deals duplicados do backfill (criados em 24/03 cujo email já tinha deal anterior no PIS)
DELETE FROM crm_deals 
WHERE id IN (
  SELECT d1.id
  FROM crm_deals d1
  JOIN crm_contacts c1 ON d1.contact_id = c1.id
  WHERE d1.created_at >= '2026-03-24'
    AND d1.tags @> ARRAY['Backfill']
    AND d1.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
    AND LOWER(TRIM(c1.email)) IN (
      SELECT LOWER(TRIM(c2.email))
      FROM crm_deals d2
      JOIN crm_contacts c2 ON d2.contact_id = c2.id
      WHERE d2.origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'
        AND d2.created_at < '2026-03-24'
        AND c2.email IS NOT NULL
    )
);

-- 2. Deletar contatos órfãos do backfill (contatos com tag Backfill sem nenhum deal)
DELETE FROM crm_contacts
WHERE tags @> ARRAY['Backfill']
  AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE contact_id = crm_contacts.id);
