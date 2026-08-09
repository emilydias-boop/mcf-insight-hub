CREATE OR REPLACE FUNCTION public.operacional_incorporador_semana_resultado(p_inicio date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_origins uuid[] := ARRAY['e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid,'7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid];
  v_corte_r2 time := '12:00'::time;  -- divisor manhã/tarde da janela R2 (fácil de mudar)
  v_r1_de date;
  v_r1_ate date;
  v_r2_de timestamptz;
  v_r2_ate timestamptz;
  v_vd_de date;
  v_vd_ate date;
  v_result jsonb;
BEGIN
  IF p_inicio IS NULL THEN
    RAISE EXCEPTION 'Informe a data de início (quarta-feira)';
  END IF;
  IF extract(dow from p_inicio) <> 3 THEN
    RAISE EXCEPTION 'A data de início deve ser uma quarta-feira';
  END IF;

  v_r1_de  := p_inicio;
  v_r1_ate := p_inicio + 6;
  v_r2_de  := ((p_inicio + 1)::timestamp + v_corte_r2) AT TIME ZONE 'America/Sao_Paulo';
  v_r2_ate := ((p_inicio + 8)::timestamp + v_corte_r2) AT TIME ZONE 'America/Sao_Paulo';
  v_vd_de  := p_inicio + 8;
  v_vd_ate := p_inicio + 14;

  WITH lc AS (
    SELECT count(*) AS total,
           count(*) FILTER (
             WHERE EXISTS (SELECT 1 FROM unnest(coalesce(dl.tags,'{}'::text[])) t WHERE upper(t) LIKE 'A010%')
                OR coalesce(dl.product_name,'') ILIKE 'A010%'
           ) AS a010
    FROM crm_deals dl
    WHERE dl.origin_id = ANY(v_origins)
      AND coalesce(dl.is_archived,false) = false
      AND dl.merged_into_deal_id IS NULL
      AND (dl.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
  ),
  a010_vd AS (
    SELECT count(*) AS qtd,
           coalesce(sum(coalesce(ht.gross_override, ht.product_price, ht.net_value, 0)),0) AS valor
    FROM hubla_transactions ht
    WHERE coalesce(ht.product_name,'') ILIKE 'A010%'
      AND coalesce(ht.sale_status,'') NOT IN ('refunded','refund','canceled','cancelled','cancelado','refused','expired','chargeback')
      AND coalesce(ht.event_type,'') NOT ILIKE '%refund%'
      AND coalesce(ht.gross_override, ht.product_price, ht.net_value, 0) >= 0
      AND ht.sale_date IS NOT NULL
      AND (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
  ),
  ct AS (
    SELECT count(*) AS n
    FROM (
      SELECT cl.deal_id, min(cl.started_at) AS f
      FROM calls cl
      JOIN crm_deals dl ON dl.id = cl.deal_id AND dl.origin_id = ANY(v_origins)
      GROUP BY cl.deal_id
    ) y
    WHERE (y.f AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
  ),
  ag_raw AS (
    SELECT coalesce(p.full_name,'Não identificado') AS nome, count(*) AS c
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type = 'r1'
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    LEFT JOIN profiles p ON p.id = a.booked_by
    WHERE (coalesce(a.booked_at, a.created_at) AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
    GROUP BY 1
  ),
  ag AS (SELECT jsonb_object_agg(nome, c) AS obj, coalesce(sum(c),0) AS total FROM ag_raw),
  r1_raw AS (
    SELECT a.status, coalesce(c.name,'Não identificado') AS closer,
           coalesce(p.full_name,'Não identificado') AS sdr
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r1'
    LEFT JOIN closers c ON c.id = s.closer_id
    LEFT JOIN profiles p ON p.id = a.booked_by
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE (s.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
      AND coalesce(a.status,'') NOT IN ('cancelled','canceled')
  ),
  r1_marc AS (SELECT count(*) AS n FROM r1_raw),
  r1_ok AS (
    SELECT jsonb_object_agg(closer, c) AS obj, coalesce(sum(c),0) AS total
    FROM (SELECT closer, count(*) AS c FROM r1_raw WHERE status IN ('completed','contract_paid') GROUP BY 1) q
  ),
  r1_ns AS (
    SELECT jsonb_object_agg(closer, c) AS obj, coalesce(sum(c),0) AS total
    FROM (SELECT closer, count(*) AS c FROM r1_raw WHERE status = 'no_show' GROUP BY 1) q
  ),
  r1_ns_sdr AS (
    SELECT jsonb_object_agg(sdr, c) AS obj
    FROM (SELECT sdr, count(*) AS c FROM r1_raw WHERE status = 'no_show' GROUP BY 1) q
  ),
  cauc AS (
    SELECT jsonb_object_agg(closer, c) AS obj, coalesce(sum(c),0) AS total
    FROM (
      SELECT coalesce(cl.name,'Não identificado') AS closer, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id
      LEFT JOIN closers cl ON cl.id = s.closer_id
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE a.contract_paid_at IS NOT NULL
        AND (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
      GROUP BY 1
    ) q
  ),
  r2_raw AS (
    SELECT coalesce(cl.name,'Não identificado') AS closer, 1 AS agendadas, 0 AS realizadas
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
    LEFT JOIN closers cl ON cl.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE coalesce(a.status,'') NOT IN ('cancelled','canceled')
      AND coalesce(a.booked_at, a.created_at) >= v_r2_de
      AND coalesce(a.booked_at, a.created_at) < v_r2_ate
    UNION ALL
    SELECT coalesce(cl.name,'Não identificado') AS closer, 0, 1
    FROM meeting_slot_attendees a
    JOIN meeting_slots s ON s.id = a.meeting_slot_id AND s.meeting_type='r2'
    LEFT JOIN closers cl ON cl.id = s.closer_id
    JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
    WHERE a.status IN ('completed','contract_paid')
      AND s.scheduled_at >= v_r2_de
      AND s.scheduled_at < v_r2_ate
  ),
  r2 AS (SELECT coalesce(sum(agendadas),0) AS agendadas, coalesce(sum(realizadas),0) AS realizadas FROM r2_raw),
  r2_closer AS (
    SELECT jsonb_object_agg(closer, jsonb_build_object('agendadas', ag2, 'realizadas', re2)) AS obj
    FROM (SELECT closer, sum(agendadas) AS ag2, sum(realizadas) AS re2 FROM r2_raw GROUP BY 1) x
  ),
  vd_base AS (
    SELECT dl.id AS deal_id,
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
             JOIN meeting_slots s2 ON s2.id = a2.meeting_slot_id AND s2.meeting_type = 'r1'
             JOIN closers cl2 ON cl2.id = s2.closer_id
             WHERE a2.deal_id = dl.id
               AND coalesce(a2.status,'') NOT IN ('cancelled','canceled')
             ORDER BY s2.scheduled_at DESC
             LIMIT 1
           ), 'Não identificado') AS closer_r1,
           coalesce((
             SELECT cl3.name
             FROM meeting_slot_attendees a4
             JOIN meeting_slots s4 ON s4.id = a4.meeting_slot_id AND s4.meeting_type = 'r2'
             JOIN closers cl3 ON cl3.id = s4.closer_id
             WHERE a4.deal_id = dl.id
               AND coalesce(a4.status,'') NOT IN ('cancelled','canceled')
               AND s4.scheduled_at <= dl.stage_moved_at + interval '1 day'
             ORDER BY s4.scheduled_at DESC
             LIMIT 1
           ), 'Sem R2') AS closer_r2,
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
      AND (dl.stage_moved_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_vd_de AND v_vd_ate
  ),
  vd AS (SELECT count(*) AS qtd, coalesce(sum(valor),0) AS valor FROM vd_base),
  vd_prod AS (
    SELECT jsonb_object_agg(produto, jsonb_build_object('qtd', q, 'valor', v)) AS obj
    FROM (SELECT produto, count(*) AS q, coalesce(sum(valor),0) AS v FROM vd_base GROUP BY 1) x
  ),
  vd_orig AS (
    SELECT jsonb_object_agg(origem, jsonb_build_object('qtd', q, 'valor', v)) AS obj
    FROM (SELECT origem, count(*) AS q, coalesce(sum(valor),0) AS v FROM vd_base GROUP BY 1) x
  ),
  vd_closer_r1 AS (
    SELECT jsonb_object_agg(closer_r1, q) AS obj
    FROM (SELECT closer_r1, count(*) AS q FROM vd_base GROUP BY 1) x
  ),
  vd_closer_r2 AS (
    SELECT jsonb_object_agg(closer_r2, q) AS obj
    FROM (SELECT closer_r2, count(*) AS q FROM vd_base GROUP BY 1) x
  ),
  vd_sdr AS (
    SELECT jsonb_object_agg(sdr_venda, q) AS obj
    FROM (SELECT sdr_venda, count(*) AS q FROM vd_base GROUP BY 1) x
  )
  SELECT jsonb_build_object(
    'janelas', jsonb_build_object(
      'r1', jsonb_build_object('de', to_char(v_r1_de,'YYYY-MM-DD'), 'ate', to_char(v_r1_ate,'YYYY-MM-DD')),
      'r2', jsonb_build_object(
        'de', to_char(v_r2_de AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI'),
        'ate', to_char(v_r2_ate AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')),
      'vendas', jsonb_build_object('de', to_char(v_vd_de,'YYYY-MM-DD'), 'ate', to_char(v_vd_ate,'YYYY-MM-DD'))
    ),
    'atividade', jsonb_build_object(
      'leads_captados', coalesce(lc.total,0),
      'leads_a010', coalesce(lc.a010,0),
      'a010_vendas_qtd', coalesce(a010_vd.qtd,0),
      'a010_vendas_valor', coalesce(a010_vd.valor,0),
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
      'caucoes_valor', coalesce(cauc.total,0) * 497
    ),
    'r2', jsonb_build_object(
      'r2_agendadas', coalesce(r2.agendadas,0),
      'r2_realizadas', coalesce(r2.realizadas,0),
      'r2_por_closer', coalesce(r2_closer.obj,'{}'::jsonb)
    ),
    'vendas', jsonb_build_object(
      'vendas_qtd', coalesce(vd.qtd,0),
      'vendas_valor', coalesce(vd.valor,0),
      'vendas_por_produto', coalesce(vd_prod.obj,'{}'::jsonb),
      'vendas_por_origem', coalesce(vd_orig.obj,'{}'::jsonb),
      'vendas_por_closer_r1', coalesce(vd_closer_r1.obj,'{}'::jsonb),
      'vendas_por_closer_r2', coalesce(vd_closer_r2.obj,'{}'::jsonb),
      'vendas_por_sdr', coalesce(vd_sdr.obj,'{}'::jsonb)
    )
  )
  INTO v_result
  FROM lc, a010_vd, ct, ag, r1_marc, r1_ok, r1_ns, r1_ns_sdr, cauc, r2, r2_closer,
       vd, vd_prod, vd_orig, vd_closer_r1, vd_closer_r2, vd_sdr;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.operacional_incorporador_semana_resultado(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.operacional_incorporador_semana_resultado(date) TO service_role;