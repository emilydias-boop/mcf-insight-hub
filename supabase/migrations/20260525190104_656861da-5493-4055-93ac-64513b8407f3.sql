
CREATE TABLE public.consorcio_grupo_saude (
  grupo text PRIMARY KEY,
  referencia_mes date,
  ativos integer,
  desistentes_excluidos integer,
  quitados integer,
  contemplados integer,
  nao_contemplados integer,
  bens_entregues integer,
  bens_distribuidos integer,
  bens_nao_distribuidos integer,
  disponibilidades_total numeric,
  aplic_financeiras numeric,
  valor_bens_a_entregar numeric,
  proxima_parcela_vencimento date,
  proxima_parcela_valor numeric,
  fonte text,
  observacao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consorcio_calendario_assembleia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo text NOT NULL,
  numero integer NOT NULL,
  data_assembleia date NOT NULL,
  dia_semana text,
  vencimento date,
  sorteio date,
  horario text,
  local text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo, numero)
);
CREATE INDEX idx_cal_assembleia_grupo ON public.consorcio_calendario_assembleia(grupo, data_assembleia);

CREATE TABLE public.consorcio_assembleia_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembleia_historico_id uuid REFERENCES public.consorcio_assembleias_historico(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  numero_assembleia integer,
  data_assembleia date,
  cota text NOT NULL,
  modalidade text,
  bem text,
  filial text,
  percentual_lance numeric,
  parcela text,
  dt_contemplacao date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assem_result_grupo ON public.consorcio_assembleia_resultados(grupo, data_assembleia);
CREATE INDEX idx_assem_result_hist ON public.consorcio_assembleia_resultados(assembleia_historico_id);

ALTER TABLE public.consorcio_grupo_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consorcio_calendario_assembleia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consorcio_assembleia_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read" ON public.consorcio_grupo_saude FOR SELECT TO authenticated USING (true);
CREATE POLICY "leadership write" ON public.consorcio_grupo_saude FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "auth read" ON public.consorcio_calendario_assembleia FOR SELECT TO authenticated USING (true);
CREATE POLICY "leadership write" ON public.consorcio_calendario_assembleia FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'));

CREATE POLICY "auth read" ON public.consorcio_assembleia_resultados FOR SELECT TO authenticated USING (true);
CREATE POLICY "leadership write" ON public.consorcio_assembleia_resultados FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'coordenador'));
