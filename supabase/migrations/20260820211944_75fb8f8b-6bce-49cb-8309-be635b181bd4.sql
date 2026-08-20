-- boletos storage bucket scoping
DROP POLICY IF EXISTS "Authenticated users can view consorcio boletos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload consorcio boletos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update consorcio boletos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete consorcio boletos" ON storage.objects;

CREATE POLICY "Consorcio staff can view consorcio boletos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'consorcio-boletos' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can upload consorcio boletos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'consorcio-boletos' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can update consorcio boletos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'consorcio-boletos' AND public.can_access_consorcio_pii(auth.uid())) WITH CHECK (bucket_id = 'consorcio-boletos' AND public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Consorcio staff can delete consorcio boletos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'consorcio-boletos' AND public.can_access_consorcio_pii(auth.uid()));

-- lead_profiles PII scoping (same staff population as consortium PII)
DROP POLICY IF EXISTS "Authenticated users can view lead_profiles" ON public.lead_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert lead_profiles" ON public.lead_profiles;
DROP POLICY IF EXISTS "Authenticated users can update lead_profiles" ON public.lead_profiles;

CREATE POLICY "Staff can view lead_profiles" ON public.lead_profiles FOR SELECT TO authenticated USING (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Staff can insert lead_profiles" ON public.lead_profiles FOR INSERT TO authenticated WITH CHECK (public.can_access_consorcio_pii(auth.uid()));
CREATE POLICY "Staff can update lead_profiles" ON public.lead_profiles FOR UPDATE TO authenticated USING (public.can_access_consorcio_pii(auth.uid())) WITH CHECK (public.can_access_consorcio_pii(auth.uid()));