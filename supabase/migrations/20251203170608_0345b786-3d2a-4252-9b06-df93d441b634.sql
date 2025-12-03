-- Criar constraints únicas para permitir upsert
CREATE UNIQUE INDEX IF NOT EXISTS sdr_comp_plan_sdr_vigencia_idx ON sdr_comp_plan(sdr_id, vigencia_inicio);
CREATE UNIQUE INDEX IF NOT EXISTS sdr_month_kpi_sdr_ano_mes_idx ON sdr_month_kpi(sdr_id, ano_mes);
CREATE UNIQUE INDEX IF NOT EXISTS sdr_month_payout_sdr_ano_mes_idx ON sdr_month_payout(sdr_id, ano_mes);