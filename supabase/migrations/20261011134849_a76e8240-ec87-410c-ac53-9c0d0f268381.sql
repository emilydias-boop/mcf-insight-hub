DO $$
DECLARE r record;
BEGIN
FOR r IN select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'execute')
 and p.prorettype <> 'trigger'::regtype
 and p.proname !~ '^(get_bi_public|get_tv_|tv_|has_|can_|is_|get_team_dashboard_public|_|resolve_|build_)'
 and p.proname not in ('get_user_role','user_has_permission','credito_e_do_time','wa_is_opted_out')
LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
END LOOP;
END $$;