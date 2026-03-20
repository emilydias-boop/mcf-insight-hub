
-- 1. Delete deals com nomes que são apenas números/telefones
DELETE FROM crm_deals 
WHERE stage_id = '663f0eeb-6ad1-4880-851b-7ad4cee4089a'
  AND owner_id = 'ygor.ferreira@minhacasafinanciada.com'
  AND name ~ '^\(?[0-9 \-\(\)]+$'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at <= '2026-03-20 14:29:00+00';

-- 2. Delete contatos órfãos criados no mesmo período
DELETE FROM crm_contacts 
WHERE id IN (
  SELECT c.id FROM crm_contacts c
  LEFT JOIN crm_deals d ON d.contact_id = c.id
  WHERE d.id IS NULL
  AND c.created_at >= '2026-03-20 14:28:00+00'
  AND c.created_at <= '2026-03-20 14:29:00+00'
);
