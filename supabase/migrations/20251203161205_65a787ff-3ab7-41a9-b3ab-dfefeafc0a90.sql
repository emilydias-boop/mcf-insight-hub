-- Inserir os 13 SDRs
INSERT INTO public.sdr (id, name, nivel, meta_diaria, active, status, observacao) VALUES
  ('11111111-0001-0001-0001-000000000001', 'Julia Caroline', 1, 9, true, 'APPROVED', 'Saiu e voltou como nível 1'),
  ('11111111-0001-0001-0001-000000000002', 'Carol Correa', 2, 9, true, 'APPROVED', NULL),
  ('11111111-0001-0001-0001-000000000003', 'Leticia Nunes', 1, 7, true, 'APPROVED', NULL),
  ('11111111-0001-0001-0001-000000000004', 'Carol Souza', 1, 5, true, 'APPROVED', 'Em rampagem'),
  ('11111111-0001-0001-0001-000000000005', 'Antony Elias', 1, 5, true, 'APPROVED', 'Em rampagem'),
  ('11111111-0001-0001-0001-000000000006', 'Cleiton Lima', 1, 7, true, 'APPROVED', NULL),
  ('11111111-0001-0001-0001-000000000007', 'Cristiane Gomes', 1, 3, true, 'APPROVED', 'Follow-up'),
  ('11111111-0001-0001-0001-000000000008', 'Juliana Rodrigues', 1, 3, true, 'APPROVED', 'Follow-up'),
  ('11111111-0001-0001-0001-000000000009', 'Angelina Maia', 1, 9, true, 'APPROVED', 'Saiu e voltou como nível 1'),
  ('11111111-0001-0001-0001-000000000010', 'Vinicius Rangel', 1, 5, true, 'APPROVED', 'Em rampagem'),
  ('11111111-0001-0001-0001-000000000011', 'Jessica Martins', 5, 10, true, 'APPROVED', NULL),
  ('11111111-0001-0001-0001-000000000012', 'Vitor Costta', 1, 3, true, 'APPROVED', 'Follow-up'),
  ('11111111-0001-0001-0001-000000000013', 'Yanca Oliveira', 1, 3, true, 'APPROVED', 'Follow-up')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  nivel = EXCLUDED.nivel,
  meta_diaria = EXCLUDED.meta_diaria,
  observacao = EXCLUDED.observacao;

-- Planos OTE Novembro 2024 (19 dias úteis)
-- Nível 1: Fixo R$2800, OTE R$4000, Variável R$1200, cada indicador R$300
-- Nível 2: Fixo R$3150, OTE R$4500, Variável R$1350, cada indicador R$337.50
-- Nível 5: Fixo R$4200, OTE R$6000, Variável R$1800, cada indicador R$450

INSERT INTO public.sdr_comp_plan (sdr_id, vigencia_inicio, vigencia_fim, ote_total, fixo_valor, variavel_total, valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao, ifood_mensal, ifood_ultrameta, meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao, dias_uteis, meta_no_show_pct, status) VALUES
  -- Julia Caroline (Nível 1, meta 9/dia): 9×19=171 agendadas, 120 realizadas, 2907 tentativas
  ('11111111-0001-0001-0001-000000000001', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 171, 120, 2907, 100, 19, 30, 'APPROVED'),
  -- Carol Correa (Nível 2, meta 9/dia): 9×19=171 agendadas, 120 realizadas, 2907 tentativas
  ('11111111-0001-0001-0001-000000000002', '2024-11-01', '2024-11-30', 4500, 3150, 1350, 337.50, 337.50, 337.50, 337.50, 630, 840, 171, 120, 2907, 100, 19, 30, 'APPROVED'),
  -- Leticia Nunes (Nível 1, meta 7/dia): 7×19=133 agendadas, 93 realizadas, 2261 tentativas
  ('11111111-0001-0001-0001-000000000003', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 133, 93, 2261, 100, 19, 30, 'APPROVED'),
  -- Carol Souza (Nível 1, meta 5/dia): 5×19=95 agendadas, 67 realizadas, 1615 tentativas
  ('11111111-0001-0001-0001-000000000004', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 95, 67, 1615, 100, 19, 30, 'APPROVED'),
  -- Antony Elias (Nível 1, meta 5/dia)
  ('11111111-0001-0001-0001-000000000005', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 95, 67, 1615, 100, 19, 30, 'APPROVED'),
  -- Cleiton Lima (Nível 1, meta 7/dia)
  ('11111111-0001-0001-0001-000000000006', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 133, 93, 2261, 100, 19, 30, 'APPROVED'),
  -- Cristiane Gomes (Nível 1, meta 3/dia): 3×19=57 agendadas, 40 realizadas, 969 tentativas
  ('11111111-0001-0001-0001-000000000007', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 57, 40, 969, 100, 19, 30, 'APPROVED'),
  -- Juliana Rodrigues (Nível 1, meta 3/dia)
  ('11111111-0001-0001-0001-000000000008', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 57, 40, 969, 100, 19, 30, 'APPROVED'),
  -- Angelina Maia (Nível 1, meta 9/dia)
  ('11111111-0001-0001-0001-000000000009', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 171, 120, 2907, 100, 19, 30, 'APPROVED'),
  -- Vinicius Rangel (Nível 1, meta 5/dia)
  ('11111111-0001-0001-0001-000000000010', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 95, 67, 1615, 100, 19, 30, 'APPROVED'),
  -- Jessica Martins (Nível 5, meta 10/dia): 10×19=190 agendadas, 133 realizadas, 3230 tentativas
  ('11111111-0001-0001-0001-000000000011', '2024-11-01', '2024-11-30', 6000, 4200, 1800, 450, 450, 450, 450, 630, 840, 190, 133, 3230, 100, 19, 30, 'APPROVED'),
  -- Vitor Costta (Nível 1, meta 3/dia)
  ('11111111-0001-0001-0001-000000000012', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 57, 40, 969, 100, 19, 30, 'APPROVED'),
  -- Yanca Oliveira (Nível 1, meta 3/dia)
  ('11111111-0001-0001-0001-000000000013', '2024-11-01', '2024-11-30', 4000, 2800, 1200, 300, 300, 300, 300, 630, 840, 57, 40, 969, 100, 19, 30, 'APPROVED');

-- KPIs zerados para novembro 2024
INSERT INTO public.sdr_month_kpi (sdr_id, ano_mes, reunioes_agendadas, reunioes_realizadas, tentativas_ligacoes, score_organizacao, no_shows, intermediacoes_contrato, taxa_no_show) VALUES
  ('11111111-0001-0001-0001-000000000001', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000002', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000003', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000004', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000005', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000006', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000007', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000008', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000009', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000010', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000011', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000012', '2024-11', 0, 0, 0, 0, 0, 0, 0),
  ('11111111-0001-0001-0001-000000000013', '2024-11', 0, 0, 0, 0, 0, 0, 0);

-- Payouts DRAFT para novembro 2024 (valores zerados pois KPIs são 0)
INSERT INTO public.sdr_month_payout (sdr_id, ano_mes, pct_reunioes_agendadas, pct_reunioes_realizadas, pct_tentativas, pct_organizacao, mult_reunioes_agendadas, mult_reunioes_realizadas, mult_tentativas, mult_organizacao, valor_reunioes_agendadas, valor_reunioes_realizadas, valor_tentativas, valor_organizacao, valor_variavel_total, valor_fixo, total_conta, ifood_mensal, ifood_ultrameta, ifood_ultrameta_autorizado, total_ifood, status) VALUES
  ('11111111-0001-0001-0001-000000000001', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000002', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3150, 3150, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000003', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000004', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000005', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000006', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000007', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000008', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000009', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000010', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000011', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4200, 4200, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000012', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT'),
  ('11111111-0001-0001-0001-000000000013', '2024-11', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2800, 2800, 630, 0, false, 630, 'DRAFT');