DROP POLICY IF EXISTS "Authenticated users can view hubla transactions" ON public.hubla_transactions;

CREATE POLICY "Staff can view hubla transactions" ON public.hubla_transactions FOR SELECT TO authenticated
USING (
  public.can_access_consorcio_pii(auth.uid())
  OR public.has_role(auth.uid(), 'marketing')
);