-- Criar tabela departamentos
CREATE TABLE public.departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  codigo TEXT UNIQUE,
  is_bu BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela squads
CREATE TABLE public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nome, departamento_id)
);

-- Enable RLS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departamentos
CREATE POLICY "Authenticated users can view departamentos" 
  ON public.departamentos FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Admins and managers can manage departamentos" 
  ON public.departamentos FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- RLS Policies for squads
CREATE POLICY "Authenticated users can view squads" 
  ON public.squads FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Admins and managers can manage squads" 
  ON public.squads FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Inserir departamentos existentes
INSERT INTO public.departamentos (nome, codigo, is_bu, ordem) VALUES
  ('BU - Incorporador 50K', 'incorporador', true, 1),
  ('BU - Consórcio', 'consorcio', true, 2),
  ('BU - Crédito', 'credito', true, 3),
  ('BU - Projetos', 'projetos', true, 4),
  ('BU - Outros', 'outros', true, 5),
  ('Diretoria', 'diretoria', false, 10),
  ('TI', 'ti', false, 11),
  ('Financeiro', 'financeiro', false, 12),
  ('Marketing', 'marketing', false, 13),
  ('RH', 'rh', false, 14);

-- Inserir squads existentes
INSERT INTO public.squads (nome, departamento_id, ordem) 
SELECT 'Inside Sales Produto', id, 1 FROM public.departamentos WHERE codigo = 'incorporador';

INSERT INTO public.squads (nome, departamento_id, ordem) 
SELECT 'Comercial', id, 2 FROM public.departamentos WHERE codigo = 'incorporador';

INSERT INTO public.squads (nome, departamento_id, ordem) 
SELECT 'Closer', id, 3 FROM public.departamentos WHERE codigo = 'incorporador';

INSERT INTO public.squads (nome, departamento_id, ordem) 
SELECT 'Vendas Consórcio', id, 1 FROM public.departamentos WHERE codigo = 'consorcio';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_departamentos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_departamentos_updated_at
  BEFORE UPDATE ON public.departamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_departamentos_updated_at();

CREATE TRIGGER update_squads_updated_at
  BEFORE UPDATE ON public.squads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_departamentos_updated_at();