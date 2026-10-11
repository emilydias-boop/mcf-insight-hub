DO $$
DECLARE s text;
BEGIN
FOREACH s IN ARRAY ARRAY[
 'public.cleanup_stuck_automation_queue()',
 'public.link_contacts_to_origins_via_deals()',
 'public.meetgeek_reivindicar_analise(integer)',
 'public.script_reavaliar(text)',
 'public.wa_broadcast_ignorar_nome_invalido(uuid)',
 'public.wa_broadcast_preencher_variaveis(uuid)']
LOOP
 EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', s);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', s);
END LOOP;
END $$;