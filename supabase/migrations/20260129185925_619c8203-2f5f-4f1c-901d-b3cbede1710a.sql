-- 1. Criar Grupo (funil principal) para BU Leilão
INSERT INTO crm_groups (id, clint_id, name, display_name, is_archived)
VALUES (
  'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
  'local-group-bu-leilao',
  'BU - LEILÃO',
  'BU - LEILÃO',
  false
);

-- 2. Criar Origem (pipeline) vinculada ao grupo
INSERT INTO crm_origins (id, clint_id, name, display_name, group_id, pipeline_type, is_archived)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'local-origin-leilao-pipeline',
  'Pipeline Leilão',
  'Pipeline Leilão',
  'f8a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
  'outros',
  false
);

-- 3. Criar etapas do Kanban
INSERT INTO local_pipeline_stages (origin_id, name, stage_order, is_active, stage_type, color)
VALUES
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Novo Lead', 0, true, 'active', '#3B82F6'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Em Contato', 1, true, 'active', '#8B5CF6'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Lead Qualificado', 2, true, 'active', '#10B981'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Proposta Enviada', 3, true, 'active', '#F59E0B'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Análise Documental', 4, true, 'active', '#6366F1'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Contrato Assinado', 5, true, 'won', '#22C55E'),
  ('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'Sem Interesse', 6, true, 'lost', '#EF4444');