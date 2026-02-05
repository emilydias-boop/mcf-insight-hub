-- ====================================
-- 1. CRIAR TABELA cargo_metricas_padrao
-- ====================================

CREATE TABLE IF NOT EXISTS public.cargo_metricas_padrao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_catalogo_id UUID NOT NULL REFERENCES public.cargos_catalogo(id) ON DELETE CASCADE,
  nome_metrica TEXT NOT NULL,
  label_exibicao TEXT NOT NULL,
  peso_percentual NUMERIC(5,2) NOT NULL DEFAULT 25,
  meta_percentual NUMERIC(5,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cargo_catalogo_id, nome_metrica)
);

-- Enable RLS
ALTER TABLE public.cargo_metricas_padrao ENABLE ROW LEVEL SECURITY;

-- Public read policy
CREATE POLICY "Allow public read on cargo_metricas_padrao"
ON public.cargo_metricas_padrao FOR SELECT
USING (true);