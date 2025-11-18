-- Criar tabela de preferências do dashboard
CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
  visible_widgets TEXT[] DEFAULT ARRAY[
    'kpis', 
    'ultrameta', 
    'funil-a010', 
    'funil-instagram', 
    'resumo-financeiro',
    'grafico-evolucao'
  ] NOT NULL,
  widgets_order TEXT[] DEFAULT ARRAY[
    'kpis', 
    'ultrameta', 
    'funil-a010', 
    'funil-instagram', 
    'resumo-financeiro',
    'grafico-evolucao'
  ] NOT NULL,
  default_period TEXT DEFAULT 'mes' NOT NULL,
  default_canal TEXT DEFAULT 'todos' NOT NULL,
  auto_refresh BOOLEAN DEFAULT FALSE NOT NULL,
  refresh_interval INTEGER DEFAULT 60 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own preferences"
  ON dashboard_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON dashboard_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON dashboard_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON dashboard_preferences(user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_dashboard_preferences_updated_at
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();