-- Adicionar coluna source para identificar origem (hubla ou kiwify)
ALTER TABLE hubla_transactions 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'hubla';

-- Atualizar registros existentes
UPDATE hubla_transactions SET source = 'hubla' WHERE source IS NULL;

-- Criar índice para performance em filtros
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_source ON hubla_transactions(source);