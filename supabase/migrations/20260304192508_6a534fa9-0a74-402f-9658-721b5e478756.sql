
-- 1. Atualizar sdr.nivel
UPDATE sdr SET nivel = 2, updated_at = now() WHERE id IN (
  '11111111-0001-0001-0001-000000000005', -- Antony Elias
  '11111111-0001-0001-0001-000000000004', -- Carol Souza
  '11111111-0001-0001-0001-000000000001', -- Julia Caroline
  '11111111-0001-0001-0001-000000000003'  -- Leticia Nunes
);
UPDATE sdr SET nivel = 3, updated_at = now() WHERE id = '11111111-0001-0001-0001-000000000002'; -- Carol Correa

-- 2. Atualizar employees.nivel
UPDATE employees SET nivel = 2, updated_at = now() WHERE id IN (
  '7ce46aa0-7df3-41be-9249-23fc99b8a2aa', -- Antony Elias
  '50a576c9-5a5e-439a-a4c8-0d7de3f903b4', -- Carol Souza
  '9bd46a2a-273d-4741-98c8-93b6594e918f', -- Julia Caroline
  '3b38f437-48d7-457a-aa77-6a72070512db'  -- Leticia Nunes
);
UPDATE employees SET nivel = 3, updated_at = now() WHERE id = 'ff9072be-9577-46f9-be51-c215c37b2146'; -- Carol Correa

-- 3. Inserir eventos de promoção de nível (backfill março)
INSERT INTO employee_events (employee_id, tipo_evento, titulo, descricao, data_evento, valor_anterior, valor_novo, created_by) VALUES
  ('7ce46aa0-7df3-41be-9249-23fc99b8a2aa', 'promocao', 'Mudança de Nível (SDR)', 'Nível alterado de SDR Inside N1 para SDR Inside N2', '2026-03-01', 'SDR Inside N1', 'SDR Inside N2', NULL),
  ('50a576c9-5a5e-439a-a4c8-0d7de3f903b4', 'promocao', 'Mudança de Nível (SDR)', 'Nível alterado de SDR Inside N1 para SDR Inside N2', '2026-03-01', 'SDR Inside N1', 'SDR Inside N2', NULL),
  ('9bd46a2a-273d-4741-98c8-93b6594e918f', 'promocao', 'Mudança de Nível (SDR)', 'Nível alterado de SDR Inside N1 para SDR Inside N2', '2026-03-01', 'SDR Inside N1', 'SDR Inside N2', NULL),
  ('3b38f437-48d7-457a-aa77-6a72070512db', 'promocao', 'Mudança de Nível (SDR)', 'Nível alterado de SDR Inside N1 para SDR Inside N2', '2026-03-01', 'SDR Inside N1', 'SDR Inside N2', NULL),
  ('ff9072be-9577-46f9-be51-c215c37b2146', 'promocao', 'Mudança de Nível (SDR)', 'Nível alterado de SDR Inside N2 para SDR Inside N3', '2026-03-01', 'SDR Inside N2', 'SDR Inside N3', NULL);

-- 4. Inserir eventos de ajuste de meta (backfill março)
INSERT INTO employee_events (employee_id, tipo_evento, titulo, descricao, data_evento, valor_anterior, valor_novo, created_by) VALUES
  ('7ce46aa0-7df3-41be-9249-23fc99b8a2aa', 'reajuste_meta', 'Ajuste de Meta Diária (SDR)', 'Meta diária alterada de 7 para 9', '2026-03-01', '7', '9', NULL),
  ('50a576c9-5a5e-439a-a4c8-0d7de3f903b4', 'reajuste_meta', 'Ajuste de Meta Diária (SDR)', 'Meta diária alterada de 7 para 9', '2026-03-01', '7', '9', NULL),
  ('3b38f437-48d7-457a-aa77-6a72070512db', 'reajuste_meta', 'Ajuste de Meta Diária (SDR)', 'Meta diária alterada de 7 para 9', '2026-03-01', '7', '9', NULL),
  ('ff9072be-9577-46f9-be51-c215c37b2146', 'reajuste_meta', 'Ajuste de Meta Diária (SDR)', 'Meta diária alterada de 9 para 10', '2026-03-01', '9', '10', NULL);
