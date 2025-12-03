-- Corrigir período de 2024-11 para 2025-11

-- Atualizar sdr_comp_plan
UPDATE sdr_comp_plan 
SET vigencia_inicio = '2025-11-01',
    vigencia_fim = '2025-11-30'
WHERE vigencia_inicio = '2024-11-01';

-- Atualizar sdr_month_kpi
UPDATE sdr_month_kpi 
SET ano_mes = '2025-11'
WHERE ano_mes = '2024-11';

-- Atualizar sdr_month_payout
UPDATE sdr_month_payout 
SET ano_mes = '2025-11'
WHERE ano_mes = '2024-11';