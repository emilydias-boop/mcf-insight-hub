
CREATE POLICY "academia_evid_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='academia-evidencias' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "academia_evid_ver" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='academia-evidencias' AND public.academia_pode_ver(((storage.foldername(name))[1])::uuid));

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname LIKE 'academia\_%' LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
