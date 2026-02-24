
-- Backfill: mirror all local_pipeline_stages missing from crm_stages
INSERT INTO crm_stages (id, clint_id, stage_name, color, stage_order, origin_id, is_active)
SELECT 
  lps.id,
  'local-' || lps.id::text,
  lps.name,
  lps.color,
  lps.stage_order,
  lps.origin_id,
  true
FROM local_pipeline_stages lps
LEFT JOIN crm_stages cs ON cs.id = lps.id
WHERE cs.id IS NULL AND lps.origin_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
