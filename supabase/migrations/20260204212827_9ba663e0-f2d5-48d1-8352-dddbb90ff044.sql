-- 1. Adicionar coluna stage_moved_at
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS stage_moved_at TIMESTAMP WITH TIME ZONE;

-- 2. Preencher dados existentes
UPDATE crm_deals 
SET stage_moved_at = COALESCE(updated_at, created_at) 
WHERE stage_moved_at IS NULL;

-- 3. Definir default para novos registros
ALTER TABLE crm_deals 
ALTER COLUMN stage_moved_at SET DEFAULT NOW();

-- 4. Criar índice para performance na ordenação
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage_moved_at 
ON crm_deals(stage_moved_at DESC NULLS LAST);