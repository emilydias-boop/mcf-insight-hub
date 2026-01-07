-- Inserir catálogo de cargos SDRs e outros
INSERT INTO cargos_catalogo (cargo_base, nivel, nome_exibicao, area, fixo_valor, variavel_valor, ote_total, modelo_variavel, ativo)
VALUES 
-- INSIDE SALES SDRs
('SDR', 1, 'SDR Inside N1', 'Inside Sales', 2800, 1200, 4000, 'score_metricas', true),
('SDR', 2, 'SDR Inside N2', 'Inside Sales', 3150, 1350, 4500, 'score_metricas', true),
('SDR', 3, 'SDR Inside N3', 'Inside Sales', 3500, 1500, 5000, 'score_metricas', true),
('SDR', 4, 'SDR Inside N4', 'Inside Sales', 3850, 1650, 5500, 'score_metricas', true),
('SDR', 5, 'SDR Inside N5', 'Inside Sales', 4200, 1800, 6000, 'score_metricas', true),
('SDR', 6, 'SDR Inside N6', 'Inside Sales', 4550, 1950, 6500, 'score_metricas', true),
('SDR', 7, 'SDR Inside N7', 'Inside Sales', 4900, 2100, 7000, 'score_metricas', true),
('Closer', null, 'Closer Inside', 'Inside Sales', 0, 0, 0, 'fixo_puro', true),
('Supervisor', null, 'Supervisor Inside', 'Inside Sales', 0, 0, 0, 'fixo_puro', true),
-- CONSORCIO SDRs
('SDR', 1, 'SDR Consórcio N1', 'Consórcio', 2800, 1200, 4000, 'score_metricas', true),
('SDR', 2, 'SDR Consórcio N2', 'Consórcio', 3150, 1350, 4500, 'score_metricas', true),
('SDR', 3, 'SDR Consórcio N3', 'Consórcio', 3500, 1500, 5000, 'score_metricas', true),
('SDR', 4, 'SDR Consórcio N4', 'Consórcio', 3850, 1650, 5500, 'score_metricas', true),
('SDR', 5, 'SDR Consórcio N5', 'Consórcio', 4200, 1800, 6000, 'score_metricas', true),
('SDR', 6, 'SDR Consórcio N6', 'Consórcio', 4550, 1950, 6500, 'score_metricas', true),
('SDR', 7, 'SDR Consórcio N7', 'Consórcio', 4900, 2100, 7000, 'score_metricas', true),
('Closer', null, 'Closer Consórcio', 'Consórcio', 0, 0, 0, 'fixo_puro', true),
('Coordenador', null, 'Coordenador Consórcio', 'Consórcio', 0, 0, 0, 'fixo_puro', true),
('Supervisor', null, 'Supervisor Consórcio', 'Consórcio', 0, 0, 0, 'fixo_puro', true),
-- CREDITO SDRs
('SDR', 1, 'SDR Crédito N1', 'Crédito', 2800, 1200, 4000, 'score_metricas', true),
('SDR', 2, 'SDR Crédito N2', 'Crédito', 3150, 1350, 4500, 'score_metricas', true),
('SDR', 3, 'SDR Crédito N3', 'Crédito', 3500, 1500, 5000, 'score_metricas', true),
('SDR', 4, 'SDR Crédito N4', 'Crédito', 3850, 1650, 5500, 'score_metricas', true),
('SDR', 5, 'SDR Crédito N5', 'Crédito', 4200, 1800, 6000, 'score_metricas', true),
('SDR', 6, 'SDR Crédito N6', 'Crédito', 4550, 1950, 6500, 'score_metricas', true),
('SDR', 7, 'SDR Crédito N7', 'Crédito', 4900, 2100, 7000, 'score_metricas', true),
('Closer', null, 'Closer Crédito', 'Crédito', 0, 0, 0, 'fixo_puro', true),
('Gerente de Contas', null, 'Gerente Crédito', 'Crédito', 0, 0, 0, 'fixo_puro', true),
('Coordenador', null, 'Coordenador Crédito', 'Crédito', 0, 0, 0, 'fixo_puro', true),
('Supervisor', null, 'Supervisor Crédito', 'Crédito', 0, 0, 0, 'fixo_puro', true),
-- MARKETING
('Social Media', null, 'Social Media', 'Marketing', 0, 0, 0, 'fixo_puro', true),
('Designer', null, 'Designer', 'Marketing', 0, 0, 0, 'fixo_puro', true),
('Filmmaker', null, 'Filmmaker', 'Marketing', 0, 0, 0, 'fixo_puro', true),
('Diretor', null, 'Diretor Marketing', 'Marketing', 0, 0, 0, 'fixo_puro', true),
-- TECNOLOGIA
('Desenvolvedor', null, 'Desenvolvedor', 'Tecnologia', 0, 0, 0, 'fixo_puro', true),
-- AVULSOS
('Head de Relacionamento', null, 'Head de Relacionamento', 'Avulsos', 0, 0, 0, 'fixo_puro', true),
-- FINANCEIRO
('Diretor', null, 'Diretor Financeiro', 'Financeiro', 0, 0, 0, 'fixo_puro', true),
-- PROJETOS
('Diretora', null, 'Diretora Projetos', 'Projetos', 0, 0, 0, 'fixo_puro', true),
('Arquiteto', null, 'Arquiteto', 'Projetos', 0, 0, 0, 'fixo_puro', true)
ON CONFLICT DO NOTHING;