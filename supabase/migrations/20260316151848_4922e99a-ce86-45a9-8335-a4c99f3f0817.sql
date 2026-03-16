
-- Revert deals incorrectly moved by move-partners-to-venda-realizada
WITH incorporador_origins AS (
  SELECT id FROM crm_origins 
  WHERE group_id = 'a6f3cbfc-0567-427f-a405-5a869aaa6010'
),
wrongly_moved AS (
  SELECT DISTINCT ON (da.deal_id)
    da.deal_id,
    da.from_stage::uuid as original_stage
  FROM deal_activities da
  JOIN crm_deals d ON d.id::text = da.deal_id
  WHERE da.metadata->>'source' = 'move-partners-to-venda-realizada'
    AND d.origin_id NOT IN (SELECT id FROM incorporador_origins)
  ORDER BY da.deal_id, da.created_at DESC
)
UPDATE crm_deals d
SET 
  stage_id = wm.original_stage,
  updated_at = NOW()
FROM wrongly_moved wm
WHERE d.id::text = wm.deal_id;
