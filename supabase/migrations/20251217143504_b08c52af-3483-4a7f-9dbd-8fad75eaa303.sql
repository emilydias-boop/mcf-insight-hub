-- Adicionar novos campos na tabela employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS squad text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES employees(id);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS observacao_geral text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tipo_variavel text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS descricao_comissao text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ote_mensal numeric DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS modelo_fechamento text;

-- Criar tabela rh_nfse para controle de notas fiscais (PJ)
CREATE TABLE IF NOT EXISTS rh_nfse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano integer NOT NULL,
  numero_nfse text,
  valor_nfse numeric NOT NULL DEFAULT 0,
  arquivo_url text,
  storage_path text,
  data_envio_nfse date,
  status_nfse text DEFAULT 'pendente_envio',
  status_pagamento text DEFAULT 'pendente',
  data_pagamento date,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- RLS para rh_nfse (somente Admin/RH)
ALTER TABLE rh_nfse ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RH e Admin podem gerenciar NFSe" ON rh_nfse;
CREATE POLICY "RH e Admin podem gerenciar NFSe" ON rh_nfse FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rh'::app_role));

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_rh_nfse_updated_at
  BEFORE UPDATE ON rh_nfse
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();