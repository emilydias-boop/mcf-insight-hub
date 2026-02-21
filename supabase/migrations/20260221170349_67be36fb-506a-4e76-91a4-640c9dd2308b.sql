
-- Parte 1: Adicionar colunas offer_name e offer_id
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS offer_name TEXT;
ALTER TABLE hubla_transactions ADD COLUMN IF NOT EXISTS offer_id TEXT;

-- Índice para buscas por offer_id
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_offer_id ON hubla_transactions(offer_id);

-- Parte 2: Backfill histórico dos registros com groupId no raw_data
UPDATE hubla_transactions
SET 
  offer_id = raw_data->'event'->>'groupId',
  offer_name = 'Contrato - Curso R$ 97,00'
WHERE raw_data->'event'->>'groupId' = 'pgah16gjTMdAkqUMVKGz'
  AND offer_id IS NULL;
