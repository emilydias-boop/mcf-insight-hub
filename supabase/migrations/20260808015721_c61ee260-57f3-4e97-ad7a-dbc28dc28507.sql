CREATE OR REPLACE FUNCTION public.operacional_incorporador(p_days integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_origins uuid[] := ARRAY['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid,'7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid];
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_week_start date := date_trunc('week', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_days integer := greatest(1, least(coalesce(p_days,60), 365));
  v_from timestamptz := ((v_today - (v_days || ' days')::interval)::date)::timestamptz;
  v_leads jsonb;
  v_resumo jsonb;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _oi_d ON COMMIT DROP AS SELECT 1 WHERE false;

  WITH d AS (
    SELECT dl.id, dl.created_at, dl.tags, dl.value, dl.stage_id, dl.call_attempts,
           dl.last_contact_at, dl.owner_id, dl.original_sdr_email, dl.icp_segment,
           dl.stage_moved_at, dl.product_name
    FROM crm_deals dl
    WHERE dl.origin_id = ANY(v_origins)
      AND dl.created_at >= v_from
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
  ),
  att AS (
    SELECT a.deal_id, s.meeting_type, s.scheduled_at, a.status, a.contract_paid_at,
           a.booked_at, a.booked_by, c.name AS closer_name,
           row_number() OVER (
             PARTITION BY a.deal_id, s.meeting_type
             ORDER BY (a.status IN ('completed','contract_paid')) DESC, s.scheduled_at DESC
           ) AS rn
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id
    LEFT JOIN closers c ON c.id = s.closer_id
    WHERE a.deal_id IN (SELECT id FROM d)
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
      AND coalesce(s.status,'') NOT IN ('cancelled','canceled')
  ),
  r1 AS (SELECT * FROM att WHERE meeting_type='r1' AND rn=1),
  r2 AS (SELECT * FROM att WHERE meeting_type='r2' AND rn=1),
  cauc AS (
    SELECT deal_id, min(contract_paid_at) AS paid_at
    FROM att WHERE contract_paid_at IS NOT NULL GROUP BY deal_id
  ),
  fc AS (
    SELECT cl.deal_id, min(cl.started_at) AS first_at, count(*) AS total_calls
    FROM calls cl WHERE cl.deal_id IN (SELECT id FROM d) GROUP BY cl.deal_id
  ),
  qual AS (SELECT DISTINCT deal_id FROM lead_profiles WHERE deal_id IN (SELECT id FROM d)),
  sale AS (
    SELECT h.linked_deal_id AS deal_id,
           sum(coalesce(h.net_value, h.product_price, 0)) AS valor,
           min(h.sale_date) AS venda_em
    FROM hubla_transactions h
    WHERE h.linked_deal_id IN (SELECT id FROM d)
      AND h.sale_status = 'completed'
      AND coalesce(h.product_name,'') NOT ILIKE 'A000%'
      AND coalesce(h.product_name,'') <> 'Contrato'
    GROUP BY h.linked_deal_id
  ),
  st AS (SELECT id, stage_name, stage_order FROM crm_stages WHERE origin_id = ANY(v_origins))
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'lead_id', d.id,
      'criado_em', d.created_at,
      'origem_tag', (SELECT t FROM unnest(coalesce(d.tags,'{}'::text[])) t WHERE upper(t) NOT IN ('HUBLA','CSV','REPLICATION','BACKFILL') LIMIT 1),
      'origem_tags', coalesce(d.tags,'{}'::text[]),
      'veio_do_a010', (EXISTS (SELECT 1 FROM unnest(coalesce(d.tags,'{}'::text[])) t WHERE upper(t) LIKE 'A010%')
                       OR coalesce(d.product_name,'') ILIKE 'A010%'),
      'segmento_icp', d.icp_segment,
      'stage_atual', st.stage_name,
      'sdr_id', p.id,
      'sdr_nome_interno', coalesce(p.full_name, d.original_sdr_email, d.owner_id),
      'tentativas_contato', coalesce(d.call_attempts, fc.total_calls),
      'primeiro_contato_em', coalesce(fc.first_at, d.last_contact_at),
      'qualificado', (qual.deal_id IS NOT NULL),
      'r1_agendada_em', r1.scheduled_at,
      'r1_realizada', coalesce(r1.status IN ('completed','contract_paid'), false),
      'noshow', coalesce(r1.status = 'no_show', false),
      'closer_nome', coalesce(r1.closer_name, r2.closer_name),
      'caucao_paga', (cauc.paid_at IS NOT NULL OR coalesce(r1.status,'') = 'contract_paid'),
      'caucao_paga_em', cauc.paid_at,
      'r2_agendada_em', r2.scheduled_at,
      'r2_realizada', coalesce(r2.status IN ('completed','contract_paid'), false),
      'r3_semana', NULL,
      'venda', (sale.deal_id IS NOT NULL OR coalesce(st.stage_name,'') ILIKE 'Venda%realizada'),
      'venda_valor', coalesce(sale.valor, CASE WHEN coalesce(st.stage_name,'') ILIKE 'Venda%realizada' THEN d.value END),
      'venda_em', coalesce(sale.venda_em::timestamptz, CASE WHEN coalesce(st.stage_name,'') ILIKE 'Venda%realizada' THEN d.stage_moved_at END)
    ) ORDER BY d.created_at DESC), '[]'::jsonb)
  INTO v_leads
  FROM d
  LEFT JOIN st ON st.id = d.stage_id
  LEFT JOIN r1 ON r1.deal_id = d.id
  LEFT JOIN r2 ON r2.deal_id = d.id
  LEFT JOIN cauc ON cauc.deal_id = d.id
  LEFT JOIN fc ON fc.deal_id = d.id
  LEFT JOIN qual ON qual.deal_id = d.id
  LEFT JOIN sale ON sale.deal_id = d.id
  LEFT JOIN profiles p ON lower(p.email) = lower(coalesce(d.original_sdr_email, d.owner_id));

  WITH dd AS (
    SELECT dl.id, dl.created_at, dl.tags, dl.product_name
    FROM crm_deals dl
    WHERE dl.origin_id = ANY(v_origins)
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
      AND (dl.created_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
  ),
  leads_por_tag AS (
    SELECT jsonb_object_agg(tag, c) AS obj FROM (
      SELECT coalesce((SELECT t FROM unnest(coalesce(dd.tags,'{}'::text[])) t WHERE upper(t) NOT IN ('HUBLA','CSV','REPLICATION','BACKFILL') LIMIT 1), 'SEM TAG') AS tag,
             count(*) AS c
      FROM dd GROUP BY 1
    ) x
  ),
  contactados AS (
    SELECT count(*) AS n FROM (
      SELECT cl.deal_id, min(cl.started_at) AS f
      FROM calls cl
      JOIN crm_deals dl ON dl.id = cl.deal_id AND dl.origin_id = ANY(v_origins)
      GROUP BY cl.deal_id
    ) y WHERE (y.f AT TIME ZONE 'America/Sao_Paulo')::date = v_today
  ),
  ag_hoje AS (
    SELECT jsonb_object_agg(nome, c) AS obj, coalesce(sum(c),0) AS total FROM (
      SELECT coalesce(p.full_name, 'Não identificado') AS nome, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type = 'r1'
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      LEFT JOIN profiles p ON p.id = a.booked_by
      WHERE (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date = v_today
        AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
      GROUP BY 1
    ) z
  ),
  r1_hoje AS (
    SELECT a.status, coalesce(c.name,'Não identificado') AS closer
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r1'
    LEFT JOIN closers c ON c.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
  ),
  cap AS (
    SELECT count(*) AS slots, coalesce(sum(coalesce(s.max_attendees,1)),0) AS capacidade
    FROM meeting_slots s
    WHERE s.meeting_type='r1'
      AND (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
      AND coalesce(s.status,'') NOT IN ('cancelled','canceled')
  ),
  cauc_hoje AS (
    SELECT jsonb_object_agg(closer, c) AS obj, coalesce(sum(c),0) AS total FROM (
      SELECT coalesce(cl.name,'Não identificado') AS closer, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id
      LEFT JOIN closers cl ON cl.id = s.closer_id
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE a.contract_paid_at IS NOT NULL
        AND (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today
      GROUP BY 1
    ) w
  ),
  r2_hoje AS (
    SELECT
      count(*) FILTER (WHERE (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date = v_today) AS agendadas,
      count(*) FILTER (WHERE (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today AND a.status IN ('completed','contract_paid')) AS realizadas
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
  ),
  vendas AS (
    SELECT
      count(*) FILTER (WHERE h.sale_date = v_today) AS qtd_dia,
      coalesce(sum(coalesce(h.net_value,h.product_price,0)) FILTER (WHERE h.sale_date = v_today),0) AS valor_dia,
      count(*) FILTER (WHERE h.sale_date >= v_week_start) AS qtd_semana,
      coalesce(sum(coalesce(h.net_value,h.product_price,0)) FILTER (WHERE h.sale_date >= v_week_start),0) AS valor_semana
    FROM hubla_transactions h
    JOIN crm_deals dl ON dl.id = h.linked_deal_id AND dl.origin_id = ANY(v_origins)
    WHERE h.sale_status='completed'
      AND coalesce(h.product_name,'') NOT ILIKE 'A000%'
      AND coalesce(h.product_name,'') <> 'Contrato'
      AND h.sale_date >= v_week_start - interval '1 day'
  )
  SELECT jsonb_build_object(
    'data_referencia', v_today,
    'timezone', 'America/Sao_Paulo',
    'semana_iso', to_char((v_today)::date, 'IYYY-"W"IW'),
    'leads_captados', jsonb_build_object(
      'total', (SELECT count(*) FROM dd),
      'a010', (SELECT count(*) FROM dd WHERE EXISTS (SELECT 1 FROM unnest(coalesce(dd.tags,'{}'::text[])) t WHERE upper(t) LIKE 'A010%') OR coalesce(dd.product_name,'') ILIKE 'A010%'),
      'por_tag', coalesce((SELECT obj FROM leads_por_tag), '{}'::jsonb)
    ),
    'leads_contactados_pelos_sdrs', (SELECT n FROM contactados),
    'agendamentos_feitos_hoje', jsonb_build_object(
      'total', (SELECT total FROM ag_hoje),
      'por_sdr', coalesce((SELECT obj FROM ag_hoje), '{}'::jsonb)
    ),
    'agenda_r1_do_dia', jsonb_build_object(
      'reunioes_marcadas', (SELECT count(*) FROM r1_hoje),
      'slots_closers', (SELECT slots FROM cap),
      'capacidade', (SELECT capacidade FROM cap)
    ),
    'r1_realizadas', jsonb_build_object(
      'total', (SELECT count(*) FROM r1_hoje WHERE status IN ('completed','contract_paid')),
      'por_closer', coalesce((SELECT jsonb_object_agg(closer, c) FROM (SELECT closer, count(*) c FROM r1_hoje WHERE status IN ('completed','contract_paid') GROUP BY 1) q), '{}'::jsonb)
    ),
    'noshow_r1', jsonb_build_object(
      'total', (SELECT count(*) FROM r1_hoje WHERE status = 'no_show'),
      'por_closer', coalesce((SELECT jsonb_object_agg(closer, c) FROM (SELECT closer, count(*) c FROM r1_hoje WHERE status='no_show' GROUP BY 1) q2), '{}'::jsonb)
    ),
    'caucoes_vendidas', jsonb_build_object(
      'total', (SELECT total FROM cauc_hoje),
      'valor_unitario', 497,
      'valor_total', (SELECT total FROM cauc_hoje) * 497,
      'por_closer', coalesce((SELECT obj FROM cauc_hoje), '{}'::jsonb)
    ),
    'r2_agendadas', (SELECT agendadas FROM r2_hoje),
    'r2_realizadas', (SELECT realizadas FROM r2_hoje),
    'r3_realizadas_semana', NULL,
    'vendas_realizadas', jsonb_build_object(
      'dia_qtd', (SELECT qtd_dia FROM vendas),
      'dia_valor', (SELECT valor_dia FROM vendas),
      'semana_qtd', (SELECT qtd_semana FROM vendas),
      'semana_valor', (SELECT valor_semana FROM vendas)
    )
  ) INTO v_resumo;

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'bu', 'incorporador',
    'janela_dias', v_days,
    'resumo_do_dia', v_resumo,
    'total_leads', jsonb_array_length(v_leads),
    'leads', v_leads,
    'campos_indisponiveis', jsonb_build_array('r3_semana', 'r3_realizadas_semana')
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.operacional_incorporador(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operacional_incorporador(integer) TO service_role;