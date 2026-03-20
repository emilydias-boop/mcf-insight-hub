
-- 1. Delete batch 1 (156 deals - importação 14:28 com mapeamento errado)
DELETE FROM crm_deals 
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at < '2026-03-20 14:29:00+00';

-- 2. Delete batch 2 (101 deals - importação 15:27 com encoding corrompido)
DELETE FROM crm_deals 
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND created_at >= '2026-03-20 15:27:00+00'
  AND created_at < '2026-03-20 15:29:00+00';

-- 3. Delete orphaned contacts created by these imports
DELETE FROM crm_contacts 
WHERE clint_id LIKE 'csv_import_%'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at < '2026-03-20 15:29:00+00'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
