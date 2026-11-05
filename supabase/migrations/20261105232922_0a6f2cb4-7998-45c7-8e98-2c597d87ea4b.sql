CREATE SCHEMA IF NOT EXISTS gov_private;
REVOKE ALL ON SCHEMA gov_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA gov_private TO authenticated,service_role;
ALTER FUNCTION public.gov_meu_employee() SET SCHEMA gov_private;
ALTER FUNCTION public.gov_requisicao_opcoes() SET SCHEMA gov_private;
CREATE FUNCTION public.gov_meu_employee() RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_meu_employee() $$;
CREATE FUNCTION public.gov_requisicao_opcoes() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gov_private.gov_requisicao_opcoes() $$;
REVOKE ALL ON FUNCTION public.gov_meu_employee(),public.gov_requisicao_opcoes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gov_meu_employee(),public.gov_requisicao_opcoes() TO authenticated,service_role;