-- Promote Thayna to Closer Inside N3 in April/2026
UPDATE public.sdr_comp_plan
SET cargo_catalogo_id = 'd7bdc06e-d63a-49b8-9ccc-c9c8f06aa037',
    updated_at = now()
WHERE sdr_id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2'
  AND vigencia_inicio = '2026-04-01'
  AND status = 'APPROVED';

-- Sync DRAFT payout to N3 so metrics resolve to 40%
UPDATE public.sdr_month_payout
SET cargo_vigente = 'Closer Inside N3',
    nivel_vigente = 3,
    cargo_catalogo_id_fechamento = 'd7bdc06e-d63a-49b8-9ccc-c9c8f06aa037',
    updated_at = now()
WHERE id = '2eb63f95-4c72-4da6-bf47-0b8522518764';