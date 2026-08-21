CREATE OR REPLACE FUNCTION public.wa_enviados_1a1_hoje(_user_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
    from public.wa_messages m
   where m.direction = 'outbound'
     and (m.created_at at time zone 'America/Sao_Paulo')::date
         = (now() at time zone 'America/Sao_Paulo')::date
     and (_user_id is null or m.sent_by_user_id = _user_id)
     -- exclui mensagens que pertencem a um disparo (vinculo confiavel por id)
     and not exists (
       select 1 from public.wa_broadcast_targets t where t.message_id = m.id
     )
     -- rede de seguranca para disparos antigos sem message_id populado
     and coalesce(m.sent_by_name, '') not like 'Disparo:%'
$function$;

GRANT EXECUTE ON FUNCTION public.wa_enviados_1a1_hoje(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wa_enviados_1a1_hoje(uuid) TO service_role;