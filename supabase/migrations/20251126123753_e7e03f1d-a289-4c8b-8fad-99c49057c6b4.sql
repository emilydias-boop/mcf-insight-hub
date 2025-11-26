-- Criar tabela de metas da equipe
CREATE TABLE IF NOT EXISTS public.team_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('funnel_stage', 'ultrameta', 'closer', 'sdr', 'team_revenue', 'team_sales')),
  target_name TEXT NOT NULL,
  reference_id TEXT,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  origin_id UUID REFERENCES public.crm_origins(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_team_targets_week ON public.team_targets(week_start, week_end);
CREATE INDEX idx_team_targets_type ON public.team_targets(target_type);
CREATE INDEX idx_team_targets_origin ON public.team_targets(origin_id);

-- RLS Policies
ALTER TABLE public.team_targets ENABLE ROW LEVEL SECURITY;

-- Todos podem visualizar metas
CREATE POLICY "Authenticated users can view team targets"
  ON public.team_targets FOR SELECT
  USING (true);

-- Managers e admins podem gerenciar metas
CREATE POLICY "Managers can manage team targets"
  ON public.team_targets FOR ALL
  USING (
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'admin'::app_role)
  );