-- Create "No-Show R2" stage in PIPELINE INSIDE SALES for R2 no-shows
-- This separates R2 no-shows from R1 no-shows so SDRs don't see them
INSERT INTO crm_stages (clint_id, origin_id, stage_name, stage_order, is_active, color)
VALUES (
  gen_random_uuid(),  -- Generate a unique clint_id
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',  -- PIPELINE INSIDE SALES
  'No-Show R2',
  8,
  true,
  '#F59E0B'  -- Orange to distinguish from regular No-Show
)
ON CONFLICT DO NOTHING;