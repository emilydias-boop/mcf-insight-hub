-- Criar tabela de custos diários (ads via Make)
CREATE TABLE daily_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  cost_type TEXT NOT NULL DEFAULT 'ads',
  source TEXT DEFAULT 'facebook',
  amount NUMERIC NOT NULL DEFAULT 0,
  campaign_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, cost_type, source)
);

-- Criar tabela de custos operacionais mensais (manual)
CREATE TABLE operational_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  cost_type TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_recurring BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, cost_type)
);

-- Adicionar trigger para updated_at
CREATE TRIGGER update_daily_costs_updated_at
BEFORE UPDATE ON daily_costs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operational_costs_updated_at
BEFORE UPDATE ON operational_costs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RLS para daily_costs
ALTER TABLE daily_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view costs"
ON daily_costs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert costs"
ON daily_costs FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Managers can update costs"
ON daily_costs FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete costs"
ON daily_costs FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- RLS para operational_costs
ALTER TABLE operational_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view operational costs"
ON operational_costs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Managers can manage operational costs"
ON operational_costs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

-- Habilitar realtime para weekly_metrics
ALTER TABLE weekly_metrics REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE weekly_metrics;