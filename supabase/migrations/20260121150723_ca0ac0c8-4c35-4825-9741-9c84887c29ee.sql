-- Adicionar coluna max_leads_per_slot na tabela closers para configurar limite de leads por slot R2
ALTER TABLE closers ADD COLUMN IF NOT EXISTS max_leads_per_slot INTEGER DEFAULT 4;

-- Comentário explicativo
COMMENT ON COLUMN closers.max_leads_per_slot IS 'Número máximo de leads permitidos por slot de reunião R2 (padrão: 4)';