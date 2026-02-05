-- =====================================================
-- CENTRAL DE CONTROLE DE PATRIMÔNIO (TI) - CORRIGIDO
-- =====================================================

-- 1. ENUMS
-- =====================================================

-- Tipo de equipamento
CREATE TYPE public.asset_type AS ENUM (
  'notebook',
  'desktop',
  'monitor',
  'celular',
  'tablet',
  'impressora',
  'outro'
);

-- Status do equipamento
CREATE TYPE public.asset_status AS ENUM (
  'em_estoque',
  'em_uso',
  'em_manutencao',
  'devolvido',
  'baixado'
);

-- Tipo de evento no histórico
CREATE TYPE public.asset_event_type AS ENUM (
  'comprado',
  'liberado',
  'transferido',
  'manutencao',
  'devolucao',
  'baixa'
);

-- Status do assignment
CREATE TYPE public.assignment_status AS ENUM (
  'ativo',
  'devolvido',
  'transferido'
);

-- 2. TABELAS
-- =====================================================

-- Tabela principal: assets (Equipamentos)
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_patrimonio TEXT NOT NULL UNIQUE,
  tipo public.asset_type NOT NULL,
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT,
  sistema_operacional TEXT,
  data_compra DATE,
  fornecedor TEXT,
  nota_fiscal_url TEXT,
  nota_fiscal_path TEXT,
  status public.asset_status NOT NULL DEFAULT 'em_estoque',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela: asset_assignments (Vínculos com Colaborador)
CREATE TABLE public.asset_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  setor TEXT,
  cargo TEXT,
  data_liberacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_devolucao DATE,
  data_devolucao_real DATE,
  status public.assignment_status NOT NULL DEFAULT 'ativo',
  termo_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela: asset_assignment_items (Itens Entregues)
CREATE TABLE public.asset_assignment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.asset_assignments(id) ON DELETE CASCADE,
  item_tipo TEXT NOT NULL,
  descricao TEXT,
  conferido_devolucao BOOLEAN DEFAULT false,
  observacao_devolucao TEXT
);

-- Tabela: asset_terms (Termos de Responsabilidade)
CREATE TABLE public.asset_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID REFERENCES public.asset_assignments(id) ON DELETE SET NULL,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  termo_conteudo TEXT NOT NULL,
  aceito BOOLEAN DEFAULT false,
  data_aceite TIMESTAMP WITH TIME ZONE,
  ip_aceite TEXT,
  assinatura_digital TEXT,
  bloqueado BOOLEAN DEFAULT false,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar FK do termo no assignment
ALTER TABLE public.asset_assignments
  ADD CONSTRAINT asset_assignments_termo_id_fkey
  FOREIGN KEY (termo_id) REFERENCES public.asset_terms(id) ON DELETE SET NULL;

-- Tabela: asset_history (Histórico Versionado)
CREATE TABLE public.asset_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tipo_evento public.asset_event_type NOT NULL,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. ÍNDICES
-- =====================================================

CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_assets_tipo ON public.assets(tipo);
CREATE INDEX idx_assets_numero_patrimonio ON public.assets(numero_patrimonio);
CREATE INDEX idx_asset_assignments_asset_id ON public.asset_assignments(asset_id);
CREATE INDEX idx_asset_assignments_employee_id ON public.asset_assignments(employee_id);
CREATE INDEX idx_asset_assignments_status ON public.asset_assignments(status);
CREATE INDEX idx_asset_terms_employee_id ON public.asset_terms(employee_id);
CREATE INDEX idx_asset_terms_asset_id ON public.asset_terms(asset_id);
CREATE INDEX idx_asset_history_asset_id ON public.asset_history(asset_id);

-- 4. TRIGGERS para updated_at
-- =====================================================

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. PERMISSÕES - Adicionar 'patrimonio' ao resource_type
-- =====================================================

ALTER TYPE public.resource_type ADD VALUE IF NOT EXISTS 'patrimonio';

-- 6. RLS POLICIES (Usando JWT claims para role)
-- =====================================================

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_history ENABLE ROW LEVEL SECURITY;

-- Helper function para verificar role do JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    'viewer'
  );
$$;

-- ASSETS: Admin/Manager têm acesso total
CREATE POLICY "Admin/Manager full access on assets"
  ON public.assets
  FOR ALL
  USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- ASSETS: Usuários podem ver equipamentos vinculados a eles
CREATE POLICY "Users can view their assigned assets"
  ON public.assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_assignments aa
      JOIN public.employees e ON aa.employee_id = e.id
      WHERE aa.asset_id = assets.id
      AND e.user_id = auth.uid()
      AND aa.status = 'ativo'
    )
  );

-- ASSET_ASSIGNMENTS: Admin/Manager têm acesso total
CREATE POLICY "Admin/Manager full access on asset_assignments"
  ON public.asset_assignments
  FOR ALL
  USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- ASSET_ASSIGNMENTS: Usuários podem ver seus próprios vínculos
CREATE POLICY "Users can view their own assignments"
  ON public.asset_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = asset_assignments.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- ASSET_ASSIGNMENT_ITEMS: Admin/Manager têm acesso total
CREATE POLICY "Admin/Manager full access on asset_assignment_items"
  ON public.asset_assignment_items
  FOR ALL
  USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- ASSET_ASSIGNMENT_ITEMS: Usuários podem ver itens dos seus vínculos
CREATE POLICY "Users can view their own assignment items"
  ON public.asset_assignment_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_assignments aa
      JOIN public.employees e ON aa.employee_id = e.id
      WHERE aa.id = asset_assignment_items.assignment_id
      AND e.user_id = auth.uid()
    )
  );

-- ASSET_TERMS: Admin/Manager têm acesso total
CREATE POLICY "Admin/Manager full access on asset_terms"
  ON public.asset_terms
  FOR ALL
  USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- ASSET_TERMS: Usuários podem ver seus próprios termos
CREATE POLICY "Users can view their own terms"
  ON public.asset_terms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = asset_terms.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- ASSET_TERMS: Usuários podem aceitar seus próprios termos não bloqueados
CREATE POLICY "Users can accept their own terms"
  ON public.asset_terms
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = asset_terms.employee_id
      AND employees.user_id = auth.uid()
    )
    AND bloqueado = false
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = asset_terms.employee_id
      AND employees.user_id = auth.uid()
    )
  );

-- ASSET_HISTORY: Admin/Manager têm acesso total
CREATE POLICY "Admin/Manager full access on asset_history"
  ON public.asset_history
  FOR ALL
  USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- ASSET_HISTORY: Usuários podem ver histórico dos seus equipamentos
CREATE POLICY "Users can view history of their assets"
  ON public.asset_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.asset_assignments aa
      JOIN public.employees e ON aa.employee_id = e.id
      WHERE aa.asset_id = asset_history.asset_id
      AND e.user_id = auth.uid()
    )
  );

-- 7. INSERIR PERMISSÕES PADRÃO
-- =====================================================

INSERT INTO public.role_permissions (role, resource, permission_level)
VALUES 
  ('admin', 'patrimonio', 'full'),
  ('manager', 'patrimonio', 'edit'),
  ('rh', 'patrimonio', 'view'),
  ('sdr', 'patrimonio', 'none'),
  ('closer', 'patrimonio', 'none'),
  ('viewer', 'patrimonio', 'none')
ON CONFLICT (role, resource) DO UPDATE SET permission_level = EXCLUDED.permission_level;