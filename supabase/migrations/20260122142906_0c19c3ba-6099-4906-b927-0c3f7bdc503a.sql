-- Drop the partial tables from previous attempts
DROP TABLE IF EXISTS public.cargo_metricas_config;
DROP TABLE IF EXISTS public.organograma;

-- Tabela de estrutura organizacional (organograma)
CREATE TABLE public.organograma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_catalogo_id uuid REFERENCES cargos_catalogo(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES organograma(id) ON DELETE SET NULL,
  squad text,
  departamento text,
  posicao_ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Configuração de métricas por cargo
CREATE TABLE public.cargo_metricas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_catalogo_id uuid REFERENCES cargos_catalogo(id) ON DELETE CASCADE NOT NULL,
  squad text,
  nome_metrica text NOT NULL,
  label_exibicao text NOT NULL,
  peso_percentual numeric(5,2) DEFAULT 25,
  tipo_calculo text DEFAULT 'contagem',
  fonte_dados text,
  meta_padrao numeric(10,2),
  ordem int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique index instead of constraint
CREATE UNIQUE INDEX idx_cargo_metrica_unique 
ON public.cargo_metricas_config (cargo_catalogo_id, nome_metrica, COALESCE(squad, '__global__'));

-- Enable RLS
ALTER TABLE public.organograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_metricas_config ENABLE ROW LEVEL SECURITY;

-- Policies for organograma (using user_roles table)
CREATE POLICY "Authenticated users can view organograma"
ON public.organograma FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can manage organograma"
ON public.organograma FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Policies for cargo_metricas_config
CREATE POLICY "Authenticated users can view cargo_metricas_config"
ON public.cargo_metricas_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage cargo_metricas_config"
ON public.cargo_metricas_config FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Indexes
CREATE INDEX idx_organograma_cargo ON public.organograma(cargo_catalogo_id);
CREATE INDEX idx_organograma_squad ON public.organograma(squad);
CREATE INDEX idx_cargo_metricas_cargo ON public.cargo_metricas_config(cargo_catalogo_id);
CREATE INDEX idx_cargo_metricas_squad ON public.cargo_metricas_config(squad);