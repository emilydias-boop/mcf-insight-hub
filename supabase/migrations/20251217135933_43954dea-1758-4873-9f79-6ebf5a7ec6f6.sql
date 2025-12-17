
-- Tabela principal de colaboradores (ficha RH)
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Dados pessoais
  nome_completo TEXT NOT NULL,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  estado_civil TEXT,
  nacionalidade TEXT DEFAULT 'Brasileira',
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email_pessoal TEXT,
  
  -- Dados profissionais
  cargo TEXT,
  departamento TEXT,
  data_admissao DATE,
  data_demissao DATE,
  tipo_contrato TEXT DEFAULT 'CLT',
  jornada_trabalho TEXT DEFAULT '44h semanais',
  
  -- Remuneração
  salario_base NUMERIC DEFAULT 0,
  nivel INTEGER DEFAULT 1,
  
  -- Dados bancários
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT DEFAULT 'corrente',
  pix TEXT,
  
  -- Status
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'ferias', 'afastado', 'desligado')),
  
  -- Vínculos
  sdr_id UUID REFERENCES public.sdr(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX idx_employees_user_id ON public.employees(user_id);
CREATE INDEX idx_employees_sdr_id ON public.employees(sdr_id);
CREATE INDEX idx_employees_status ON public.employees(status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Admin podem ver todos colaboradores"
ON public.employees FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

CREATE POLICY "RH e Admin podem inserir colaboradores"
ON public.employees FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

CREATE POLICY "RH e Admin podem atualizar colaboradores"
ON public.employees FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

CREATE POLICY "Apenas Admin pode deletar colaboradores"
ON public.employees FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Tabela de documentos do colaborador
CREATE TABLE public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT,
  storage_url TEXT,
  data_emissao DATE,
  data_validade DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'vencido')),
  observacao_status TEXT,
  obrigatorio BOOLEAN DEFAULT false,
  visivel_colaborador BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID
);

CREATE INDEX idx_employee_documents_employee_id ON public.employee_documents(employee_id);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Admin podem gerenciar documentos"
ON public.employee_documents FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

-- Tabela de eventos/histórico do colaborador
CREATE TABLE public.employee_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_anterior TEXT,
  valor_novo TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_employee_events_employee_id ON public.employee_events(employee_id);

ALTER TABLE public.employee_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Admin podem ver eventos"
ON public.employee_events FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

CREATE POLICY "RH e Admin podem criar eventos"
ON public.employee_events FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

-- Tabela de notas/observações
CREATE TABLE public.employee_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  titulo TEXT,
  conteudo TEXT NOT NULL,
  tipo TEXT DEFAULT 'geral' CHECK (tipo IN ('geral', 'feedback', 'advertencia', 'elogio', 'meta')),
  privada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_employee_notes_employee_id ON public.employee_notes(employee_id);

ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Admin podem gerenciar notas"
ON public.employee_notes FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

-- Tabela de documentos obrigatórios por cargo
CREATE TABLE public.role_required_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  descricao TEXT,
  prazo_dias INTEGER DEFAULT 30,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cargo, tipo_documento)
);

ALTER TABLE public.role_required_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RH e Admin podem gerenciar documentos obrigatórios"
ON public.role_required_documents FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'rh'));

-- Triggers para updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_documents_updated_at
BEFORE UPDATE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_notes_updated_at
BEFORE UPDATE ON public.employee_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
