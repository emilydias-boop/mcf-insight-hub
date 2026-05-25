
-- 1. Faixas de recomendação por produto
CREATE TABLE public.consorcio_faixas_recomendacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_produto TEXT NOT NULL,
  distancia_min INT NOT NULL DEFAULT 0,
  distancia_max INT,
  percentual_lance INT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_faixas_recomendacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access faixas"
ON public.consorcio_faixas_recomendacao
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_faixas_updated_at
BEFORE UPDATE ON public.consorcio_faixas_recomendacao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.consorcio_faixas_recomendacao (tipo_produto, distancia_min, distancia_max, percentual_lance, ordem) VALUES
  ('imovel', 0, 50, 25, 1),
  ('imovel', 51, 100, 50, 2),
  ('imovel', 101, NULL, NULL, 3),
  ('auto', 0, 150, 25, 1),
  ('auto', 151, NULL, 50, 2),
  ('moto', 0, 150, 25, 1),
  ('moto', 151, NULL, 50, 2),
  ('servicos', 0, 150, 25, 1),
  ('servicos', 151, NULL, 50, 2);

-- 2. Configuração por grupo
CREATE TABLE public.consorcio_grupos_config (
  grupo TEXT PRIMARY KEY,
  vagas_padrao INT NOT NULL DEFAULT 2,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_grupos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access grupos config"
ON public.consorcio_grupos_config
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_grupos_config_updated_at
BEFORE UPDATE ON public.consorcio_grupos_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Histórico de assembleias
CREATE TABLE public.consorcio_assembleias_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo TEXT NOT NULL,
  data_assembleia DATE NOT NULL,
  numero_loteria_aplicado TEXT,
  qtd_contemplados INT NOT NULL DEFAULT 0,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_assembleias_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access assembleias"
ON public.consorcio_assembleias_historico
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_assembleias_grupo ON public.consorcio_assembleias_historico(grupo);
CREATE INDEX idx_assembleias_data ON public.consorcio_assembleias_historico(data_assembleia DESC);

CREATE TRIGGER trg_assembleias_updated_at
BEFORE UPDATE ON public.consorcio_assembleias_historico
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Contemplados por assembleia
CREATE TABLE public.consorcio_assembleia_contemplados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_id UUID NOT NULL REFERENCES public.consorcio_assembleias_historico(id) ON DELETE CASCADE,
  cota TEXT NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('sorteio','lance_livre','lance_fixo')),
  percentual_lance NUMERIC(5,2),
  card_id UUID REFERENCES public.consortium_cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_assembleia_contemplados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access contemplados"
ON public.consorcio_assembleia_contemplados
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_contemplados_assembleia ON public.consorcio_assembleia_contemplados(assembleia_id);
