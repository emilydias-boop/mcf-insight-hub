-- ====================================
-- 2. INSERIR TEMPLATES PADRÃO
-- ====================================

-- SDR Inside N1: 35% / 35% / 15% / 15%
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('d035345f-8fe3-41b4-8bba-28d0596c5bed', 'agendamentos', 'Agendamentos R1', 35.00, NULL),
  ('d035345f-8fe3-41b4-8bba-28d0596c5bed', 'realizadas', 'R1 Realizadas', 35.00, NULL),
  ('d035345f-8fe3-41b4-8bba-28d0596c5bed', 'tentativas', 'Tentativas de Ligação', 15.00, NULL),
  ('d035345f-8fe3-41b4-8bba-28d0596c5bed', 'organizacao', 'Organização', 15.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- SDR Inside N2: 40% / 40% / 10% / 10%
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'agendamentos', 'Agendamentos R1', 40.00, NULL),
  ('9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'realizadas', 'R1 Realizadas', 40.00, NULL),
  ('9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'tentativas', 'Tentativas de Ligação', 10.00, NULL),
  ('9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'organizacao', 'Organização', 10.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- SDR Inside N5: 40% / 40% / 10% / 10%
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('997d5d36-cd94-4365-a5c1-85824c18c38d', 'agendamentos', 'Agendamentos R1', 40.00, NULL),
  ('997d5d36-cd94-4365-a5c1-85824c18c38d', 'realizadas', 'R1 Realizadas', 40.00, NULL),
  ('997d5d36-cd94-4365-a5c1-85824c18c38d', 'tentativas', 'Tentativas de Ligação', 10.00, NULL),
  ('997d5d36-cd94-4365-a5c1-85824c18c38d', 'organizacao', 'Organização', 10.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- SDR Consórcio N1 (ID CORRETO: 19900696-0a06-427a-a8f7-6bd15b9e753c): 40% / 40% / 20%
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('19900696-0a06-427a-a8f7-6bd15b9e753c', 'agendamentos', 'Agendamentos R1', 40.00, NULL),
  ('19900696-0a06-427a-a8f7-6bd15b9e753c', 'realizadas', 'R1 Realizadas', 40.00, NULL),
  ('19900696-0a06-427a-a8f7-6bd15b9e753c', 'organizacao', 'Organização', 20.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- SDR Consórcio N2: 40% / 40% / 20%
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'agendamentos', 'Agendamentos R1', 40.00, NULL),
  ('48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'realizadas', 'R1 Realizadas', 40.00, NULL),
  ('48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'organizacao', 'Organização', 20.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- Closer Inside N1: 85% / 15% (meta 30%)
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('c2909e20-3bfc-4a9f-853f-97f065af099a', 'contratos', 'Contratos Pagos', 85.00, 30),
  ('c2909e20-3bfc-4a9f-853f-97f065af099a', 'organizacao', 'Organização', 15.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- Closer Inside N2: 85% / 15% (meta 35%)
INSERT INTO cargo_metricas_padrao (cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual)
VALUES 
  ('fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'contratos', 'Contratos Pagos', 85.00, 35),
  ('fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'organizacao', 'Organização', 15.00, NULL)
ON CONFLICT (cargo_catalogo_id, nome_metrica) DO NOTHING;

-- ====================================
-- 3. LIMPAR E RECRIAR JAN/FEV 2026
-- ====================================

DELETE FROM fechamento_metricas_mes WHERE ano_mes IN ('2026-01', '2026-02');

-- JANEIRO 2026
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo) VALUES 
  ('2026-01', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'agendamentos', 'Agendamentos R1', 35.00, true),
  ('2026-01', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'realizadas', 'R1 Realizadas', 35.00, true),
  ('2026-01', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'tentativas', 'Tentativas de Ligação', 15.00, true),
  ('2026-01', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'organizacao', 'Organização', 15.00, true),
  ('2026-01', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-01', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-01', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-01', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'organizacao', 'Organização', 10.00, true),
  ('2026-01', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-01', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-01', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-01', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'organizacao', 'Organização', 10.00, true),
  ('2026-01', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-01', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-01', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'organizacao', 'Organização', 20.00, true),
  ('2026-01', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-01', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-01', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'organizacao', 'Organização', 20.00, true);

INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual, ativo) VALUES 
  ('2026-01', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'contratos', 'Contratos Pagos', 85.00, 30, true),
  ('2026-01', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'organizacao', 'Organização', 15.00, NULL, true),
  ('2026-01', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'contratos', 'Contratos Pagos', 85.00, 35, true),
  ('2026-01', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'organizacao', 'Organização', 15.00, NULL, true);

-- FEVEREIRO 2026
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, ativo) VALUES 
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'agendamentos', 'Agendamentos R1', 35.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'realizadas', 'R1 Realizadas', 35.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'tentativas', 'Tentativas de Ligação', 15.00, true),
  ('2026-02', 'd035345f-8fe3-41b4-8bba-28d0596c5bed', 'organizacao', 'Organização', 15.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-02', '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad', 'organizacao', 'Organização', 10.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'tentativas', 'Tentativas de Ligação', 10.00, true),
  ('2026-02', '997d5d36-cd94-4365-a5c1-85824c18c38d', 'organizacao', 'Organização', 10.00, true),
  ('2026-02', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '19900696-0a06-427a-a8f7-6bd15b9e753c', 'organizacao', 'Organização', 20.00, true),
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'agendamentos', 'Agendamentos R1', 40.00, true),
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'realizadas', 'R1 Realizadas', 40.00, true),
  ('2026-02', '48f6d1ce-2fc3-47a0-859a-cfed0da32715', 'organizacao', 'Organização', 20.00, true);

INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, nome_metrica, label_exibicao, peso_percentual, meta_percentual, ativo) VALUES 
  ('2026-02', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'contratos', 'Contratos Pagos', 85.00, 30, true),
  ('2026-02', 'c2909e20-3bfc-4a9f-853f-97f065af099a', 'organizacao', 'Organização', 15.00, NULL, true),
  ('2026-02', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'contratos', 'Contratos Pagos', 85.00, 35, true),
  ('2026-02', 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563', 'organizacao', 'Organização', 15.00, NULL, true);