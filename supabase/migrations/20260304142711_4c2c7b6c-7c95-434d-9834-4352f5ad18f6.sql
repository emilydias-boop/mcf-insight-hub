
-- Fix Feb 2026 comp_plans: Leticia N2→N1, Carol Correa N3→N2, and correct meta_reunioes_agendadas for all
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed',
  ote_total = 4000, fixo_valor = 2800, variavel_total = 1200,
  meta_reunioes_agendadas = 119, dias_uteis = 17, updated_at = now()
WHERE id = '10cb1b8c-0a98-4406-b30e-ba0a5da37579';

UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad',
  ote_total = 4500, fixo_valor = 3150, variavel_total = 1350,
  meta_reunioes_agendadas = 153, dias_uteis = 17, updated_at = now()
WHERE id = '6341c886-8294-4871-84ad-7e5c3d571a85';

UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17, updated_at = now() WHERE id = '10b6eafd-c107-4b4d-8f4b-f214efe8ab1e';
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 119, dias_uteis = 17, updated_at = now() WHERE id = 'a3b2e017-042c-4b25-a4d6-96d025b71f80';
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 119, dias_uteis = 17, updated_at = now() WHERE id = '31cf599c-a81a-419c-af13-e7cd2249513b';
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 153, dias_uteis = 17, updated_at = now() WHERE id = 'f3c3bcde-7343-4154-a05b-a4f1b8b338e6';
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17, updated_at = now() WHERE id = '36dbdec5-fa82-417d-b5af-33bdb44c43db';
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17, updated_at = now() WHERE id = 'acc8a9b9-260c-467c-b303-1cfc8a4a48e4';
