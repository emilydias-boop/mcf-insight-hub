-- Adicionar coluna origin_id para relacionar stages com suas origins
ALTER TABLE crm_stages 
ADD COLUMN IF NOT EXISTS origin_id UUID REFERENCES crm_origins(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_crm_stages_origin_id ON crm_stages(origin_id);

-- Comentário explicativo
COMMENT ON COLUMN crm_stages.origin_id IS 'ID da origin (funil) a qual este estágio pertence';