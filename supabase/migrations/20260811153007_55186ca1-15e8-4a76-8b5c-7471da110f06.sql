CREATE TABLE public.tv_ranking_manual_exclusions (
  email text PRIMARY KEY,
  ranking text NOT NULL CHECK (ranking IN ('sdr','closer','all')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tv_ranking_manual_exclusions TO service_role;

ALTER TABLE public.tv_ranking_manual_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.tv_ranking_manual_exclusions
FOR ALL TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.tv_ranking_manual_exclusions (email, ranking, reason)
VALUES ('ygor.ferreira@minhacasafinanciada.com', 'sdr', 'desligado - pendente RH')
ON CONFLICT (email) DO NOTHING;

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
  manual AS (
    SELECT lower(x.email) AS email
    FROM public.tv_ranking_manual_exclusions x
    WHERE x.ranking IN ('sdr','all')
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
      AND mes.email NOT IN (SELECT email FROM manual)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sdr_name', sdr_name, 'mes', mes, 'dia', dia)
           ORDER BY mes DESC, dia DESC, sdr_name), '[]'::jsonb)
  INTO v_out
  FROM joined;

  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tv_incorporador_closer_ranking_rows()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := (now() at time zone 'America/Sao_Paulo')::date;
  v_month_start DATE := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_out JSONB;
BEGIN
  WITH base AS (
    SELECT attendee_id, deal_id, closer_id, closer_name, eff_date
    FROM public.caucoes_efetivas(v_month_start, v_today, 'incorporador')
    WHERE closer_name IS NOT NULL
  ),
  inactive AS (
    SELECT id FROM public.closers WHERE is_active IS FALSE
  ),
  manual AS (
    SELECT lower(x.email) AS email
    FROM public.tv_ranking_manual_exclusions x
    WHERE x.ranking IN ('closer','all')
  ),
  manual_ids AS (
    SELECT c.id FROM public.closers c
    WHERE lower(c.email) IN (SELECT email FROM manual)
  ),
  manual_names AS (
    SELECT DISTINCT lower(trim(c.name)) AS name
    FROM public.closers c
    WHERE lower(c.email) IN (SELECT email FROM manual)
  ),
  agg AS (
    SELECT b.closer_name AS name,
           count(*) AS mes,
           count(*) FILTER (WHERE b.eff_date = v_today) AS dia
    FROM base b
    WHERE (b.closer_id IS NULL OR b.closer_id NOT IN (SELECT id FROM inactive))
      AND (b.closer_id IS NULL OR b.closer_id NOT IN (SELECT id FROM manual_ids))
      AND lower(trim(b.closer_name)) NOT IN (SELECT name FROM manual_names)
    GROUP BY b.closer_name
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'mes', mes, 'dia', dia)
           ORDER BY mes DESC, dia DESC, name), '[]'::jsonb)
  INTO v_out FROM agg;

  RETURN v_out;
END;
$function$;