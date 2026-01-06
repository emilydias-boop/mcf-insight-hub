-- Update deal_activities metadata with owner_email from crm_deals.owner_id
-- This fixes activities that are missing owner attribution
UPDATE deal_activities da
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'owner_email', d.owner_id,
  'deal_user', d.owner_id,
  'repaired_at', now()::text
)
FROM crm_deals d
WHERE da.deal_id = d.id::text
  AND d.owner_id IS NOT NULL
  AND da.activity_type = 'stage_change'
  AND (
    da.metadata->>'owner_email' IS NULL 
    OR da.metadata->>'owner_email' = ''
  )
  AND (
    da.metadata->>'deal_user' IS NULL 
    OR da.metadata->>'deal_user' = ''
  );
