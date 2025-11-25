-- Adicionar campos calculados em weekly_metrics
ALTER TABLE weekly_metrics
ADD COLUMN IF NOT EXISTS total_revenue numeric GENERATED ALWAYS AS (
  COALESCE(a010_revenue, 0) + 
  COALESCE(ob_construir_revenue, 0) + 
  COALESCE(ob_vitalicio_revenue, 0) + 
  COALESCE(ob_evento_revenue, 0) + 
  COALESCE(contract_revenue, 0)
) STORED,
ADD COLUMN IF NOT EXISTS operating_cost numeric GENERATED ALWAYS AS (
  COALESCE(ads_cost, 0) + 
  COALESCE(team_cost, 0) + 
  COALESCE(office_cost, 0)
) STORED,
ADD COLUMN IF NOT EXISTS real_cost numeric GENERATED ALWAYS AS (
  COALESCE(ads_cost, 0) - (
    COALESCE(a010_revenue, 0) + 
    COALESCE(ob_construir_revenue, 0) + 
    COALESCE(ob_vitalicio_revenue, 0) + 
    COALESCE(ob_evento_revenue, 0)
  )
) STORED,
ADD COLUMN IF NOT EXISTS operating_profit numeric GENERATED ALWAYS AS (
  (COALESCE(a010_revenue, 0) + 
   COALESCE(ob_construir_revenue, 0) + 
   COALESCE(ob_vitalicio_revenue, 0) + 
   COALESCE(ob_evento_revenue, 0) + 
   COALESCE(contract_revenue, 0)) - 
  (COALESCE(ads_cost, 0) + 
   COALESCE(team_cost, 0) + 
   COALESCE(office_cost, 0))
) STORED;

-- Criar tabela de leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_date date NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  origin text,
  status text DEFAULT 'novo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de distribuição de leads
CREATE TABLE IF NOT EXISTS lead_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  sdr_name text NOT NULL,
  assigned_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Criar tabela de acompanhamento de leads
CREATE TABLE IF NOT EXISTS lead_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  perfil text,
  status text,
  closer text,
  produto_final text,
  dias_compra integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de metas do incorporador
CREATE TABLE IF NOT EXISTS incorporator_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  supermeta numeric,
  meta numeric,
  resultado numeric,
  efeito_alavanca numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(month)
);

-- Criar tabela de pagamentos de consórcio
CREATE TABLE IF NOT EXISTS consortium_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text,
  consorciado text NOT NULL,
  contrato text,
  parcela integer,
  valor_comissao numeric,
  data_interface date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS policies para leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage leads"
  ON leads FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies para lead_assignments
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view assignments"
  ON lead_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage assignments"
  ON lead_assignments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies para lead_tracking
ALTER TABLE lead_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tracking"
  ON lead_tracking FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage tracking"
  ON lead_tracking FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies para incorporator_goals
ALTER TABLE incorporator_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view goals"
  ON incorporator_goals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage goals"
  ON incorporator_goals FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies para consortium_payments
ALTER TABLE consortium_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments"
  ON consortium_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers can manage payments"
  ON consortium_payments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_leads_date ON leads(lead_date);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_sdr ON lead_assignments(sdr_name);
CREATE INDEX IF NOT EXISTS idx_lead_tracking_status ON lead_tracking(status);
CREATE INDEX IF NOT EXISTS idx_incorporator_goals_month ON incorporator_goals(month);
CREATE INDEX IF NOT EXISTS idx_consortium_payments_date ON consortium_payments(data_interface);