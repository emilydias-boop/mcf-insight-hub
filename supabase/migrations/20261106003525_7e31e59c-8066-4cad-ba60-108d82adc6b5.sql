REVOKE ALL ON public.gov_desligamentos FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.gov_desligamentos FROM authenticated;
GRANT SELECT ON public.gov_desligamentos TO authenticated;
GRANT ALL ON public.gov_desligamentos TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;