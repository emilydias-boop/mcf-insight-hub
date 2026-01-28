-- Tabela de métricas ativas por mês/cargo
CREATE TABLE IF NOT EXISTS fechamento_metricas_mes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL,
  cargo_catalogo_id UUID REFERENCES cargos_catalogo(id),
  squad TEXT,
  nome_metrica TEXT NOT NULL,
  label_exibicao TEXT NOT NULL,
  peso_percentual NUMERIC(5,2) DEFAULT 25,
  meta_valor NUMERIC,
  fonte_dados TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ano_mes, cargo_catalogo_id, squad, nome_metrica)
);

-- Habilitar RLS
ALTER TABLE fechamento_metricas_mes ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Authenticated users can read metrics" 
  ON fechamento_metricas_mes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Managers can manage metrics" 
  ON fechamento_metricas_mes FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('admin', 'manager')
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_fechamento_metricas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fechamento_metricas_mes_updated_at
  BEFORE UPDATE ON fechamento_metricas_mes
  FOR EACH ROW
  EXECUTE FUNCTION update_fechamento_metricas_updated_at();