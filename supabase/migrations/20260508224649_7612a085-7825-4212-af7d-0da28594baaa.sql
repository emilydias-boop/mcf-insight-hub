UPDATE public.sdr_comp_plan
SET cargo_catalogo_id = 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563',
    updated_at = now()
WHERE sdr_id = '21393c7b-faa7-42e2-b1d8-920e3a808b33'
  AND vigencia_inicio = '2026-04-01'
  AND status = 'APPROVED';

UPDATE public.sdr_month_payout
SET cargo_vigente = 'Closer Inside N2',
    nivel_vigente = 2,
    cargo_catalogo_id_fechamento = 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563',
    status = 'DRAFT',
    updated_at = now()
WHERE id = 'db16a333-4f0f-4f8d-84cd-65e15eb6bdee';