-- whatsapp_instances: credentials only for admin/manager
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar instâncias" ON public.whatsapp_instances;
CREATE POLICY "Admins can view whatsapp_instances" ON public.whatsapp_instances FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- credit_partners: align with credit_clients (manager/admin only)
DROP POLICY IF EXISTS "Authenticated users can read credit_partners" ON public.credit_partners;
DROP POLICY IF EXISTS "Authenticated users can insert credit_partners" ON public.credit_partners;
DROP POLICY IF EXISTS "Authenticated users can update credit_partners" ON public.credit_partners;

CREATE POLICY "Managers can view credit_partners" ON public.credit_partners FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can insert credit_partners" ON public.credit_partners FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can update credit_partners" ON public.credit_partners FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));