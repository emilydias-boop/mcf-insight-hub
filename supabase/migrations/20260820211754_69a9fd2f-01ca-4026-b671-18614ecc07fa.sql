-- 1) Transfers
DROP POLICY IF EXISTS "auth all consortium_transfers" ON public.consortium_transfers;
DROP POLICY IF EXISTS "auth all consortium_transfer_buyers" ON public.consortium_transfer_buyers;
DROP POLICY IF EXISTS "auth all consortium_transfer_financials" ON public.consortium_transfer_financials;

CREATE POLICY "Consorcio staff can view consortium_transfers" ON public.consortium_transfers FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_transfers" ON public.consortium_transfers FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_transfers" ON public.consortium_transfers FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_transfers" ON public.consortium_transfers FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));

CREATE POLICY "Consorcio staff can view consortium_transfer_buyers" ON public.consortium_transfer_buyers FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_transfer_buyers" ON public.consortium_transfer_buyers FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_transfer_buyers" ON public.consortium_transfer_buyers FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_transfer_buyers" ON public.consortium_transfer_buyers FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));

CREATE POLICY "Consorcio staff can view consortium_transfer_financials" ON public.consortium_transfer_financials FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_transfer_financials" ON public.consortium_transfer_financials FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_transfer_financials" ON public.consortium_transfer_financials FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_transfer_financials" ON public.consortium_transfer_financials FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));

-- 2) Documents (table)
DROP POLICY IF EXISTS "Authenticated users can view consortium_documents" ON public.consortium_documents;
DROP POLICY IF EXISTS "Authenticated users can insert consortium_documents" ON public.consortium_documents;
DROP POLICY IF EXISTS "Authenticated users can update consortium_documents" ON public.consortium_documents;
DROP POLICY IF EXISTS "Authenticated users can delete consortium_documents" ON public.consortium_documents;

CREATE POLICY "Consorcio staff can view consortium_documents" ON public.consortium_documents FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can insert consortium_documents" ON public.consortium_documents FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consortium_documents" ON public.consortium_documents FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consortium_documents" ON public.consortium_documents FOR DELETE TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));

-- 2b) Documents (storage bucket consorcio-documents)
DROP POLICY IF EXISTS "Authenticated users can view consorcio documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload consorcio documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update consorcio documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete consorcio documents" ON storage.objects;

CREATE POLICY "Consorcio staff can view consorcio documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'consorcio-documents' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can upload consorcio documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'consorcio-documents' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consorcio documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'consorcio-documents' AND public.can_access_consorcio_pii(auth.uid())) WITH CHECK (bucket_id = 'consorcio-documents' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consorcio documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'consorcio-documents' AND public.can_access_consorcio_pii(auth.uid()));

-- 3) team_targets / weekday overrides: remove anon read
DROP POLICY IF EXISTS "Public read for team targets on TV" ON public.team_targets;
DROP POLICY IF EXISTS "Public read for weekday target overrides on TV" ON public.team_target_weekday_overrides;
REVOKE SELECT ON public.team_targets FROM anon;
REVOKE SELECT ON public.team_target_weekday_overrides FROM anon;