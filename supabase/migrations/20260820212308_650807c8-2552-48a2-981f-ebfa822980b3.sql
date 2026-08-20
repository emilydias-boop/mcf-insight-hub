DROP POLICY IF EXISTS "auth all consortium_transfer_documents" ON public.consortium_transfer_documents;

CREATE POLICY "Consorcio staff can view consortium_transfer_documents" ON public.consortium_transfer_documents FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_transfer_documents" ON public.consortium_transfer_documents FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_transfer_documents" ON public.consortium_transfer_documents FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_transfer_documents" ON public.consortium_transfer_documents FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));