CREATE TABLE IF NOT EXISTS public.tv_public_snapshots (
  key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.tv_public_snapshots TO service_role;
ALTER TABLE public.tv_public_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to tv_public_snapshots"
  ON public.tv_public_snapshots FOR SELECT USING (false);

-- ===== Ranking de SDRs (agendamentos) da BU incorporador =====
CREATE OR REPLACE FUNCTION public.tv_incorporador_sdr_ranking_rows()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  joined AS (
    SELECT mes.name AS sdr_name,
           mes.agendamentos AS mes,
           COALESCE(dia.agendamentos, 0) AS dia
    FROM mes
    LEFT JOIN dia ON dia.email = mes.email
    WHERE mes.email IS NOT NULL
      AND mes.email NOT IN (SELECT email FROM excluded)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('sdr_name', sdr_name, 'mes', mes, 'dia', dia)
           ORDER BY mes DESC, dia DESC, sdr_name), '[]'::jsonb)
  INTO v_out
  FROM joined;

  RETURN v_out;
END;
$function$;

-- ===== Payload completo do painel (sem token) =====
CREATE OR REPLACE FUNCTION public.tv_incorporador_payload()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := (now() at time zone 'America/Sao_Paulo')::date;
  v_month_start DATE := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_dow INT := extract(dow from (now() at time zone 'America/Sao_Paulo')::date);
  v_da RECORD; v_db RECORD; v_ma RECORD; v_mb RECORD;
  v_meta_ag_dia NUMERIC := 0; v_meta_r1r_dia NUMERIC := 0; v_meta_ns_dia NUMERIC := 0; v_meta_ct_dia NUMERIC := 0;
  v_meta_ag_mes NUMERIC := 0; v_meta_r1r_mes NUMERIC := 0; v_meta_ns_mes NUMERIC := 0; v_meta_ct_mes NUMERIC := 0;
  v_flat_ag_dia NUMERIC := 0; v_flat_r1r_dia NUMERIC := 0; v_flat_ns_dia NUMERIC := 0; v_flat_ct_dia NUMERIC := 0;
BEGIN
  SELECT * INTO v_da FROM public.tv_incorporador_seg_sums(v_today, v_today, 'A');
  SELECT * INTO v_db FROM public.tv_incorporador_seg_sums(v_today, v_today, 'B');
  SELECT * INTO v_ma FROM public.tv_incorporador_seg_sums(v_month_start, v_today, 'A');
  SELECT * INTO v_mb FROM public.tv_incorporador_seg_sums(v_month_start, v_today, 'B');

  SELECT
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_agendamento_mes'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_r1_realizada_mes'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_noshow_mes'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_contrato_mes'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_agendamento_dia'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_r1_realizada_dia'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_noshow_dia'),0),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_contrato_dia'),0)
  INTO v_meta_ag_mes, v_meta_r1r_mes, v_meta_ns_mes, v_meta_ct_mes,
       v_flat_ag_dia, v_flat_r1r_dia, v_flat_ns_dia, v_flat_ct_dia
  FROM public.team_targets
  WHERE v_today BETWEEN week_start AND week_end
    AND target_type IN ('sdr_agendamento_dia','sdr_r1_realizada_dia','sdr_noshow_dia','sdr_contrato_dia',
                         'sdr_agendamento_mes','sdr_r1_realizada_mes','sdr_noshow_mes','sdr_contrato_mes');

  SELECT
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_agendamento_dia'), v_flat_ag_dia),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_r1_realizada_dia'), v_flat_r1r_dia),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_noshow_dia'), v_flat_ns_dia),
    COALESCE(MAX(target_value) FILTER (WHERE target_type='sdr_contrato_dia'), v_flat_ct_dia)
  INTO v_meta_ag_dia, v_meta_r1r_dia, v_meta_ns_dia, v_meta_ct_dia
  FROM public.team_target_weekday_overrides
  WHERE month_start = v_month_start
    AND day_of_week = v_dow
    AND target_type IN ('sdr_agendamento_dia','sdr_r1_realizada_dia','sdr_noshow_dia','sdr_contrato_dia');

  RETURN jsonb_build_object(
    'updated_at', now(),
    'today', v_today,
    'sdr_ranking', public.tv_incorporador_sdr_ranking_rows(),
    'dia', jsonb_build_object(
      'agendamento', jsonb_build_object('atual', v_da.agendamento + v_db.agendamento, 'meta', v_meta_ag_dia),
      'r1_realizada', jsonb_build_object('atual', v_da.r1_realizada + v_db.r1_realizada, 'meta', v_meta_r1r_dia),
      'no_show', jsonb_build_object('atual', v_da.no_shows + v_db.no_shows, 'meta', v_meta_ns_dia),
      'contrato_pago', jsonb_build_object('atual', v_da.contratos + v_db.contratos, 'meta', v_meta_ct_dia),
      'a', jsonb_build_object(
        'agendamento', jsonb_build_object('atual', v_da.agendamento, 'meta', v_meta_ag_dia),
        'r1_realizada', jsonb_build_object('atual', v_da.r1_realizada, 'meta', v_meta_r1r_dia),
        'no_show', jsonb_build_object('atual', v_da.no_shows, 'meta', v_meta_ns_dia,
          'pct_agendados', CASE WHEN v_da.r1_agendada > 0 THEN round((v_da.no_shows::numeric / v_da.r1_agendada) * 100, 1) ELSE 0 END),
        'contrato_pago', jsonb_build_object('atual', v_da.contratos, 'meta', v_meta_ct_dia)
      ),
      'b', jsonb_build_object(
        'agendamento', jsonb_build_object('atual', v_db.agendamento, 'meta', 0),
        'r1_realizada', jsonb_build_object('atual', v_db.r1_realizada, 'meta', 0),
        'no_show', jsonb_build_object('atual', v_db.no_shows, 'meta', 0,
          'pct_agendados', CASE WHEN v_db.r1_agendada > 0 THEN round((v_db.no_shows::numeric / v_db.r1_agendada) * 100, 1) ELSE 0 END),
        'contrato_pago', jsonb_build_object('atual', v_db.contratos, 'meta', 0)
      )
    ),
    'mes', jsonb_build_object(
      'agendamento', jsonb_build_object('atual', v_ma.agendamento + v_mb.agendamento, 'meta', v_meta_ag_mes),
      'r1_realizada', jsonb_build_object('atual', v_ma.r1_realizada + v_mb.r1_realizada, 'meta', v_meta_r1r_mes),
      'no_show', jsonb_build_object('atual', v_ma.no_shows + v_mb.no_shows, 'meta', v_meta_ns_mes),
      'contrato_pago', jsonb_build_object('atual', v_ma.contratos + v_mb.contratos, 'meta', v_meta_ct_mes),
      'a', jsonb_build_object(
        'agendamento', jsonb_build_object('atual', v_ma.agendamento, 'meta', v_meta_ag_mes),
        'r1_realizada', jsonb_build_object('atual', v_ma.r1_realizada, 'meta', v_meta_r1r_mes),
        'no_show', jsonb_build_object('atual', v_ma.no_shows, 'meta', v_meta_ns_mes,
          'pct_agendados', CASE WHEN v_ma.r1_agendada > 0 THEN round((v_ma.no_shows::numeric / v_ma.r1_agendada) * 100, 1) ELSE 0 END),
        'contrato_pago', jsonb_build_object('atual', v_ma.contratos, 'meta', v_meta_ct_mes)
      ),
      'b', jsonb_build_object(
        'agendamento', jsonb_build_object('atual', v_mb.agendamento, 'meta', 0),
        'r1_realizada', jsonb_build_object('atual', v_mb.r1_realizada, 'meta', 0),
        'no_show', jsonb_build_object('atual', v_mb.no_shows, 'meta', 0,
          'pct_agendados', CASE WHEN v_mb.r1_agendada > 0 THEN round((v_mb.no_shows::numeric / v_mb.r1_agendada) * 100, 1) ELSE 0 END),
        'contrato_pago', jsonb_build_object('atual', v_mb.contratos, 'meta', 0)
      )
    )
  );
END;
$function$;

-- ===== Refresh do snapshot (executado pelo cron) =====
CREATE OR REPLACE FUNCTION public.tv_refresh_incorporador_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tv_public_snapshots (key, payload, computed_at)
  VALUES ('tv_incorporador_equipe', public.tv_incorporador_payload(), now())
  ON CONFLICT (key) DO UPDATE
    SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
END;
$function$;

-- ===== Função pública: token + leitura do snapshot =====
CREATE OR REPLACE FUNCTION public.get_tv_incorporador_public(_token text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid BOOLEAN;
  v_payload JSONB;
  v_computed TIMESTAMPTZ;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.bi_public_tokens
    WHERE token = _token AND bu = 'tv_incorporador_equipe' AND active = true
  ) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;

  SELECT payload, computed_at INTO v_payload, v_computed
  FROM public.tv_public_snapshots
  WHERE key = 'tv_incorporador_equipe';

  IF v_payload IS NULL OR v_computed < now() - interval '20 minutes' THEN
    v_payload := public.tv_incorporador_payload();
    INSERT INTO public.tv_public_snapshots (key, payload, computed_at)
    VALUES ('tv_incorporador_equipe', v_payload, now())
    ON CONFLICT (key) DO UPDATE
      SET payload = EXCLUDED.payload, computed_at = EXCLUDED.computed_at;
  END IF;

  RETURN v_payload;
END;
$function$;

SELECT cron.schedule(
  'tv-incorporador-snapshot-refresh',
  '* * * * *',
  $$SELECT public.tv_refresh_incorporador_snapshot();$$
);

SELECT public.tv_refresh_incorporador_snapshot();