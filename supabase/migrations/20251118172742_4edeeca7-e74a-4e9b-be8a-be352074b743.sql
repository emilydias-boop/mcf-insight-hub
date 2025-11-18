-- Criar tipos enum para o sistema de gerenciamento de usuários
CREATE TYPE target_period AS ENUM ('mensal', 'trimestral', 'anual');
CREATE TYPE target_type AS ENUM ('receita', 'vendas', 'leads', 'conversao', 'custom');
CREATE TYPE flag_type AS ENUM ('red', 'yellow', 'green');
CREATE TYPE flag_category AS ENUM ('desempenho', 'comportamento', 'frequencia', 'financeiro', 'compliance', 'outros');
CREATE TYPE resource_type AS ENUM ('dashboard', 'receita', 'custos', 'projetos', 'credito', 'leilao', 'alertas', 'relatorios', 'configuracoes', 'efeito_alavanca');
CREATE TYPE permission_level AS ENUM ('none', 'view', 'edit', 'full');

-- Tabela de dados profissionais dos usuários
CREATE TABLE public.user_employment_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  position text,
  department text,
  hire_date date,
  fixed_salary numeric DEFAULT 0,
  ote numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  termination_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de metas dos usuários
CREATE TABLE public.user_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type target_type NOT NULL,
  period target_period NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_achieved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de flags (alertas visuais)
CREATE TABLE public.user_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  flag_type flag_type NOT NULL,
  category flag_category NOT NULL,
  title text NOT NULL,
  description text,
  severity integer CHECK (severity >= 1 AND severity <= 5) DEFAULT 3,
  is_resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamp with time zone,
  resolution_notes text,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de observações sobre usuários
CREATE TABLE public.user_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text,
  is_important boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de permissões granulares por usuário
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource resource_type NOT NULL,
  permission_level permission_level NOT NULL DEFAULT 'none',
  restrictions jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, resource)
);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_user_employment_data_updated_at
  BEFORE UPDATE ON public.user_employment_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_targets_updated_at
  BEFORE UPDATE ON public.user_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_flags_updated_at
  BEFORE UPDATE ON public.user_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_observations_updated_at
  BEFORE UPDATE ON public.user_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar permissão de usuário
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _resource resource_type, _required_level permission_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = _user_id 
      AND resource = _resource
      AND (
        CASE _required_level
          WHEN 'none' THEN permission_level::text IN ('none', 'view', 'edit', 'full')
          WHEN 'view' THEN permission_level::text IN ('view', 'edit', 'full')
          WHEN 'edit' THEN permission_level::text IN ('edit', 'full')
          WHEN 'full' THEN permission_level::text = 'full'
        END
      )
  );
$$;

-- View de resumo de performance dos usuários
CREATE OR REPLACE VIEW public.user_performance_summary AS
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  ued.position,
  ued.fixed_salary,
  ued.ote,
  ued.is_active,
  ued.hire_date,
  ur.role,
  -- Contagem de flags
  COUNT(DISTINCT CASE WHEN uf.flag_type = 'red' AND uf.is_resolved = false THEN uf.id END) as red_flags_count,
  COUNT(DISTINCT CASE WHEN uf.flag_type = 'yellow' AND uf.is_resolved = false THEN uf.id END) as yellow_flags_count,
  -- Metas
  COUNT(DISTINCT CASE WHEN ut.is_achieved = true THEN ut.id END) as targets_achieved,
  COUNT(DISTINCT ut.id) as total_targets,
  -- Performance média (baseada em metas dos últimos 3 meses)
  COALESCE(
    AVG(CASE 
      WHEN ut.target_value > 0 AND ut.end_date >= CURRENT_DATE - INTERVAL '3 months'
      THEN (ut.current_value / ut.target_value * 100)
    END), 0
  ) as avg_performance_3m
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_employment_data ued ON ued.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.user_flags uf ON uf.user_id = u.id
LEFT JOIN public.user_targets ut ON ut.user_id = u.id
GROUP BY u.id, u.email, p.full_name, ued.position, ued.fixed_salary, ued.ote, ued.is_active, ued.hire_date, ur.role;

-- ============================================
-- RLS POLICIES
-- ============================================

-- RLS para user_employment_data
ALTER TABLE public.user_employment_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employment data"
  ON public.user_employment_data FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own employment data"
  ON public.user_employment_data FOR SELECT
  USING (user_id = auth.uid());

-- RLS para user_targets
ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage targets"
  ON public.user_targets FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own targets"
  ON public.user_targets FOR SELECT
  USING (user_id = auth.uid());

-- RLS para user_flags
ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage flags"
  ON public.user_flags FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own flags"
  ON public.user_flags FOR SELECT
  USING (user_id = auth.uid());

-- RLS para user_observations
ALTER TABLE public.user_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage observations"
  ON public.user_observations FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- RLS para user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage permissions"
  ON public.user_permissions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (user_id = auth.uid());

-- Índices para melhor performance
CREATE INDEX idx_user_employment_data_user_id ON public.user_employment_data(user_id);
CREATE INDEX idx_user_targets_user_id ON public.user_targets(user_id);
CREATE INDEX idx_user_targets_period ON public.user_targets(start_date, end_date);
CREATE INDEX idx_user_flags_user_id ON public.user_flags(user_id);
CREATE INDEX idx_user_flags_resolved ON public.user_flags(is_resolved);
CREATE INDEX idx_user_observations_user_id ON public.user_observations(user_id);
CREATE INDEX idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_resource ON public.user_permissions(resource);