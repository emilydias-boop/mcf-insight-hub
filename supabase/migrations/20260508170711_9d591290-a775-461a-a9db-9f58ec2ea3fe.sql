-- Corrige payout do William Ferreira (abril/2026) que ficou com valores antigos
-- (cargo Closer Consórcio R$4.009) após backfill do cargo correto (Closer Inside N1 R$4.900).
-- O recalc automático pula APPROVED, então fazemos a correção pontual aqui.

UPDATE public.sdr_month_payout p
SET 
  cargo_vigente = 'Closer Inside N1',
  valor_fixo = 4900,
  valor_variavel_total = 2100,
  total_conta = 7000,
  updated_at = now()
FROM public.sdr s
WHERE p.sdr_id = s.id
  AND s.name ILIKE '%William%Ferreira%'
  AND p.ano_mes = '2026-04';