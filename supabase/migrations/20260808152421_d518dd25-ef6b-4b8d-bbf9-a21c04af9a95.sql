CREATE OR REPLACE FUNCTION public.operacional_incorporador_daily(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_origins uuid[] := ARRAY['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid,'7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid];
  v_result jsonb;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'Intervalo inválido';
  END IF;
  IF (p_to - p_from) > 44 THEN
    RAISE EXCEPTION 'Intervalo máximo de 45 dias';
  END IF;

  WITH dias AS (
    SELECT d::date AS dia FROM generate_series(p_from, p_to, interval '1 day') d
  ),
  -- leads captados
  lc AS (
    SELECT (dl.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           count(*) AS total,
           count(*) FILTER (
             WHERE EXISTS (SELECT 1 FROM unnest(coalesce(dl.tags,'{}'::text[])) t WHERE upper(t) LIKE 'A010%')
                OR coalesce(dl.product_name,'') ILIKE 'A010%'
           ) AS a010
    FROM crm_deals dl
    WHERE dl.origin_id = ANY(v_origins)
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
      AND (dl.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    GROUP BY 1
  ),
  -- leads contactados (primeira ligação no dia)
  ct AS (
    SELECT (y.f AT TIME ZONE 'America/Sao_Paulo')::date AS dia, count(*) AS n
    FROM (
      SELECT cl.deal_id, min(cl.started_at) AS f
      FROM calls cl
      JOIN crm_deals dl ON dl.id = cl.deal_id AND dl.origin_id = ANY(v_origins)
      GROUP BY cl.deal_id
    ) y
    WHERE (y.f AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    GROUP BY 1
  ),
  -- agendamentos R1 por SDR (data do booking)
  ag_raw AS (
    SELECT (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           coalesce(p.full_name, 'Não identificado') AS nome, count(*) AS c
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type = 'r1'
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    LEFT JOIN profiles p ON p.id = a.booked_by
    WHERE (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
    GROUP BY 1,2
  ),
  ag AS (
    SELECT dia, jsonb_object_agg(nome, c) AS obj, sum(c) AS total FROM ag_raw GROUP BY dia
  ),
  -- agenda R1 do dia (por scheduled_at)
  r1_raw AS (
    SELECT (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           a.status, coalesce(c.name,'Não identificado') AS closer
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r1'
    LEFT JOIN closers c ON c.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
  ),
  r1_marc AS (SELECT dia, count(*) AS n FROM r1_raw GROUP BY dia),
  r1_ok AS (
    SELECT dia, jsonb_object_agg(closer, c) AS obj, sum(c) AS total FROM (
      SELECT dia, closer, count(*) AS c FROM r1_raw WHERE status IN ('completed','contract_paid') GROUP BY 1,2
    ) q GROUP BY dia
  ),
  r1_ns AS (
    SELECT dia, jsonb_object_agg(closer, c) AS obj, sum(c) AS total FROM (
      SELECT dia, closer, count(*) AS c FROM r1_raw WHERE status = 'no_show' GROUP BY 1,2
    ) q GROUP BY dia
  ),
  -- cauções
  cauc AS (
    SELECT dia, jsonb_object_agg(closer, c) AS obj, sum(c) AS total FROM (
      SELECT (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
             coalesce(cl.name,'Não identificado') AS closer, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id
      LEFT JOIN closers cl ON cl.id = s.closer_id
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE a.contract_paid_at IS NOT NULL
        AND (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      GROUP BY 1,2
    ) q GROUP BY dia
  ),
  -- R2
  r2 AS (
    SELECT dia, sum(agendadas) AS agendadas, sum(realizadas) AS realizadas FROM (
      SELECT (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
             1 AS agendadas, 0 AS realizadas
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
        AND (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      UNION ALL
      SELECT (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia, 0, 1
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
        AND a.status IN ('completed','contract_paid')
        AND (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    ) u GROUP BY dia
  ),
  -- vendas (stage Venda realizada)
  vd AS (
    SELECT (dl.stage_moved_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           count(*) AS qtd, coalesce(sum(coalesce(dl.value,0)),0) AS valor
    FROM crm_deals dl
    JOIN crm_stages cs ON cs.id = dl.stage_id
    WHERE dl.origin_id = ANY(v_origins)
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
      AND cs.stage_name ILIKE 'Venda%realizada'
      AND (dl.stage_moved_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    GROUP BY 1
  )
  SELECT jsonb_build_object('dias', coalesce(jsonb_agg(jsonb_build_object(
      'data', to_char(dias.dia,'YYYY-MM-DD'),
      'leads_captados', coalesce(lc.total,0),
      'leads_a010', coalesce(lc.a010,0),
      'leads_contactados', coalesce(ct.n,0),
      'agendamentos_por_sdr', coalesce(ag.obj,'{}'::jsonb),
      'agendamentos_total', coalesce(ag.total,0),
      'agenda_r1_marcadas', coalesce(r1_marc.n,0),
      'r1_realizadas_por_closer', coalesce(r1_ok.obj,'{}'::jsonb),
      'r1_realizadas_total', coalesce(r1_ok.total,0),
      'noshow_por_closer', coalesce(r1_ns.obj,'{}'::jsonb),
      'noshow_total', coalesce(r1_ns.total,0),
      'caucoes_por_closer', coalesce(cauc.obj,'{}'::jsonb),
      'caucoes_total', coalesce(cauc.total,0),
      'caucoes_valor', coalesce(cauc.total,0) * 497,
      'r2_agendadas', coalesce(r2.agendadas,0),
      'r2_realizadas', coalesce(r2.realizadas,0),
      'vendas_qtd', coalesce(vd.qtd,0),
      'vendas_valor', coalesce(vd.valor,0)
    ) ORDER BY dias.dia), '[]'::jsonb))
  INTO v_result
  FROM dias
  LEFT JOIN lc ON lc.dia = dias.dia
  LEFT JOIN ct ON ct.dia = dias.dia
  LEFT JOIN ag ON ag.dia = dias.dia
  LEFT JOIN r1_marc ON r1_marc.dia = dias.dia
  LEFT JOIN r1_ok ON r1_ok.dia = dias.dia
  LEFT JOIN r1_ns ON r1_ns.dia = dias.dia
  LEFT JOIN cauc ON cauc.dia = dias.dia
  LEFT JOIN r2 ON r2.dia = dias.dia
  LEFT JOIN vd ON vd.dia = dias.dia;

  RETURN v_result;
END;
$function$;