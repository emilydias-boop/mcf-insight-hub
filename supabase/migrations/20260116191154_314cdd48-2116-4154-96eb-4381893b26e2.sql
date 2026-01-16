-- Tabela para Tipos de Produto
CREATE TABLE consorcio_tipo_produto_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para Categorias
CREATE TABLE consorcio_categoria_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para Origens
CREATE TABLE consorcio_origem_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir dados iniciais baseados nos valores atuais
INSERT INTO consorcio_tipo_produto_options (name, label, color, display_order) VALUES
  ('select', 'Select', '#3B82F6', 0),
  ('parcelinha', 'Parcelinha', '#8B5CF6', 1);

INSERT INTO consorcio_categoria_options (name, label, color, display_order) VALUES
  ('inside', 'Inside Consórcio', '#3B82F6', 0),
  ('life', 'Life Consórcio', '#8B5CF6', 1);

INSERT INTO consorcio_origem_options (name, label, display_order) VALUES
  ('socio', 'Sócio', 0),
  ('gr', 'GR', 1),
  ('indicacao', 'Indicação', 2),
  ('clube_arremate', 'Clube do Arremate', 3),
  ('outros', 'Outros', 4);

-- Habilitar RLS
ALTER TABLE consorcio_tipo_produto_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE consorcio_categoria_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE consorcio_origem_options ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (todos autenticados podem ler)
CREATE POLICY "Usuários autenticados podem ler tipos" ON consorcio_tipo_produto_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler categorias" ON consorcio_categoria_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem ler origens" ON consorcio_origem_options FOR SELECT TO authenticated USING (true);

-- Políticas de escrita (todos autenticados podem gerenciar)
CREATE POLICY "Usuários autenticados podem gerenciar tipos" ON consorcio_tipo_produto_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem gerenciar categorias" ON consorcio_categoria_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Usuários autenticados podem gerenciar origens" ON consorcio_origem_options FOR ALL TO authenticated USING (true) WITH CHECK (true);