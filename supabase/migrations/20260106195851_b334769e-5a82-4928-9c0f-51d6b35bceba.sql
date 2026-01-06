-- Adicionar colunas para metas ajustadas no sdr_month_payout
ALTER TABLE sdr_month_payout 
ADD COLUMN IF NOT EXISTS meta_agendadas_ajustada INTEGER,
ADD COLUMN IF NOT EXISTS meta_realizadas_ajustada INTEGER,
ADD COLUMN IF NOT EXISTS meta_tentativas_ajustada INTEGER,
ADD COLUMN IF NOT EXISTS dias_uteis_mes INTEGER;