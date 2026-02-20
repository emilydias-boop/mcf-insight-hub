INSERT INTO crm_stages (id, clint_id, stage_name, stage_order, is_active, origin_id)
VALUES
  ('2357df56-bfad-4c4c-b37b-c5f41ce08af6', 'local-2357df56-bfad-4c4c-b37b-c5f41ce08af6', 'PRODUTOS FECHADOS', 100, true, '7d7b1cb5-2a44-4552-9eff-c3b798646b78'),
  ('91fcdb43-0103-4f9d-881c-f5c6dabe3c97', 'local-91fcdb43-0103-4f9d-881c-f5c6dabe3c97', 'SEM INTERESSE', 101, true, '7d7b1cb5-2a44-4552-9eff-c3b798646b78')
ON CONFLICT (id) DO NOTHING;