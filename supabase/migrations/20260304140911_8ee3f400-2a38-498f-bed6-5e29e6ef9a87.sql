
-- Fix Feb 2026 comp_plans that were retroactively created in March with N2 values
-- These should be N1 (SDR Inside N1: OTE 4000, Fixo 2800, Var 1200)
UPDATE sdr_comp_plan 
SET cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed',
    ote_total = 4000, 
    fixo_valor = 2800, 
    variavel_total = 1200,
    updated_at = now()
WHERE id IN (
  '10b6eafd-c107-4b4d-8f4b-f214efe8ab1e', -- Juliana Rodrigues
  'f3c3bcde-7343-4154-a05b-a4f1b8b338e6', -- Julia Caroline
  'a3b2e017-042c-4b25-a4d6-96d025b71f80', -- Antony Elias
  '31cf599c-a81a-419c-af13-e7cd2249513b'  -- Carol Souza
);
