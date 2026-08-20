REVOKE ALL ON public.bkp_profiles_squad_20260819 FROM anon, authenticated;
REVOKE ALL ON public.bkp_redistribuicao_a010_20260820 FROM anon, authenticated;
REVOKE ALL ON public.bkp_redistribuicao_consorcio_20260819 FROM anon, authenticated;

GRANT ALL ON public.bkp_profiles_squad_20260819 TO service_role;
GRANT ALL ON public.bkp_redistribuicao_a010_20260820 TO service_role;
GRANT ALL ON public.bkp_redistribuicao_consorcio_20260819 TO service_role;

ALTER TABLE public.bkp_profiles_squad_20260819 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_redistribuicao_a010_20260820 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bkp_redistribuicao_consorcio_20260819 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view profiles squad backup"
ON public.bkp_profiles_squad_20260819 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view a010 redistribution backup"
ON public.bkp_redistribuicao_a010_20260820 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view consorcio redistribution backup"
ON public.bkp_redistribuicao_consorcio_20260819 FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));