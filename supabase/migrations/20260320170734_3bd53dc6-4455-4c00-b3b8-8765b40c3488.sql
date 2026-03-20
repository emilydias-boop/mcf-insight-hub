
-- Delete only the 24 duplicate deals from today's import
-- that share a name with an older deal in the same origin
DELETE FROM crm_deals
WHERE id IN (
  SELECT new.id
  FROM crm_deals new
  JOIN crm_deals old ON lower(trim(new.name)) = lower(trim(old.name))
    AND new.id != old.id
    AND old.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND old.created_at < '2026-03-20 14:00:00+00'
  WHERE new.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND new.created_at >= '2026-03-20 16:40:00+00'
);

-- Delete orphaned contacts from this import batch
DELETE FROM crm_contacts
WHERE clint_id LIKE 'csv_import_%'
  AND created_at >= '2026-03-20 16:40:00+00'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
