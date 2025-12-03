-- 1. Atualizar emails dos SDRs
UPDATE sdr SET email = 'julia.caroline@minhacasafinanciada.com' WHERE name = 'Julia Caroline';
UPDATE sdr SET email = 'carol.correa@minhacasafinanciada.com' WHERE name = 'Carol Correa';
UPDATE sdr SET email = 'leticia.nunes@minhacasafinanciada.com' WHERE name = 'Leticia Nunes';
UPDATE sdr SET email = 'caroline.souza@minhacasafinanciada.com' WHERE name = 'Carol Souza';
UPDATE sdr SET email = 'antony.elias@minhacasafinanciada.com' WHERE name = 'Antony Elias';
UPDATE sdr SET email = 'cleiton.lima@minhacasafinanciada.com' WHERE name = 'Cleiton Lima';
UPDATE sdr SET email = 'cristiane.gomes@minhacasafinanciada.com' WHERE name = 'Cristiane Gomes';
UPDATE sdr SET email = 'juliana.rodrigues@minhacasafinanciada.com' WHERE name = 'Juliana Rodrigues';
UPDATE sdr SET email = 'angelina.maia@minhacasafinanciada.com' WHERE name = 'Angelina Maia';
UPDATE sdr SET email = 'rangel.vinicius@minhacasafinanciada.com' WHERE name = 'Vinicius Rangel';
UPDATE sdr SET email = 'jessica.martins@minhacasafinanciada.com' WHERE name = 'Jessica Martins';
UPDATE sdr SET email = 'vitor.ferreira@minhacasafinanciada.com' WHERE name = 'Vitor Costta';
UPDATE sdr SET email = 'yanca.tavares@minhacasafinanciada.com' WHERE name = 'Yanca Oliveira';

-- 2. Atualizar níveis dos SDRs
UPDATE sdr SET nivel = 5 WHERE name = 'Jessica Martins';
UPDATE sdr SET nivel = 2 WHERE name = 'Carol Correa';
UPDATE sdr SET nivel = 1 WHERE name NOT IN ('Jessica Martins', 'Carol Correa');

-- 3. Deletar comp_plans existentes para novembro e criar novos
DELETE FROM sdr_comp_plan WHERE vigencia_inicio = '2025-11-01';

-- 4. Criar comp_plans para todos os SDRs ativos (19 dias úteis em novembro)
INSERT INTO sdr_comp_plan (
  sdr_id, vigencia_inicio, status, dias_uteis,
  ote_total, fixo_valor, variavel_total,
  meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao, meta_no_show_pct,
  valor_docs_reuniao, valor_meta_rpg, valor_tentativas, valor_organizacao,
  ifood_mensal, ifood_ultrameta
)
SELECT 
  s.id,
  '2025-11-01'::date,
  'active',
  19,
  CASE s.nivel WHEN 1 THEN 4000 WHEN 2 THEN 4500 WHEN 3 THEN 5000 WHEN 4 THEN 5500 WHEN 5 THEN 6000 WHEN 6 THEN 6500 WHEN 7 THEN 7000 ELSE 4000 END,
  CASE s.nivel WHEN 1 THEN 2800 WHEN 2 THEN 3150 WHEN 3 THEN 3500 WHEN 4 THEN 3850 WHEN 5 THEN 4200 WHEN 6 THEN 4550 WHEN 7 THEN 4900 ELSE 2800 END,
  CASE s.nivel WHEN 1 THEN 1200 WHEN 2 THEN 1350 WHEN 3 THEN 1500 WHEN 4 THEN 1650 WHEN 5 THEN 1800 WHEN 6 THEN 1950 WHEN 7 THEN 2100 ELSE 1200 END,
  COALESCE(s.meta_diaria, 9) * 19,
  ROUND(COALESCE(s.meta_diaria, 9) * 19 * 0.70),
  COALESCE(s.meta_diaria, 9) * 19 * 17,
  100,
  30,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  CASE s.nivel WHEN 1 THEN 300 WHEN 2 THEN 337.5 WHEN 3 THEN 375 WHEN 4 THEN 412.5 WHEN 5 THEN 450 WHEN 6 THEN 487.5 WHEN 7 THEN 525 ELSE 300 END,
  627,
  840
FROM sdr s WHERE s.active = true;

-- 5. Popular KPIs de novembro com dados consolidados
UPDATE sdr_month_kpi SET reunioes_agendadas = 255, reunioes_realizadas = 109, no_shows = 16, taxa_no_show = 6.27
WHERE sdr_id = '11111111-0001-0001-0001-000000000011' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 218, reunioes_realizadas = 124, no_shows = 5, taxa_no_show = 2.29
WHERE sdr_id = '11111111-0001-0001-0001-000000000002' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 215, reunioes_realizadas = 95, no_shows = 9, taxa_no_show = 4.19
WHERE sdr_id = '11111111-0001-0001-0001-000000000001' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 167, reunioes_realizadas = 71, no_shows = 5, taxa_no_show = 2.99
WHERE sdr_id = '11111111-0001-0001-0001-000000000003' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 164, reunioes_realizadas = 12, no_shows = 4, taxa_no_show = 2.44
WHERE sdr_id = '11111111-0001-0001-0001-000000000009' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 152, reunioes_realizadas = 48, no_shows = 8, taxa_no_show = 5.26
WHERE sdr_id = '11111111-0001-0001-0001-000000000010' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 142, reunioes_realizadas = 42, no_shows = 6, taxa_no_show = 4.23
WHERE sdr_id = '11111111-0001-0001-0001-000000000008' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 98, reunioes_realizadas = 28, no_shows = 2, taxa_no_show = 2.04
WHERE sdr_id = '11111111-0001-0001-0001-000000000007' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 85, reunioes_realizadas = 22, no_shows = 5, taxa_no_show = 5.88
WHERE sdr_id = '11111111-0001-0001-0001-000000000012' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 78, reunioes_realizadas = 18, no_shows = 3, taxa_no_show = 3.85
WHERE sdr_id = '11111111-0001-0001-0001-000000000004' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 65, reunioes_realizadas = 15, no_shows = 3, taxa_no_show = 4.62
WHERE sdr_id = '11111111-0001-0001-0001-000000000006' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 52, reunioes_realizadas = 12, no_shows = 2, taxa_no_show = 3.85
WHERE sdr_id = '11111111-0001-0001-0001-000000000005' AND ano_mes = '2025-11';

UPDATE sdr_month_kpi SET reunioes_agendadas = 45, reunioes_realizadas = 10, no_shows = 0, taxa_no_show = 0
WHERE sdr_id = '11111111-0001-0001-0001-000000000013' AND ano_mes = '2025-11';