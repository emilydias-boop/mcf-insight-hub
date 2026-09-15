INSERT INTO public.local_pipeline_stages (id, name, color, stage_order, origin_id, is_active)
VALUES ('535dbfb7-249c-40ff-83d1-6fc899d96e6c', 'ENCAMINHADO GR', '#f59e0b', -1, '7d7b1cb5-2a44-4552-9eff-c3b798646b78', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, stage_order = EXCLUDED.stage_order, origin_id = EXCLUDED.origin_id, is_active = true;