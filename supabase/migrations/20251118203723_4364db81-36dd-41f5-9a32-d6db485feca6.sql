-- Criar tabela de configuração de estágios
CREATE TABLE IF NOT EXISTS public.deal_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id text UNIQUE NOT NULL,
  stage_name text NOT NULL,
  stage_order integer NOT NULL,
  color text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Inserir estágios do pipeline
INSERT INTO public.deal_stages (stage_id, stage_name, stage_order, color) VALUES
('lead_gratuito', 'Lead Gratuito', 1, 'bg-slate-100'),
('lead_instagram', 'Lead Instagram', 2, 'bg-purple-100'),
('novo_lead', 'Novo Lead', 3, 'bg-blue-100'),
('lead_qualificado', 'Lead Qualificado', 4, 'bg-green-100'),
('reuniao_1_agendada', 'Reunião 1 Agendada', 5, 'bg-amber-100'),
('no_show', 'No-Show', 6, 'bg-orange-100'),
('r1_realizada', 'R1 Realizada', 7, 'bg-teal-100'),
('contrato_pago', 'Contrato Pago', 8, 'bg-emerald-100'),
('r2_agendada', 'R2 Agendada', 9, 'bg-cyan-100'),
('r2_realizada', 'R2 Realizada', 10, 'bg-indigo-100'),
('venda_realizada', 'Venda Realizada', 11, 'bg-green-200'),
('sem_interesse', 'Sem Interesse', 99, 'bg-gray-100'),
('perdido', 'Perdido', 100, 'bg-red-100')
ON CONFLICT (stage_id) DO NOTHING;

-- Criar tabela de permissões por role e estágio
CREATE TABLE IF NOT EXISTS public.stage_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  stage_id text NOT NULL REFERENCES public.deal_stages(stage_id),
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT true,
  can_move_from boolean DEFAULT true,
  can_move_to boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, stage_id)
);

-- Inserir permissões para SDR
INSERT INTO public.stage_permissions (role, stage_id, can_view, can_edit, can_move_from, can_move_to) VALUES
('sdr', 'lead_gratuito', true, true, true, true),
('sdr', 'lead_instagram', true, true, true, true),
('sdr', 'novo_lead', true, true, true, true),
('sdr', 'lead_qualificado', true, true, true, true),
('sdr', 'reuniao_1_agendada', true, true, true, true),
('sdr', 'no_show', true, true, true, true),
('sdr', 'sem_interesse', true, true, false, true),
('sdr', 'perdido', true, true, false, true),
('sdr', 'r1_realizada', false, false, false, false),
('sdr', 'contrato_pago', false, false, false, false),
('sdr', 'r2_agendada', false, false, false, false),
('sdr', 'r2_realizada', false, false, false, false),
('sdr', 'venda_realizada', false, false, false, false)
ON CONFLICT (role, stage_id) DO NOTHING;

-- Inserir permissões para Closer
INSERT INTO public.stage_permissions (role, stage_id, can_view, can_edit, can_move_from, can_move_to) VALUES
('closer', 'lead_gratuito', true, false, false, false),
('closer', 'lead_instagram', true, false, false, false),
('closer', 'novo_lead', true, false, false, false),
('closer', 'lead_qualificado', true, false, false, false),
('closer', 'reuniao_1_agendada', true, false, false, false),
('closer', 'no_show', true, true, true, true),
('closer', 'r1_realizada', true, true, true, true),
('closer', 'contrato_pago', true, true, true, true),
('closer', 'r2_agendada', true, true, true, true),
('closer', 'r2_realizada', true, true, true, true),
('closer', 'venda_realizada', true, true, true, true),
('closer', 'sem_interesse', true, true, false, true),
('closer', 'perdido', true, true, false, true)
ON CONFLICT (role, stage_id) DO NOTHING;

-- Permissões para Admin/Manager
INSERT INTO public.stage_permissions (role, stage_id, can_view, can_edit, can_move_from, can_move_to)
SELECT 'admin', stage_id, true, true, true, true FROM public.deal_stages
ON CONFLICT (role, stage_id) DO NOTHING;

INSERT INTO public.stage_permissions (role, stage_id, can_view, can_edit, can_move_from, can_move_to)
SELECT 'manager', stage_id, true, true, true, true FROM public.deal_stages
ON CONFLICT (role, stage_id) DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para deal_stages
DROP POLICY IF EXISTS "Anyone can view stages" ON public.deal_stages;
CREATE POLICY "Anyone can view stages" ON public.deal_stages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage stages" ON public.deal_stages;
CREATE POLICY "Admins can manage stages" ON public.deal_stages
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Políticas RLS para stage_permissions
DROP POLICY IF EXISTS "Users can view their role permissions" ON public.stage_permissions;
CREATE POLICY "Users can view their role permissions" ON public.stage_permissions
  FOR SELECT USING (
    role = (SELECT role FROM public.user_roles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage permissions" ON public.stage_permissions;
CREATE POLICY "Admins can manage permissions" ON public.stage_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Criar tabela de atividades por negócio
CREATE TABLE IF NOT EXISTS public.deal_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  activity_type text NOT NULL,
  description text,
  from_stage text,
  to_stage text,
  user_id uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal_id ON public.deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_created_at ON public.deal_activities(created_at DESC);

ALTER TABLE public.deal_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activities" ON public.deal_activities;
CREATE POLICY "Users can view activities" ON public.deal_activities
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create activities" ON public.deal_activities;
CREATE POLICY "Users can create activities" ON public.deal_activities
  FOR INSERT WITH CHECK (user_id = auth.uid());