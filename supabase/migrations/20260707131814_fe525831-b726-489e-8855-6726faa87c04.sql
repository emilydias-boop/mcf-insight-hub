
-- 1) Tabela de delegação
CREATE TABLE IF NOT EXISTS public.ar_gestores (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT ON public.ar_gestores TO authenticated;
GRANT ALL ON public.ar_gestores TO service_role;

ALTER TABLE public.ar_gestores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos autenticados leem ar_gestores" ON public.ar_gestores;
CREATE POLICY "Todos autenticados leem ar_gestores"
ON public.ar_gestores FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gerencia ar_gestores" ON public.ar_gestores;
CREATE POLICY "Admin gerencia ar_gestores"
ON public.ar_gestores FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Helper
CREATE OR REPLACE FUNCTION public.can_manage_ar(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.ar_gestores WHERE user_id = _user_id);
$$;

-- 3) Substituir policies de gestão em ar_titulos / ar_parcelas / ar_historico
DROP POLICY IF EXISTS "Admin gerencia titulos AR" ON public.ar_titulos;
CREATE POLICY "Admin ou gestor delegado gerencia titulos AR"
ON public.ar_titulos FOR ALL TO authenticated
USING (public.can_manage_ar(auth.uid()))
WITH CHECK (public.can_manage_ar(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia parcelas AR" ON public.ar_parcelas;
CREATE POLICY "Admin ou gestor delegado gerencia parcelas AR"
ON public.ar_parcelas FOR ALL TO authenticated
USING (public.can_manage_ar(auth.uid()))
WITH CHECK (public.can_manage_ar(auth.uid()));

DROP POLICY IF EXISTS "Admin ve historico AR" ON public.ar_historico;
DROP POLICY IF EXISTS "Admin insere historico AR" ON public.ar_historico;
CREATE POLICY "Admin ou gestor delegado ve historico AR"
ON public.ar_historico FOR SELECT TO authenticated
USING (public.can_manage_ar(auth.uid()));
CREATE POLICY "Admin ou gestor delegado insere historico AR"
ON public.ar_historico FOR INSERT TO authenticated
WITH CHECK (public.can_manage_ar(auth.uid()));
