DROP POLICY IF EXISTS "Authenticated users can view webhook configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Authenticated users can create webhook configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Authenticated users can update webhook configs" ON public.webhook_configs;
DROP POLICY IF EXISTS "Authenticated users can delete webhook configs" ON public.webhook_configs;

CREATE POLICY "Admins/managers can view webhook configs"
ON public.webhook_configs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admins/managers can create webhook configs"
ON public.webhook_configs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admins/managers can update webhook configs"
ON public.webhook_configs FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'coordenador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "Admins/managers can delete webhook configs"
ON public.webhook_configs FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'coordenador'));

REVOKE ALL ON public.webhook_configs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_configs TO authenticated;
GRANT ALL ON public.webhook_configs TO service_role;