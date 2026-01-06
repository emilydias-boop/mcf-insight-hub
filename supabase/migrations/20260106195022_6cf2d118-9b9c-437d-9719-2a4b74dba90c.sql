-- Vincular NFSe ao payout do SDR
ALTER TABLE sdr_month_payout 
ADD COLUMN nfse_id UUID REFERENCES rh_nfse(id);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_sdr_month_payout_nfse_id 
ON sdr_month_payout(nfse_id);