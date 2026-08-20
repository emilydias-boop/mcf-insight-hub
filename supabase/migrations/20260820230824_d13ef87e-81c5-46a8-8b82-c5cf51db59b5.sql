
CREATE TABLE public.bkp_cotas_fatiadas_20260820 (
  bkp_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bkp_at timestamptz NOT NULL DEFAULT now(),
  bkp_motivo text NOT NULL,
  registro jsonb NOT NULL
);
GRANT ALL ON public.bkp_cotas_fatiadas_20260820 TO service_role;
ALTER TABLE public.bkp_cotas_fatiadas_20260820 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver backup de cotas fatiadas"
ON public.bkp_cotas_fatiadas_20260820 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
