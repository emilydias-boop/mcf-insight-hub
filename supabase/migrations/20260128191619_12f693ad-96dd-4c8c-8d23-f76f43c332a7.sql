-- 1. Criar tabela de áreas
CREATE TABLE public.areas_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  codigo TEXT UNIQUE,
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Popular com áreas existentes (incluindo as da constraint original)
INSERT INTO public.areas_catalogo (nome, codigo, ordem) VALUES
  ('Inside Sales', 'inside_sales', 1),
  ('Consórcio', 'consorcio', 2),
  ('Crédito', 'credito', 3),
  ('Projetos', 'projetos', 4),
  ('Marketing', 'marketing', 5),
  ('Financeiro', 'financeiro', 6),
  ('Tecnologia', 'tecnologia', 7),
  ('RH', 'rh', 8),
  ('Diretoria', 'diretoria', 9),
  ('Avulsos', 'avulsos', 10);

-- 3. Remover CHECK constraint da área
ALTER TABLE public.cargos_catalogo 
  DROP CONSTRAINT IF EXISTS cargos_catalogo_area_check;

-- 4. Trigger para updated_at
CREATE TRIGGER update_areas_catalogo_updated_at
  BEFORE UPDATE ON public.areas_catalogo
  FOR EACH ROW
  EXECUTE FUNCTION update_departamentos_updated_at();

-- 5. Adicionar RLS
ALTER TABLE public.areas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read areas_catalogo" 
  ON public.areas_catalogo FOR SELECT USING (true);

CREATE POLICY "Authenticated write areas_catalogo" 
  ON public.areas_catalogo FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update areas_catalogo" 
  ON public.areas_catalogo FOR UPDATE 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete areas_catalogo" 
  ON public.areas_catalogo FOR DELETE 
  USING (auth.role() = 'authenticated');