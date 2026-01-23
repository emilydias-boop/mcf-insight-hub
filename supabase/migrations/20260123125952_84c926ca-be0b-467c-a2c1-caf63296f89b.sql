-- Adicionar campo para guardar SDR original (antes de transferir para closer)
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS original_sdr_email TEXT;

-- Comentário para documentação
COMMENT ON COLUMN crm_deals.original_sdr_email IS 'Email do SDR original antes da transferência de ownership para o Closer. Preservado para métricas de conversão.';