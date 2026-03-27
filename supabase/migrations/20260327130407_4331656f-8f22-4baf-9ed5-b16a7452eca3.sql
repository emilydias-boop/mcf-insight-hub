ALTER TABLE cargos_catalogo
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS competencias_essenciais TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competencias_tecnicas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS documentos_padrao TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trilha_pdi TEXT;