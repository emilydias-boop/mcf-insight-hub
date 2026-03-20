
-- 1. Deletar os 12 deals corrompidos (contatos com phone não-numérico)
DELETE FROM crm_deals
WHERE id IN (
  SELECT d.id FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  WHERE d.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND d.created_at >= '2026-03-20 16:40:00+00'
    AND c.clint_id LIKE 'spreadsheet_import_%'
    AND coalesce(c.email, '') = ''
    AND coalesce(c.phone, '') !~ '^[0-9+()\-\s]+$'
);

-- 2. Deletar contatos órfãos dessas importações
DELETE FROM crm_contacts
WHERE clint_id LIKE 'spreadsheet_import_%'
  AND created_at >= '2026-03-20 14:00:00+00'
  AND (email IS NULL OR email = '')
  AND coalesce(phone, '') !~ '^[0-9+()\-\s]+$'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
