-- Fix Consórcio funnel filter: add the missing 'group' entry to bu_origin_mapping
-- Without this, buAllowedGroups was empty and the "Funil:" dropdown didn't filter pipelines.
-- Same fix previously applied to Incorporador.

INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'group', 'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c', true)
ON CONFLICT DO NOTHING;

-- Ensure default origin remains correct
UPDATE bu_origin_mapping
   SET is_default = true
 WHERE bu = 'consorcio'
   AND entity_type = 'origin'
   AND entity_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78';