CREATE OR REPLACE FUNCTION public.tv_incorporador_seg_sums(_start date, _end date, _seg text)
RETURNS TABLE(agendamento int, r1_agendada int, r1_realizada int, no_shows int, contratos int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_metrics JSON;
BEGIN
  v_result := public.get_sdr_metrics_from_agenda(_start::text, _end::text, NULL, 'incorporador', _seg);
  v_metrics := v_result->'metrics';

  RETURN QUERY
  WITH raw_m AS (
    SELECT
      m->>'sdr_email' AS sdr_email,
      COALESCE((m->>'agendamentos')::int, 0) AS agendamentos,
      COALESCE((m->>'r1_agendada')::int, 0) AS r1_agendada,
      COALESCE((m->>'r1_realizada')::int, 0) AS r1_realizada,
      COALESCE((m->>'no_shows')::int, 0) AS no_shows,
      COALESCE((m->>'contratos')::int, 0) AS contratos
    FROM json_array_elements(COALESCE(v_metrics, '[]'::json)) m
  ),
  excluded AS (
    SELECT DISTINCT lower(p.email) AS email
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role IN ('admin','manager','coordenador','assistente_administrativo','closer','closer_sombra')
  )
  SELECT
    COALESCE(SUM(r.agendamentos), 0)::int,
    COALESCE(SUM(r.r1_agendada), 0)::int,
    COALESCE(SUM(r.r1_realizada), 0)::int,
    COALESCE(SUM(r.no_shows), 0)::int,
    COALESCE(SUM(r.contratos), 0)::int
  FROM raw_m r
  WHERE lower(r.sdr_email) NOT IN (SELECT email FROM excluded);
END;
$function$;

REVOKE ALL ON FUNCTION public.tv_incorporador_seg_sums(date, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tv_incorporador_seg_sums(date, date, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_tv_incorporador_public(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valid BOOLEAN;
  v_today DATE := (now() at time zone 'America/Sao_Paulo')::date;
  v_month_start DATE := date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
  v_dow INT := extract(dow from (now() at time zone 'America/Sao_Paulo')::date);
  -- dia por segmento
  v_da RECORD; v_db RECORD; v_ma RECORD; v_mb RECORD;
  -- metas
  v_meta_ag_dia NUMERIC := 0; v_meta_r1r_dia NUMERIC := 0; v_meta_ns_dia NUMERIC := 0; v_meta_ct_dia NUMERIC := 0;
  v_meta_ag_mes NUMERIC := 0; v_meta_r1r_mes NUMERIC := 0; v_meta_ns_mes NUMERIC := 0; v_meta_ct_mes NUMERIC := 0;
  v_flat_ag_dia NUMERIC := 0; v_flat_r1r_dia NUMERIC := 0; v_flat_ns_dia NUMERIC := 0; v_flat_ct_dia NUMERIC := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.bi_public_tokens
    WHERE token = _token AND bu = 'tv_incorporador_equipe' AND active = true
  ) INTO v_valid;
  IF NOT v_valid THEN
    RETURN jsonb_build_object('error','invalid_token');
  END IF;

  SELECT * INTO v_da FROM public.tv_incorporador_seg_sums(v_today, v_today, 'A');
  SELECT * INTO v_db FROM public.tv_incorporador_seg_sums(v_today, v_today, 'B');
  SELECT * INTO v_ma FROM public.tv_incorporador_seg_sums(v_month_start, v_today, 'A');
  SELECT * INTO v_mb FROM public.tv_incorporador_seg_sums(v_month_start, v_today, 'B');

  -- ===== Metas MÊS (team_targets, inalterado) =====
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