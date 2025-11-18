-- Criar tabela de alertas em tempo real
CREATE TABLE IF NOT EXISTS alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT CHECK (tipo IN ('critico', 'aviso', 'info')) NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  lido BOOLEAN DEFAULT FALSE NOT NULL,
  resolvido BOOLEAN DEFAULT FALSE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own alerts"
  ON alertas FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert alerts"
  ON alertas FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own alerts"
  ON alertas FOR UPDATE
  USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_alertas_user_id ON alertas(user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido);
CREATE INDEX IF NOT EXISTS idx_alertas_created_at ON alertas(created_at DESC);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE alertas;