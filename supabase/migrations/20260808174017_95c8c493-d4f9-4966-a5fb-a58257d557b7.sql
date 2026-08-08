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
  r1_raw AS (
    SELECT (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           a.status, coalesce(c.name,'Não identificado') AS closer,
           coalesce(p.full_name,'Não identificado') AS sdr
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r1'
    LEFT JOIN closers c ON c.id = s.closer_id
    LEFT JOIN profiles p ON p.id = a.booked_by
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
  r1_ns_sdr AS (
    SELECT dia, jsonb_object_agg(sdr, c) AS obj, sum(c) AS total FROM (
      SELECT dia, sdr, count(*) AS c FROM r1_raw WHERE status = 'no_show' GROUP BY 1,2
    ) q GROUP BY dia
  ),
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
  r2_raw AS (
    SELECT (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           coalesce(cl.name,'Não identificado') AS closer,
           1 AS agendadas, 0 AS realizadas
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
    LEFT JOIN closers cl ON cl.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
      AND (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
    UNION ALL
    SELECT (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           coalesce(cl.name,'Não identificado') AS closer, 0, 1
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
    LEFT JOIN closers cl ON cl.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
      AND a.status IN ('completed','contract_paid')
      AND (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
  ),
  r2 AS (
    SELECT dia, sum(agendadas) AS agendadas, sum(realizadas) AS realizadas FROM r2_raw GROUP BY dia
  ),
  r2_closer AS (
    SELECT dia, jsonb_object_agg(closer, jsonb_build_object('agendadas', ag, 'realizadas', re)) AS obj
    FROM (
      SELECT dia, closer, sum(agendadas) AS ag, sum(realizadas) AS re
      FROM r2_raw GROUP BY 1,2
    ) x GROUP BY dia
  ),
  vd_base AS (
    SELECT (dl.stage_moved_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
           dl.id AS deal_id,
           coalesce(dl.value,0) AS valor,
           public.oi_classify_origem(dl.product_name, dl.tags, cc.tags) AS origem,
           coalesce((
             SELECT ht.product_name
             FROM hubla_transactions ht
             WHERE (ht.linked_deal_id = dl.id
                    OR (coalesce(lower(trim(cc.email)),'') <> '' AND lower(trim(ht.customer_email)) = lower(trim(cc.email))))
               AND public.oi_is_venda_produto(ht.product_name)
               AND coalesce(ht.sale_status,'') NOT IN ('refunded','canceled','cancelado','refused','expired')
               AND ht.sale_date >= dl.stage_moved_at - interval '90 days'
               AND ht.sale_date <= dl.stage_moved_at + interval '30 days'
             ORDER BY ht.sale_date DESC
             LIMIT 1
           ), 'Não identificado') AS produto,
           coalesce((
             SELECT cl2.name
             FROM meeting_slot_attendees a2
             JOIN meeting_slots s2 ON s2.id = a2.meeting_slot_id
             JOIN closers cl2 ON cl2.id = s2.closer_id
             WHERE a2.deal_id = dl.id
               AND coalesce(a2.status,'') NOT IN ('cancelled','canceled')
               AND s2.meeting_type IN ('r1','r2')
               AND s2.scheduled_at <= dl.stage_moved_at + interval '1 day'
             ORDER BY (s2.meeting_type = 'r2') DESC, s2.scheduled_at DESC
             LIMIT 1
           ), 'Não identificado') AS closer_venda,
           coalesce((
             SELECT p2.full_name
             FROM meeting_slot_attendees a3
             JOIN meeting_slots s3 ON s3.id = a3.meeting_slot_id AND s3.meeting_type = 'r1'
             JOIN profiles p2 ON p2.id = a3.booked_by
             WHERE a3.deal_id = dl.id
               AND coalesce(a3.status,'') NOT IN ('cancelled','canceled')
             ORDER BY coalesce(a3.booked_at, a3.created_at) ASC
             LIMIT 1
           ), 'Não identificado') AS sdr_venda
    FROM crm_deals dl
    JOIN crm_stages cs ON cs.id = dl.stage_id
    LEFT JOIN crm_contacts cc ON cc.id = dl.contact_id
    WHERE dl.origin_id = ANY(v_origins)
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
      AND cs.stage_name ILIKE 'Venda%realizada'
      AND (dl.stage_moved_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
  ),
  vd AS (
    SELECT dia, count(*) AS qtd, coalesce(sum(valor),0) AS valor FROM vd_base GROUP BY 1
  ),
  vd_prod AS (
    SELECT dia, jsonb_object_agg(produto, jsonb_build_object('qtd', q, 'valor', v)) AS obj
    FROM (SELECT dia, produto, count(*) AS q, coalesce(sum(valor),0) AS v FROM vd_base GROUP BY 1,2) x
    GROUP BY dia
  ),
  vd_orig AS (
    SELECT dia, jsonb_object_agg(origem, jsonb_build_object('qtd', q, 'valor', v)) AS obj
    FROM (SELECT dia, origem, count(*) AS q, coalesce(sum(valor),0) AS v FROM vd_base GROUP BY 1,2) x
    GROUP BY dia
  ),
  vd_closer AS (
    SELECT dia, jsonb_object_agg(closer_venda, q) AS obj
    FROM (SELECT dia, closer_venda, count(*) AS q FROM vd_base GROUP BY 1,2) x
    GROUP BY dia
  ),
  vd_sdr AS (
    SELECT dia, jsonb_object_agg(sdr_venda, q) AS obj
    FROM (SELECT dia, sdr_venda, count(*) AS q FROM vd_base GROUP BY 1,2) x
    GROUP BY dia
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
      'noshow_por_sdr', coalesce(r1_ns_sdr.obj,'{}'::jsonb),
      'noshow_total', coalesce(r1_ns.total,0),
      'caucoes_por_closer', coalesce(cauc.obj,'{}'::jsonb),
      'caucoes_total', coalesce(cauc.total,0),
      'caucoes_valor', coalesce(cauc.total,0) * 497,
      'r2_agendadas', coalesce(r2.agendadas,0),
      'r2_realizadas', coalesce(r2.realizadas,0),
      'r2_por_closer', coalesce(r2_closer.obj,'{}'::jsonb),
      'vendas_qtd', coalesce(vd.qtd,0),
      'vendas_valor', coalesce(vd.valor,0),
      'vendas_por_produto', coalesce(vd_prod.obj,'{}'::jsonb),
      'vendas_por_origem', coalesce(vd_orig.obj,'{}'::jsonb),
      'vendas_por_closer', coalesce(vd_closer.obj,'{}'::jsonb),
      'vendas_por_sdr', coalesce(vd_sdr.obj,'{}'::jsonb)
    ) ORDER BY dias.dia), '[]'::jsonb))
  INTO v_result
  FROM dias
  LEFT JOIN lc ON lc.dia = dias.dia
  LEFT JOIN ct ON ct.dia = dias.dia
  LEFT JOIN ag ON ag.dia = dias.dia
  LEFT JOIN r1_marc ON r1_marc.dia = dias.dia
  LEFT JOIN r1_ok ON r1_ok.dia = dias.dia
  LEFT JOIN r1_ns ON r1_ns.dia = dias.dia
  LEFT JOIN r1_ns_sdr ON r1_ns_sdr.dia = dias.dia
  LEFT JOIN cauc ON cauc.dia = dias.dia
  LEFT JOIN r2 ON r2.dia = dias.dia
  LEFT JOIN r2_closer ON r2_closer.dia = dias.dia
  LEFT JOIN vd ON vd.dia = dias.dia
  LEFT JOIN vd_prod ON vd_prod.dia = dias.dia
  LEFT JOIN vd_orig ON vd_orig.dia = dias.dia
  LEFT JOIN vd_closer ON vd_closer.dia = dias.dia
  LEFT JOIN vd_sdr ON vd_sdr.dia = dias.dia;

  RETURN v_result;
END;
$function$;