
-- Table to audit lottery consultations
CREATE TABLE public.consorcio_consulta_loteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo TEXT NOT NULL,
  periodo TEXT NOT NULL,
  numero_loteria TEXT NOT NULL,
  numero_base TEXT NOT NULL,
  cotas_match INTEGER NOT NULL DEFAULT 0,
  cotas_zona_50 INTEGER NOT NULL DEFAULT 0,
  cotas_zona_100 INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consorcio_consulta_loteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert consulta_loteria"
  ON public.consorcio_consulta_loteria FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read consulta_loteria"
  ON public.consorcio_consulta_loteria FOR SELECT
  TO authenticated USING (true);

CREATE INDEX idx_consulta_loteria_grupo ON public.consorcio_consulta_loteria(grupo);
CREATE INDEX idx_consulta_loteria_created_at ON public.consorcio_consulta_loteria(created_at DESC);
