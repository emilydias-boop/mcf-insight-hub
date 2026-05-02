-- 1. Criar registro sdr (Closer) para William Ferreira
INSERT INTO public.sdr (id, name, email, role_type, squad, active, nivel, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'William Ferreira',
  'william.ferreira@minhacasafinanciada.com',
  'closer',
  'incorporador',
  true,
  1,
  now(),
  now()
)
ON CONFLICT DO NOTHING;

-- 2. Vincular employee ao novo sdr
UPDATE public.employees
SET sdr_id = (SELECT id FROM public.sdr WHERE LOWER(email) = 'william.ferreira@minhacasafinanciada.com' LIMIT 1)
WHERE id = 'e979aa3f-dead-45ad-bda7-6428d82cc1f5'
  AND sdr_id IS NULL;

-- 3. Limpar e recriar histórico de cargo:
-- Backfill criou um segmento desde 2025-04-10 (data_admissao). Vamos ajustar para que o
-- segmento como Closer Inside N1 comece em 2026-04-07 (data efetiva da promoção a Closer).
-- O período anterior fica sem cargo registrado (4 dias úteis 01-06/04 ficam fora do fechamento de abril).
DELETE FROM public.employee_cargo_history
WHERE employee_id = 'e979aa3f-dead-45ad-bda7-6428d82cc1f5';

INSERT INTO public.employee_cargo_history (employee_id, cargo_catalogo_id, valid_from, valid_to, motivo)
VALUES (
  'e979aa3f-dead-45ad-bda7-6428d82cc1f5',
  'c2909e20-3bfc-4a9f-853f-97f065af099a',
  '2026-04-07'::date,
  NULL,
  'Promoção a Closer Inside N1 (vindo de Gerente de Relacionamento)'
);