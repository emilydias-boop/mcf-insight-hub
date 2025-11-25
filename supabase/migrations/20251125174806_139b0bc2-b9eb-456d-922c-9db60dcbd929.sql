-- Tabela de métricas semanais (78 semanas de dados históricos)
CREATE TABLE IF NOT EXISTS public.weekly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL,
  end_date date NOT NULL,
  week_label text NOT NULL,
  
  -- Custos
  ads_cost numeric DEFAULT 0,
  team_cost numeric DEFAULT 0,
  office_cost numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  
  -- Vendas A010
  a010_revenue numeric DEFAULT 0,
  a010_sales integer DEFAULT 0,
  sdr_ia_ig integer DEFAULT 0,
  
  -- Order Bumps
  ob_construir_revenue numeric DEFAULT 0,
  ob_construir_sales integer DEFAULT 0,
  ob_vitalicio_revenue numeric DEFAULT 0,
  ob_vitalicio_sales integer DEFAULT 0,
  ob_evento_revenue numeric DEFAULT 0,
  ob_evento_sales integer DEFAULT 0,
  
  -- Contratos
  contract_revenue numeric DEFAULT 0,
  contract_sales integer DEFAULT 0,
  
  -- Clint
  ultrameta_clint numeric DEFAULT 0,
  clint_revenue numeric DEFAULT 0,
  incorporador_50k numeric DEFAULT 0,
  
  -- Métricas calculadas
  roi numeric DEFAULT 0,
  roas numeric DEFAULT 0,
  cpl numeric DEFAULT 0,
  cplr numeric DEFAULT 0,
  
  -- Funil (8 etapas)
  stage_01_target integer DEFAULT 0,
  stage_01_actual integer DEFAULT 0,
  stage_01_rate numeric DEFAULT 0,
  
  stage_02_target integer DEFAULT 0,
  stage_02_actual integer DEFAULT 0,
  stage_02_rate numeric DEFAULT 0,
  
  stage_03_target integer DEFAULT 0,
  stage_03_actual integer DEFAULT 0,
  stage_03_rate numeric DEFAULT 0,
  
  stage_04_target integer DEFAULT 0,
  stage_04_actual integer DEFAULT 0,
  stage_04_rate numeric DEFAULT 0,
  
  stage_05_target integer DEFAULT 0,
  stage_05_actual integer DEFAULT 0,
  stage_05_rate numeric DEFAULT 0,
  
  stage_06_target integer DEFAULT 0,
  stage_06_actual integer DEFAULT 0,
  stage_06_rate numeric DEFAULT 0,
  
  stage_07_target integer DEFAULT 0,
  stage_07_actual integer DEFAULT 0,
  stage_07_rate numeric DEFAULT 0,
  
  stage_08_target integer DEFAULT 0,
  stage_08_actual integer DEFAULT 0,
  stage_08_rate numeric DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(start_date, end_date)
);

-- Tabela de transações da Hubla
CREATE TABLE IF NOT EXISTS public.hubla_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hubla_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  
  -- Produto
  product_name text NOT NULL,
  product_type text,
  product_code text,
  product_category text,
  product_price numeric DEFAULT 0,
  
  -- Cliente
  customer_name text,
  customer_email text,
  customer_phone text,
  
  -- Venda
  sale_status text DEFAULT 'completed',
  payment_method text,
  sale_date timestamptz NOT NULL,
  
  -- UTMs
  utm_source text,
  utm_medium text,
  utm_campaign text,
  
  -- Dados completos
  raw_data jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de logs dos webhooks
CREATE TABLE IF NOT EXISTS public.hubla_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Tabela de comissões dos closers
CREATE TABLE IF NOT EXISTS public.closer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_name text NOT NULL,
  level integer NOT NULL,
  lead_type text NOT NULL CHECK (lead_type IN ('AAA', 'A', 'B', 'C')),
  commission_rate numeric NOT NULL,
  fixed_salary numeric DEFAULT 5000,
  quantity_leads integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(closer_name, level, lead_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_weekly_metrics_dates ON public.weekly_metrics(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_date ON public.hubla_transactions(sale_date);
CREATE INDEX IF NOT EXISTS idx_hubla_transactions_category ON public.hubla_transactions(product_category);
CREATE INDEX IF NOT EXISTS idx_hubla_webhook_logs_status ON public.hubla_webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_hubla_webhook_logs_created ON public.hubla_webhook_logs(created_at);

-- RLS Policies
ALTER TABLE public.weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubla_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubla_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closer_commissions ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver métricas semanais
CREATE POLICY "Authenticated users can view weekly metrics"
  ON public.weekly_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Managers e admins podem gerenciar métricas
CREATE POLICY "Managers can manage weekly metrics"
  ON public.weekly_metrics FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Todos autenticados podem ver transações Hubla
CREATE POLICY "Authenticated users can view hubla transactions"
  ON public.hubla_transactions FOR SELECT
  TO authenticated
  USING (true);

-- Sistema pode inserir transações Hubla
CREATE POLICY "System can insert hubla transactions"
  ON public.hubla_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins podem ver logs de webhook
CREATE POLICY "Admins can view webhook logs"
  ON public.hubla_webhook_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Sistema pode inserir logs de webhook
CREATE POLICY "System can insert webhook logs"
  ON public.hubla_webhook_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Todos autenticados podem ver comissões
CREATE POLICY "Authenticated users can view commissions"
  ON public.closer_commissions FOR SELECT
  TO authenticated
  USING (true);

-- Admins podem gerenciar comissões
CREATE POLICY "Admins can manage commissions"
  ON public.closer_commissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));