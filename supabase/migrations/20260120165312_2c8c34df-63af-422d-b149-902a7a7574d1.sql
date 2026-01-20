-- Criar comp_plans para os novos closers que ainda não têm
INSERT INTO sdr_comp_plan (sdr_id, vigencia_inicio, fixo_valor, variavel_total, ote_total, 
  valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao,
  meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao, meta_no_show_pct,
  ifood_mensal, ifood_ultrameta, dias_uteis, status)
SELECT 
  s.id, 
  '2025-11-01'::date,
  2800, 1200, 4000,
  300, 300, 300, 300,
  40, 30, 300, 100, 30,
  630, 840, 22, 'active'
FROM sdr s
WHERE s.role_type = 'closer'
AND s.active = true
AND NOT EXISTS (
  SELECT 1 FROM sdr_comp_plan scp 
  WHERE scp.sdr_id = s.id AND scp.vigencia_inicio = '2025-11-01'
);