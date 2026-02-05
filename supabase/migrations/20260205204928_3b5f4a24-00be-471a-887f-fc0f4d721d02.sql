-- Tabela de metas mensais do time
CREATE TABLE team_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_mes TEXT NOT NULL,
  bu TEXT NOT NULL DEFAULT 'incorporador',
  
  -- Níveis de meta
  meta_valor NUMERIC DEFAULT 0,
  meta_premio_ifood NUMERIC DEFAULT 0,
  
  supermeta_valor NUMERIC DEFAULT 0,
  supermeta_premio_ifood NUMERIC DEFAULT 0,
  
  ultrameta_valor NUMERIC DEFAULT 0,
  ultrameta_premio_ifood NUMERIC DEFAULT 0,
  
  meta_divina_valor NUMERIC DEFAULT 0,
  meta_divina_premio_sdr NUMERIC DEFAULT 0,
  meta_divina_premio_closer NUMERIC DEFAULT 0,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(ano_mes, bu)
);

-- Tabela de vencedores/autorizações
CREATE TABLE team_monthly_goal_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES team_monthly_goals(id) ON DELETE CASCADE,
  tipo_premio TEXT NOT NULL,
  sdr_id UUID REFERENCES sdr(id),
  valor_premio NUMERIC NOT NULL,
  autorizado BOOLEAN DEFAULT false,
  autorizado_por UUID REFERENCES auth.users(id),
  autorizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE team_monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_monthly_goal_winners ENABLE ROW LEVEL SECURITY;

-- Políticas para team_monthly_goals
CREATE POLICY "Admins can manage team_monthly_goals"
  ON team_monthly_goals FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

CREATE POLICY "All can view team_monthly_goals"
  ON team_monthly_goals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Políticas para team_monthly_goal_winners
CREATE POLICY "Admins can manage team_monthly_goal_winners"
  ON team_monthly_goal_winners FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'));

CREATE POLICY "All can view team_monthly_goal_winners"
  ON team_monthly_goal_winners FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_team_monthly_goals_updated_at
  BEFORE UPDATE ON team_monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();