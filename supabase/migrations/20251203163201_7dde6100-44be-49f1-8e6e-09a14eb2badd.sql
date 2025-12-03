-- 1. Adicionar campo email na tabela SDR
ALTER TABLE sdr ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Popular emails dos 13 SDRs
UPDATE sdr SET email = 'julia.caroline@minhacasafinanciada.com' WHERE name = 'Julia Caroline';
UPDATE sdr SET email = 'carol.correa@minhacasafinanciada.com' WHERE name = 'Carol Correa';
UPDATE sdr SET email = 'fernanda.pires@minhacasafinanciada.com' WHERE name = 'Fernanda Pires';
UPDATE sdr SET email = 'andressa.carvalho@minhacasafinanciada.com' WHERE name = 'Andressa Carvalho';
UPDATE sdr SET email = 'thalia.ferreira@minhacasafinanciada.com' WHERE name = 'Thalia Ferreira';
UPDATE sdr SET email = 'yasmim.souza@minhacasafinanciada.com' WHERE name = 'Yasmim Souza';
UPDATE sdr SET email = 'amanda.siqueira@minhacasafinanciada.com' WHERE name = 'Amanda Siqueira';
UPDATE sdr SET email = 'laryssa.silva@minhacasafinanciada.com' WHERE name = 'Laryssa Silva';
UPDATE sdr SET email = 'deyse.mira@minhacasafinanciada.com' WHERE name = 'Deyse Mira';
UPDATE sdr SET email = 'anna.clara@minhacasafinanciada.com' WHERE name = 'Anna Clara';
UPDATE sdr SET email = 'giovanna.felix@minhacasafinanciada.com' WHERE name = 'Giovanna Felix';
UPDATE sdr SET email = 'giovanna.goncalves@minhacasafinanciada.com' WHERE name = 'Giovanna Gonçalves';
UPDATE sdr SET email = 'julia.mariano@minhacasafinanciada.com' WHERE name = 'Julia Mariano';

-- 3. Atualizar KPIs de Novembro 2025 com dados reais do Bubble + Webhook
-- Julia Caroline: 215 R1 Agendada, 9 No-Show, 95 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 215, no_shows = 9, reunioes_realizadas = 95,
    taxa_no_show = ROUND((9::numeric / NULLIF(215, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Julia Caroline')
  AND ano_mes = '2025-11';

-- Carol Correa: 165 R1 Agendada, 5 No-Show, 68 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 165, no_shows = 5, reunioes_realizadas = 68,
    taxa_no_show = ROUND((5::numeric / NULLIF(165, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Carol Correa')
  AND ano_mes = '2025-11';

-- Fernanda Pires: 145 R1 Agendada, 7 No-Show, 52 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 145, no_shows = 7, reunioes_realizadas = 52,
    taxa_no_show = ROUND((7::numeric / NULLIF(145, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Fernanda Pires')
  AND ano_mes = '2025-11';

-- Andressa Carvalho: 128 R1 Agendada, 4 No-Show, 48 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 128, no_shows = 4, reunioes_realizadas = 48,
    taxa_no_show = ROUND((4::numeric / NULLIF(128, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Andressa Carvalho')
  AND ano_mes = '2025-11';

-- Thalia Ferreira: 112 R1 Agendada, 3 No-Show, 42 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 112, no_shows = 3, reunioes_realizadas = 42,
    taxa_no_show = ROUND((3::numeric / NULLIF(112, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Thalia Ferreira')
  AND ano_mes = '2025-11';

-- Yasmim Souza: 98 R1 Agendada, 2 No-Show, 38 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 98, no_shows = 2, reunioes_realizadas = 38,
    taxa_no_show = ROUND((2::numeric / NULLIF(98, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Yasmim Souza')
  AND ano_mes = '2025-11';

-- Amanda Siqueira: 85 R1 Agendada, 4 No-Show, 32 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 85, no_shows = 4, reunioes_realizadas = 32,
    taxa_no_show = ROUND((4::numeric / NULLIF(85, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Amanda Siqueira')
  AND ano_mes = '2025-11';

-- Laryssa Silva: 72 R1 Agendada, 3 No-Show, 28 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 72, no_shows = 3, reunioes_realizadas = 28,
    taxa_no_show = ROUND((3::numeric / NULLIF(72, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Laryssa Silva')
  AND ano_mes = '2025-11';

-- Deyse Mira: 65 R1 Agendada, 2 No-Show, 25 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 65, no_shows = 2, reunioes_realizadas = 25,
    taxa_no_show = ROUND((2::numeric / NULLIF(65, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Deyse Mira')
  AND ano_mes = '2025-11';

-- Anna Clara: 58 R1 Agendada, 1 No-Show, 22 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 58, no_shows = 1, reunioes_realizadas = 22,
    taxa_no_show = ROUND((1::numeric / NULLIF(58, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Anna Clara')
  AND ano_mes = '2025-11';

-- Giovanna Felix: 45 R1 Agendada, 2 No-Show, 18 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 45, no_shows = 2, reunioes_realizadas = 18,
    taxa_no_show = ROUND((2::numeric / NULLIF(45, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Giovanna Felix')
  AND ano_mes = '2025-11';

-- Giovanna Gonçalves: 38 R1 Agendada, 1 No-Show, 15 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 38, no_shows = 1, reunioes_realizadas = 15,
    taxa_no_show = ROUND((1::numeric / NULLIF(38, 0)) * 100, 2)
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Giovanna Gonçalves')
  AND ano_mes = '2025-11';

-- Julia Mariano: 32 R1 Agendada, 0 No-Show, 12 R1 Realizada
UPDATE sdr_month_kpi 
SET reunioes_agendadas = 32, no_shows = 0, reunioes_realizadas = 12,
    taxa_no_show = 0
WHERE sdr_id = (SELECT id FROM sdr WHERE name = 'Julia Mariano')
  AND ano_mes = '2025-11';