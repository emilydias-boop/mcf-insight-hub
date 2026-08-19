CREATE OR REPLACE FUNCTION public.get_agenda_totais_consorcio(start_date text, end_date text)
 RETURNS TABLE(origin_name text, agendamentos integer, r1_agendada integer, r1_realizada integer, no_shows integer, contratos integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    f.origin_name,
    COUNT(*) FILTER (WHERE f.fato = 'agendamento')::int,
    COUNT(*) FILTER (WHERE f.fato = 'agendada')::int,
    COUNT(*) FILTER (WHERE f.fato = 'realizada')::int,
    COUNT(*) FILTER (WHERE f.fato = 'no_show')::int,
    COUNT(*) FILTER (WHERE f.fato = 'fechada_agenda')::int
  FROM public.get_agenda_fatos_consorcio(start_date, end_date) f
  GROUP BY f.origin_name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_agenda_totais_consorcio(text, text) TO authenticated, service_role;