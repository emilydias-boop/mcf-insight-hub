UPDATE crm_deals
SET origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
    stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
    updated_at = now()
WHERE origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'
  AND 'recuperado' = ANY(tags)
  AND created_at >= '2026-04-07'
  AND created_at < '2026-04-08';