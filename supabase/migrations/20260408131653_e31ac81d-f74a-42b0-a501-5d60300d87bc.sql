
-- Part 1: Update meta_percentual on existing March metrics
UPDATE fechamento_metricas_mes SET meta_percentual = 30 WHERE id = '19645a2a-dc9b-4ffd-822f-4026fb7e65eb';
UPDATE fechamento_metricas_mes SET meta_percentual = 35 WHERE id = '5dd6255b-87e7-40ac-9b17-c66ddab3863e';

-- Part 1b: Create metrics for Closer N3 (d7bdc06e) in March
INSERT INTO fechamento_metricas_mes (ano_mes, cargo_catalogo_id, squad, nome_metrica, label_exibicao, peso_percentual, meta_percentual, ativo)
VALUES 
  ('2026-03', 'd7bdc06e-d63a-49b8-9ccc-c9c8f06aa037', 'incorporador', 'contratos', 'Contratos Pagos', 50, 40, true),
  ('2026-03', 'd7bdc06e-d63a-49b8-9ccc-c9c8f06aa037', 'incorporador', 'r2_agendadas', 'R2 Agendadas', 50, null, true);

-- Part 2a: Julio - close current plan, create N2 for March, restore N1 for April
UPDATE sdr_comp_plan SET vigencia_fim = '2026-02-28' WHERE id = 'de2fcb55-78e2-4e94-89f9-df942342f5d2';

INSERT INTO sdr_comp_plan (sdr_id, vigencia_inicio, vigencia_fim, ote_total, fixo_valor, variavel_total, valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao, ifood_mensal, ifood_ultrameta, meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao, dias_uteis, meta_no_show_pct, status)
VALUES 
  -- Julio N2 March
  ('21393c7b-faa7-42e2-b1d8-920e3a808b33', '2026-03-01', '2026-03-31', 8000, 5600, 2400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22, 30, 'APPROVED'),
  -- Julio N1 April restore
  ('21393c7b-faa7-42e2-b1d8-920e3a808b33', '2026-04-01', null, 7000, 4900, 2100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22, 30, 'APPROVED');

-- Part 2b: Thayna - close current plan, create N3 for March, restore N2 for April
UPDATE sdr_comp_plan SET vigencia_fim = '2026-02-28' WHERE id = '486d6384-34c2-4eee-89f5-447e2c50c1f4';

INSERT INTO sdr_comp_plan (sdr_id, vigencia_inicio, vigencia_fim, ote_total, fixo_valor, variavel_total, valor_meta_rpg, valor_docs_reuniao, valor_tentativas, valor_organizacao, ifood_mensal, ifood_ultrameta, meta_reunioes_agendadas, meta_reunioes_realizadas, meta_tentativas, meta_organizacao, dias_uteis, meta_no_show_pct, status)
VALUES 
  -- Thayna N3 March
  ('66a5a9ea-6d48-4831-b91c-7d79cf00aac2', '2026-03-01', '2026-03-31', 9000, 6300, 2700, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22, 30, 'APPROVED'),
  -- Thayna N2 April restore
  ('66a5a9ea-6d48-4831-b91c-7d79cf00aac2', '2026-04-01', null, 8000, 5600, 2400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 22, 30, 'APPROVED');
