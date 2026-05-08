
-- 1) employee_cargo_history: ajustar transição N1 → N2 para 01/04/2026
UPDATE public.employee_cargo_history
SET valid_to = '2026-03-31'
WHERE id = '4c169b04-3fb6-46bc-97dd-f9f4c1582ae2';

UPDATE public.employee_cargo_history
SET valid_from = '2026-04-01',
    motivo = COALESCE(motivo,'') || ' (retroagido para 2026-04-01)'
WHERE id = 'f799954b-2f7a-4c27-b373-951a4b7c61ba';

-- 2) sdr_comp_plan abril/2026 → N2
UPDATE public.sdr_comp_plan
SET cargo_catalogo_id = 'cc8581d7-5107-48d4-bf88-7d698b990630',
    ote_total = 8000,
    fixo_valor = 5600,
    variavel_total = 2400,
    updated_at = now()
WHERE id = '9e7dc52e-fb00-410b-aad7-9f6050d58c98';

-- 3) sdr_month_payout abril/2026 → cargo/nivel N2 (fechamento congelado)
UPDATE public.sdr_month_payout
SET cargo_vigente = 'Closer Consórcio 2',
    nivel_vigente = 2,
    cargo_catalogo_id_fechamento = 'cc8581d7-5107-48d4-bf88-7d698b990630',
    updated_at = now()
WHERE id = '5f42aac7-66dd-4a96-a5e4-5557c10abdba';
