-- Adicionar coluna is_favorite na tabela crm_groups
ALTER TABLE public.crm_groups 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Criar índice para ordenação por favoritos
CREATE INDEX IF NOT EXISTS idx_crm_groups_is_favorite ON public.crm_groups(is_favorite DESC, name ASC);