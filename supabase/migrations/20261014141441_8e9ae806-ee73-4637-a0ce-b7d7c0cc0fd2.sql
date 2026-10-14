CREATE TABLE public.bkp_academia_data_inicio_20261014 (id uuid PRIMARY KEY, data_inicio date, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.bkp_academia_data_inicio_20261014 TO authenticated;
GRANT ALL ON public.bkp_academia_data_inicio_20261014 TO service_role;
ALTER TABLE public.bkp_academia_data_inicio_20261014 ENABLE ROW LEVEL SECURITY;
CREATE POLICY bkp_admin_ler ON public.bkp_academia_data_inicio_20261014 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));