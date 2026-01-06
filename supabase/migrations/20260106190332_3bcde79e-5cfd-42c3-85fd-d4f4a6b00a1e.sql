-- Tabela para armazenar matriz de permissões por cargo
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  resource TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, resource)
);

-- Habilitar RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Política: todos autenticados podem ler (necessário para verificar permissões)
CREATE POLICY "Authenticated users can view role permissions" 
ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Política: apenas admins podem inserir
CREATE POLICY "Only admins can insert role permissions" 
ON public.role_permissions FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem atualizar
CREATE POLICY "Only admins can update role permissions" 
ON public.role_permissions FOR UPDATE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem deletar
CREATE POLICY "Only admins can delete role permissions" 
ON public.role_permissions FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir valores padrão iniciais
INSERT INTO public.role_permissions (role, resource, permission_level) VALUES
-- Admin: full em tudo
('admin', 'dashboard', 'full'), ('admin', 'receita', 'full'), ('admin', 'custos', 'full'),
('admin', 'relatorios', 'full'), ('admin', 'alertas', 'full'), ('admin', 'crm', 'full'),
('admin', 'fechamento_sdr', 'full'), ('admin', 'tv_sdr', 'full'), ('admin', 'usuarios', 'full'),
('admin', 'financeiro', 'full'), ('admin', 'projetos', 'full'), ('admin', 'credito', 'full'),
('admin', 'leilao', 'full'), ('admin', 'configuracoes', 'full'), ('admin', 'efeito_alavanca', 'full'),
('admin', 'rh', 'full'), ('admin', 'playbook', 'full'),
-- Manager
('manager', 'dashboard', 'full'), ('manager', 'receita', 'full'), ('manager', 'custos', 'full'),
('manager', 'relatorios', 'full'), ('manager', 'alertas', 'full'), ('manager', 'crm', 'full'),
('manager', 'fechamento_sdr', 'edit'), ('manager', 'tv_sdr', 'full'), ('manager', 'usuarios', 'none'),
('manager', 'financeiro', 'full'), ('manager', 'projetos', 'full'), ('manager', 'credito', 'full'),
('manager', 'leilao', 'full'), ('manager', 'configuracoes', 'view'), ('manager', 'efeito_alavanca', 'full'),
('manager', 'rh', 'view'), ('manager', 'playbook', 'full'),
-- Coordenador
('coordenador', 'dashboard', 'view'), ('coordenador', 'receita', 'view'), ('coordenador', 'custos', 'view'),
('coordenador', 'relatorios', 'view'), ('coordenador', 'alertas', 'view'), ('coordenador', 'crm', 'full'),
('coordenador', 'fechamento_sdr', 'edit'), ('coordenador', 'tv_sdr', 'view'), ('coordenador', 'usuarios', 'none'),
('coordenador', 'financeiro', 'none'), ('coordenador', 'projetos', 'view'), ('coordenador', 'credito', 'none'),
('coordenador', 'leilao', 'none'), ('coordenador', 'configuracoes', 'view'), ('coordenador', 'efeito_alavanca', 'view'),
('coordenador', 'rh', 'none'), ('coordenador', 'playbook', 'view'),
-- SDR (sem dashboard)
('sdr', 'dashboard', 'none'), ('sdr', 'receita', 'none'), ('sdr', 'custos', 'none'),
('sdr', 'relatorios', 'none'), ('sdr', 'alertas', 'view'), ('sdr', 'crm', 'view'),
('sdr', 'fechamento_sdr', 'view'), ('sdr', 'tv_sdr', 'view'), ('sdr', 'usuarios', 'none'),
('sdr', 'financeiro', 'none'), ('sdr', 'projetos', 'none'), ('sdr', 'credito', 'none'),
('sdr', 'leilao', 'none'), ('sdr', 'configuracoes', 'view'), ('sdr', 'efeito_alavanca', 'none'),
('sdr', 'rh', 'none'), ('sdr', 'playbook', 'view'),
-- Closer
('closer', 'dashboard', 'none'), ('closer', 'receita', 'none'), ('closer', 'custos', 'none'),
('closer', 'relatorios', 'none'), ('closer', 'alertas', 'view'), ('closer', 'crm', 'view'),
('closer', 'fechamento_sdr', 'none'), ('closer', 'tv_sdr', 'view'), ('closer', 'usuarios', 'none'),
('closer', 'financeiro', 'none'), ('closer', 'projetos', 'none'), ('closer', 'credito', 'none'),
('closer', 'leilao', 'none'), ('closer', 'configuracoes', 'view'), ('closer', 'efeito_alavanca', 'none'),
('closer', 'rh', 'none'), ('closer', 'playbook', 'view'),
-- Financeiro
('financeiro', 'dashboard', 'view'), ('financeiro', 'receita', 'full'), ('financeiro', 'custos', 'full'),
('financeiro', 'relatorios', 'view'), ('financeiro', 'alertas', 'view'), ('financeiro', 'crm', 'none'),
('financeiro', 'fechamento_sdr', 'none'), ('financeiro', 'tv_sdr', 'none'), ('financeiro', 'usuarios', 'none'),
('financeiro', 'financeiro', 'full'), ('financeiro', 'projetos', 'none'), ('financeiro', 'credito', 'none'),
('financeiro', 'leilao', 'none'), ('financeiro', 'configuracoes', 'view'), ('financeiro', 'efeito_alavanca', 'none'),
('financeiro', 'rh', 'none'), ('financeiro', 'playbook', 'view'),
-- RH
('rh', 'dashboard', 'none'), ('rh', 'receita', 'none'), ('rh', 'custos', 'none'),
('rh', 'relatorios', 'none'), ('rh', 'alertas', 'view'), ('rh', 'crm', 'none'),
('rh', 'fechamento_sdr', 'none'), ('rh', 'tv_sdr', 'none'), ('rh', 'usuarios', 'none'),
('rh', 'financeiro', 'none'), ('rh', 'projetos', 'none'), ('rh', 'credito', 'none'),
('rh', 'leilao', 'none'), ('rh', 'configuracoes', 'view'), ('rh', 'efeito_alavanca', 'none'),
('rh', 'rh', 'full'), ('rh', 'playbook', 'view'),
-- Viewer
('viewer', 'dashboard', 'view'), ('viewer', 'receita', 'view'), ('viewer', 'custos', 'view'),
('viewer', 'relatorios', 'view'), ('viewer', 'alertas', 'view'), ('viewer', 'crm', 'none'),
('viewer', 'fechamento_sdr', 'none'), ('viewer', 'tv_sdr', 'none'), ('viewer', 'usuarios', 'none'),
('viewer', 'financeiro', 'none'), ('viewer', 'projetos', 'view'), ('viewer', 'credito', 'none'),
('viewer', 'leilao', 'none'), ('viewer', 'configuracoes', 'view'), ('viewer', 'efeito_alavanca', 'none'),
('viewer', 'rh', 'none'), ('viewer', 'playbook', 'view');