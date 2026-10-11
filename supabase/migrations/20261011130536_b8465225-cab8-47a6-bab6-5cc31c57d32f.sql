ALTER TABLE public.produtos_descontinuados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_name_aliases ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.produtos_descontinuados TO service_role;
GRANT ALL ON public.product_name_aliases TO service_role;
CREATE POLICY "Admins podem ler produtos descontinuados" ON public.produtos_descontinuados FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins podem ler aliases de produto" ON public.product_name_aliases FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));