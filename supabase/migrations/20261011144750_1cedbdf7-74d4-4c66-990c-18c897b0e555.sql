DROP POLICY "Staff can view hubla transactions" ON public.hubla_transactions;
CREATE POLICY "Staff can view hubla transactions" ON public.hubla_transactions FOR SELECT TO authenticated
USING ((SELECT public.can_access_consorcio_pii(auth.uid())) OR (SELECT public.has_role(auth.uid(), 'marketing'::app_role)));