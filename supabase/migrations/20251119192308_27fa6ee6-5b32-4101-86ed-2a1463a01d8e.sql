-- Criar tabela de grupos do CRM
CREATE TABLE IF NOT EXISTS crm_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clint_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_crm_groups_clint_id ON crm_groups(clint_id);

-- Adicionar coluna group_id em crm_origins
ALTER TABLE crm_origins 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES crm_groups(id);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_crm_origins_group_id ON crm_origins(group_id);

-- RLS policies para crm_groups
ALTER TABLE crm_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups"
  ON crm_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers e admins podem gerenciar grupos"
  ON crm_groups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_crm_groups_updated_at
  BEFORE UPDATE ON crm_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();