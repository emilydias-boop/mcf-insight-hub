-- Popular dados históricos de Agosto, Setembro e Outubro de 2025 para todos os SDRs ativos

-- Agosto 2025 - 21 dias úteis
INSERT INTO sdr_comp_plan (
  sdr_id, vigencia_inicio, vigencia_fim, dias_uteis,
  fixo_valor, ote_total, variavel_total,
  meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao,
  valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao,
  ifood_mensal, ifood_ultrameta, status
)
SELECT 
  s.id, '2025-08-01', '2025-08-31', 21,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  CASE s.nivel WHEN 1 THEN 4000 WHEN 2 THEN 4500 WHEN 3 THEN 5000 WHEN 4 THEN 5500 WHEN 5 THEN 6000 WHEN 6 THEN 6500 WHEN 7 THEN 7000 ELSE 4000 END,
  CASE s.nivel WHEN 1 THEN 1200 WHEN 2 THEN 1350 WHEN 3 THEN 1500 WHEN 4 THEN 1650 WHEN 5 THEN 1800 WHEN 6 THEN 1950 WHEN 7 THEN 2100 ELSE 1200 END,
  COALESCE(s.meta_diaria, 9) * 21, ROUND(COALESCE(s.meta_diaria, 9) * 21 * 0.70), COALESCE(s.meta_diaria, 9) * 21 * 17, 100,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  693, 840, 'active'
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, vigencia_inicio) DO NOTHING;

-- Setembro 2025 - 22 dias úteis
INSERT INTO sdr_comp_plan (
  sdr_id, vigencia_inicio, vigencia_fim, dias_uteis,
  fixo_valor, ote_total, variavel_total,
  meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao,
  valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao,
  ifood_mensal, ifood_ultrameta, status
)
SELECT 
  s.id, '2025-09-01', '2025-09-30', 22,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  CASE s.nivel WHEN 1 THEN 4000 WHEN 2 THEN 4500 WHEN 3 THEN 5000 WHEN 4 THEN 5500 WHEN 5 THEN 6000 WHEN 6 THEN 6500 WHEN 7 THEN 7000 ELSE 4000 END,
  CASE s.nivel WHEN 1 THEN 1200 WHEN 2 THEN 1350 WHEN 3 THEN 1500 WHEN 4 THEN 1650 WHEN 5 THEN 1800 WHEN 6 THEN 1950 WHEN 7 THEN 2100 ELSE 1200 END,
  COALESCE(s.meta_diaria, 9) * 22, ROUND(COALESCE(s.meta_diaria, 9) * 22 * 0.70), COALESCE(s.meta_diaria, 9) * 22 * 17, 100,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  726, 840, 'active'
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, vigencia_inicio) DO NOTHING;

-- Outubro 2025 - 22 dias úteis
INSERT INTO sdr_comp_plan (
  sdr_id, vigencia_inicio, vigencia_fim, dias_uteis,
  fixo_valor, ote_total, variavel_total,
  meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao,
  valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao,
  ifood_mensal, ifood_ultrameta, status
)
SELECT 
  s.id, '2025-10-01', '2025-10-31', 22,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  CASE s.nivel WHEN 1 THEN 4000 WHEN 2 THEN 4500 WHEN 3 THEN 5000 WHEN 4 THEN 5500 WHEN 5 THEN 6000 WHEN 6 THEN 6500 WHEN 7 THEN 7000 ELSE 4000 END,
  CASE s.nivel WHEN 1 THEN 1200 WHEN 2 THEN 1350 WHEN 3 THEN 1500 WHEN 4 THEN 1650 WHEN 5 THEN 1800 WHEN 6 THEN 1950 WHEN 7 THEN 2100 ELSE 1200 END,
  COALESCE(s.meta_diaria, 9) * 22, ROUND(COALESCE(s.meta_diaria, 9) * 22 * 0.70), COALESCE(s.meta_diaria, 9) * 22 * 17, 100,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  726, 840, 'active'
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, vigencia_inicio) DO NOTHING;

-- KPIs para meses anteriores
INSERT INTO sdr_month_kpi (sdr_id, ano_mes, reunioes_agendadas, reunioes_realizadas, no_shows, taxa_no_show, tentativas_ligacoes, score_organizacao, intermediacoes_contrato)
SELECT s.id, '2025-08', 0, 0, 0, 0, 0, 0, 0 FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;

INSERT INTO sdr_month_kpi (sdr_id, ano_mes, reunioes_agendadas, reunioes_realizadas, no_shows, taxa_no_show, tentativas_ligacoes, score_organizacao, intermediacoes_contrato)
SELECT s.id, '2025-09', 0, 0, 0, 0, 0, 0, 0 FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;

INSERT INTO sdr_month_kpi (sdr_id, ano_mes, reunioes_agendadas, reunioes_realizadas, no_shows, taxa_no_show, tentativas_ligacoes, score_organizacao, intermediacoes_contrato)
SELECT s.id, '2025-10', 0, 0, 0, 0, 0, 0, 0 FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;

-- Payouts para meses anteriores
INSERT INTO sdr_month_payout (sdr_id, ano_mes, status, valor_fixo, valor_variavel_total, total_conta, ifood_mensal, ifood_ultrameta, total_ifood)
SELECT s.id, '2025-08', 'DRAFT',
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  0,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  693, 0, 693
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;

INSERT INTO sdr_month_payout (sdr_id, ano_mes, status, valor_fixo, valor_variavel_total, total_conta, ifood_mensal, ifood_ultrameta, total_ifood)
SELECT s.id, '2025-09', 'DRAFT',
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  0,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  726, 0, 726
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;

INSERT INTO sdr_month_payout (sdr_id, ano_mes, status, valor_fixo, valor_variavel_total, total_conta, ifood_mensal, ifood_ultrameta, total_ifood)
SELECT s.id, '2025-10', 'DRAFT',
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  0,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  726, 0, 726
FROM sdr s WHERE s.active = true
ON CONFLICT (sdr_id, ano_mes) DO NOTHING;