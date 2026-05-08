-- Corrige nível/cargo da Thaynar Tavares: ela é Closer Inside N3 (fixo 6300, variável 2700, OTE 9000)
-- 1) Atualiza sdr.nivel global para refletir o cargo real
UPDATE public.sdr
SET nivel = 3, updated_at = now()
WHERE id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2';

-- 2) Atualiza o comp_plan vigente a partir de 2026-04-01 para os valores de N3
UPDATE public.sdr_comp_plan
SET ote_total = 9000,
    fixo_valor = 6300,
    variavel_total = 2700,
    updated_at = now()
WHERE id = 'c9761f11-27a0-4cbb-a327-77675aa46bc3';

-- 3) Atualiza o payout de abril/2026 — fixo N3 e variável proporcional ao % de atingimento já calculado
-- valor_variavel_total atual: 1680 sobre meta 2400 = 70% → 70% de 2700 = 1890
UPDATE public.sdr_month_payout
SET cargo_vigente = 'Closer Inside N3',
    valor_fixo = 6300,
    valor_variavel_total = 1890,
    total_conta = 6300 + 1890,
    updated_at = now()
WHERE sdr_id = '66a5a9ea-6d48-4831-b91c-7d79cf00aac2'
  AND ano_mes = '2026-04';