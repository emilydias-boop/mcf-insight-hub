CREATE OR REPLACE FUNCTION public.tv_incorporador_sdr_ranking_rows()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := (now() at time zone 'America/Sao_Paulo')::date;
  v_month_start DATE := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_mes JSON;
  v_dia JSON;
  v_out JSONB;
BEGIN
  v_mes := public.get_sdr_metrics_from_agenda(v_month_start::text, v_today::text, NULL, 'incorporador', NULL)->'metrics';
  v_dia := public.get_sdr_metrics_from_agenda(v_today::text, v_today::text, NULL, 'incorporador', NULL)->'metrics';

  WITH mes AS (
    SELECT lower(m->>'sdr_email') AS email,
           COALESCE(m->>'sdr_name', m->>'sdr_email') AS name,
           COALESCE((m->>'agendamentos')::int, 0) AS agendamentos
    FROM json_array_elements(COALESCE(v_mes, '[]'::json)) m
  ),
  dia AS (
    SELECT lower(m->>'sdr_email') AS email,
           COALESCE((m->>'agendamentos')::int, 0) AS agendamentos
    FROM json_array_elements(COALESCE(v_dia, '[]'::json)) m
  ),
  excluded AS (
    SELECT DISTINCT lower(p.email) AS email
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role IN ('admin','manager','coordenador','assistente_administrativo','closer','closer_sombra')
  ),
  inactive AS (
    SELECT DISTINCT lower(s.email) AS email
    FROM public.sdr s
    WHERE s.active IS FALSE AND s.email IS NOT NULL
    UNION
    SELECT DISTINCT lower(e.email_pessoal) AS email
    FROM public.employees e
    WHERE e.status = 'desligado' AND e.email_pessoal IS NOT NULL
  ),
  joined AS (
    SELECT mes.name AS sdr_name,
           mes.agendamentos AS mes,
           COALESCE(dia.agendamentos, 0) AS dia
    FROM mes
    LEFT JOIN dia ON dia.email = mes.email
    WHERE mes.email IS NOT NULL
      AND mes.email NOT IN (SELECT email FROM excluded)
      AND mes.email NOT IN (SELECT email FROM inactive)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sdr_name', sdr_name, 'mes', mes, 'dia', dia)
           ORDER BY mes DESC, dia DESC, sdr_name), '[]'::jsonb)
  INTO v_out
  FROM joined;

  RETURN v_out;
END;
$function$;