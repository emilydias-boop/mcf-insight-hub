CREATE OR REPLACE FUNCTION public.get_closer_breakdown_metrics(start_date text, end_date text, bu_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  today_sp DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  start_d DATE := start_date::date;
  end_d DATE := end_date::date;
  effective_end DATE := LEAST(end_d, today_sp);
BEGIN
  WITH raw_attendees AS (
    SELECT
      cl.id as closer_id,
      cl.name as closer_name,
      cl.bu as closer_bu,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
      msa.contract_paid_at
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    INNER JOIN closers cl ON cl.id = ms.closer_id
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (bu_filter IS NULL OR cl.bu = bu_filter)
  ),
  -- R1 RECEBIDA (janela completa — planejamento)
  recebida_per_lead AS (
    SELECT closer_id, deal_id, LEAST(COUNT(DISTINCT meeting_day), 2) as cnt
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
    GROUP BY closer_id, deal_id
  ),
  recebida_agg AS (
    SELECT closer_id, SUM(cnt) as r1_recebida
    FROM recebida_per_lead GROUP BY closer_id
  ),
  -- R1 REALIZADA (fato — cap em hoje)
  realizada_per_lead AS (
    SELECT closer_id, deal_id,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_d AND effective_end
    GROUP BY closer_id, deal_id
  ),
  realizada_agg AS (
    SELECT closer_id, SUM(realized) as r1_realizada
    FROM realizada_per_lead GROUP BY closer_id
  ),
  -- NO-SHOWS (fato — cap em hoje + cap 1/2 por lead)
  noshow_per_lead AS (
    SELECT closer_id, deal_id,
      LEAST(COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day >= DATE '2026-04-28'), 2)
      +
      LEAST(COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day < DATE '2026-04-28'), 1)
      as cnt
    FROM raw_attendees
    WHERE status = 'no_show'
      AND meeting_day BETWEEN start_d AND effective_end
    GROUP BY closer_id, deal_id
  ),
  noshow_agg AS (
    SELECT closer_id, SUM(cnt) as no_shows
    FROM noshow_per_lead GROUP BY closer_id
  ),
  -- CONTRATOS (fato — cap em hoje)
  contratos_agg AS (
    SELECT closer_id, COUNT(DISTINCT deal_id) FILTER (WHERE deal_id IS NOT NULL) as contratos_with_deal,
           COUNT(*) FILTER (WHERE deal_id IS NULL) as contratos_no_deal
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
    GROUP BY closer_id
  ),
  closer_universe AS (
    SELECT DISTINCT closer_id, closer_name, closer_bu
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
      OR (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND end_d
  )
  SELECT json_build_object(
    'effective_end_date', effective_end::text,
    'today_sp', today_sp::text,
    'closers',
    COALESCE(json_agg(json_build_object(
      'closer_id', u.closer_id,
      'closer_name', u.closer_name,
      'closer_bu', u.closer_bu,
      'r1_recebida', COALESCE(rc.r1_recebida, 0),
      'r1_realizada', COALESCE(rz.r1_realizada, 0),
      'no_shows', COALESCE(ns.no_shows, 0),
      'contratos', COALESCE(c.contratos_with_deal, 0) + COALESCE(c.contratos_no_deal, 0)
    )), '[]'::json)
  ) INTO result
  FROM closer_universe u
  LEFT JOIN recebida_agg rc ON rc.closer_id = u.closer_id
  LEFT JOIN realizada_agg rz ON rz.closer_id = u.closer_id
  LEFT JOIN noshow_agg ns ON ns.closer_id = u.closer_id
  LEFT JOIN contratos_agg c ON c.closer_id = u.closer_id;

  RETURN COALESCE(result, json_build_object(
    'effective_end_date', effective_end::text,
    'today_sp', today_sp::text,
    'closers', '[]'::json
  ));
END;
$function$;