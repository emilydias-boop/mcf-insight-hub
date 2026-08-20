DROP POLICY IF EXISTS "Authenticated users can view consortium_pj_partners" ON public.consortium_pj_partners;
DROP POLICY IF EXISTS "Authenticated users can insert consortium_pj_partners" ON public.consortium_pj_partners;
DROP POLICY IF EXISTS "Authenticated users can update consortium_pj_partners" ON public.consortium_pj_partners;
DROP POLICY IF EXISTS "Authenticated users can delete consortium_pj_partners" ON public.consortium_pj_partners;

CREATE POLICY "Consorcio staff can view pj partners"
ON public.consortium_pj_partners FOR SELECT TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert pj partners"
ON public.consortium_pj_partners FOR INSERT TO authenticated
WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update pj partners"
ON public.consortium_pj_partners FOR UPDATE TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()))
WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete pj partners"
ON public.consortium_pj_partners FOR DELETE TO authenticated
USING (public.can_access_consorcio_pii(auth.uid()));