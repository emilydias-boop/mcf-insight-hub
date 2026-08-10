-- =====================================================================
-- 1) Fonte única da régua nova de caução
-- =====================================================================
CREATE OR REPLACE FUNCTION public.caucoes_efetivas(
  p_from date,
  p_to date,
  p_bu text DEFAULT 'incorporador'
)
RETURNS TABLE (
  attendee_id uuid,
  deal_id uuid,
  lead_name text,
  eff_date date,
  fonte text,
  contract_paid_at timestamptz,
  closer_id uuid,
  closer_name text,
  closer_bu text,
  sdr_id uuid,
  sdr_email text,
  sdr_name text,
  segment text,
  valor numeric,
  origin_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH paid AS (
  SELECT DISTINCT ON (COALESCE(msa.deal_id::text, msa.id::text))
    msa.id            AS attendee_id,
    msa.deal_id       AS deal_id,
    msa.attendee_name AS lead_name,
    msa.booked_by     AS slot_booked_by,
    msa.contract_paid_at,
    ms.closer_id      AS slot_closer_id,
    cl.bu             AS slot_bu
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN closers cl ON cl.id = ms.closer_id
  WHERE msa.contract_paid_at IS NOT NULL
    AND msa.is_partner = false
    AND msa.status <> 'cancelled'
    AND msa.contract_paid_at >= (p_from - INTERVAL '400 days')
    AND msa.contract_paid_at <= (p_to + INTERVAL '400 days')
  ORDER BY COALESCE(msa.deal_id::text, msa.id::text), msa.contract_paid_at
),
enriched AS (
  SELECT
    p.*,
    cd.icp_segment,
    cd.value    AS deal_value,
    cd.origin_id,
    lower(NULLIF(TRIM(COALESCE(cc.email, cd.custom_fields->>'email')), '')) AS email,
    NULLIF(right(regexp_replace(COALESCE(cc.phone, cd.custom_fields->>'telefone', ''), '\D', '', 'g'), 9), '') AS phone9,
    r1.closer_id AS r1_closer_id,
    r1c.name     AS r1_closer_name,
    r1c.bu       AS r1_bu,
    r1.booked_by AS r1_booked_by
  FROM paid p
  LEFT JOIN crm_deals cd ON cd.id = p.deal_id
  LEFT JOIN crm_contacts cc ON cc.id = cd.contact_id
  LEFT JOIN LATERAL (
    SELECT ms2.closer_id, m2.booked_by
    FROM meeting_slot_attendees m2
    JOIN meeting_slots ms2 ON ms2.id = m2.meeting_slot_id
    WHERE m2.deal_id = p.deal_id
      AND ms2.meeting_type = 'r1'
      AND m2.status <> 'cancelled'
    ORDER BY ms2.scheduled_at DESC
    LIMIT 1
  ) r1 ON true
  LEFT JOIN closers r1c ON r1c.id = r1.closer_id
),
tx AS (
  SELECT e.attendee_id,
         min((ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date) AS tx_date
  FROM enriched e
  JOIN hubla_transactions ht ON (
        (e.deal_id IS NOT NULL AND ht.linked_deal_id = e.deal_id)
     OR (e.email IS NOT NULL AND lower(ht.customer_email) = e.email)
     OR (e.phone9 IS NOT NULL AND right(regexp_replace(COALESCE(ht.customer_phone, ''), '\D', '', 'g'), 9) = e.phone9)
  )
  WHERE (
        upper(COALESCE(ht.product_code, '')) LIKE 'A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%A000%'
     OR upper(COALESCE(ht.product_name, '')) LIKE '%CONTRATO%'
  )
    AND lower(COALESCE(ht.sale_status, '')) IN ('pago', 'paid', 'approved', 'completed')
    AND COALESCE(ht.event_type, '') NOT ILIKE '%refund%'
    AND COALESCE(ht.net_value, 0) > 0
    AND ht.sale_date IS NOT NULL
  GROUP BY e.attendee_id
)
SELECT
  e.attendee_id,
  e.deal_id,
  e.lead_name,
  COALESCE(t.tx_date, (e.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date) AS eff_date,
  CASE WHEN t.tx_date IS NOT NULL THEN 'transacao' ELSE 'manual' END AS fonte,
  e.contract_paid_at,
  COALESCE(e.r1_closer_id, e.slot_closer_id) AS closer_id,
  COALESCE(e.r1_closer_name, sc.name)        AS closer_name,
  COALESCE(e.r1_bu, e.slot_bu)               AS closer_bu,
  COALESCE(e.r1_booked_by, e.slot_booked_by) AS sdr_id,
  pr.email                                   AS sdr_email,
  COALESCE(pr.full_name, pr.email)           AS sdr_name,
  NULLIF(UPPER(TRIM(COALESCE(e.icp_segment, ''))), '') AS segment,
  e.deal_value                               AS valor,
  e.origin_id
FROM enriched e
LEFT JOIN tx t ON t.attendee_id = e.attendee_id
LEFT JOIN closers sc ON sc.id = e.slot_closer_id
LEFT JOIN profiles pr ON pr.id = COALESCE(e.r1_booked_by, e.slot_booked_by)
WHERE COALESCE(t.tx_date, (e.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date) BETWEEN p_from AND p_to
  AND (
    p_bu IS NULL
    OR COALESCE(e.r1_bu, e.slot_bu) IS NULL
    OR COALESCE(e.r1_bu, e.slot_bu) = p_bu
  );
$fn$;

GRANT EXECUTE ON FUNCTION public.caucoes_efetivas(date, date, text) TO authenticated, service_role;

-- =====================================================================
-- 2) SDRs (Painel Comercial)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL,
  bu_filter text DEFAULT NULL,
  segment_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  result JSON;
  today_sp DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  start_d DATE := start_date::date;
  end_d DATE := end_date::date;
  effective_end DATE := LEAST(end_d, today_sp);
  is_future_window BOOLEAN := end_d >= today_sp;
  seg TEXT := NULLIF(UPPER(TRIM(COALESCE(segment_filter, ''))), '');
BEGIN
  WITH raw_attendees AS (
    SELECT
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      msa.deal_id,
      ms.scheduled_at,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
      msa.contract_paid_at,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at,
      sdr_at_time.id as sdr_id_at_booking,
      sdr_at_time.squad as sdr_squad_at_booking
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN closers cl ON cl.id = ms.closer_id
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN LATERAL (
      SELECT s.id, h.squad
      FROM public.sdr s
      INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      WHERE LOWER(s.email) = LOWER(p_booker.email)
        AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
        AND COALESCE(h.valid_to, 'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
      ORDER BY h.valid_from DESC
      LIMIT 1
    ) sdr_at_time ON true
    LEFT JOIN crm_deals cd ON cd.id = msa.deal_id
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
      AND p_booker.email IS NOT NULL
      AND (
        seg IS NULL
        OR UPPER(TRIM(COALESCE(cd.icp_segment, ''))) = seg
      )
  ),
  filtered_attendees AS (
    SELECT * FROM raw_attendees
    WHERE sdr_email_filter IS NULL OR lower(sdr_email) = lower(sdr_email_filter)
  ),
  dedup_agendada AS (
    SELECT sdr_email, sdr_name, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as agendada_count
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
    GROUP BY sdr_email, sdr_name, deal_id
  ),
  agendada_agg AS (
    SELECT sdr_email, SUM(agendada_count) as r1_agendada
    FROM dedup_agendada GROUP BY sdr_email
  ),
  dedup_realizada AS (
    SELECT sdr_email, deal_id,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_d AND effective_end
    GROUP BY sdr_email, deal_id
  ),
  realizada_agg AS (
    SELECT sdr_email, SUM(realized) as r1_realizada
    FROM dedup_realizada GROUP BY sdr_email
  ),
  noshow_per_lead AS (
    SELECT sdr_email, deal_id,
      LEAST(
        COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day >= DATE '2026-05-01'),
        2
      )
      +
      LEAST(
        COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day < DATE '2026-05-01'),
        1
      ) as noshow_count
    FROM filtered_attendees
    WHERE status = 'no_show'
      AND meeting_day BETWEEN start_d AND effective_end
    GROUP BY sdr_email, deal_id
  ),
  noshow_agg AS (
    SELECT sdr_email, SUM(noshow_count) as no_shows
    FROM noshow_per_lead GROUP BY sdr_email
  ),
  sem_status_per_lead AS (
    SELECT sdr_email, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as sem_status_count
    FROM filtered_attendees
    WHERE status IN ('invited','rescheduled','sem_sucesso','recurrence_recognized','scheduled')
      AND meeting_day BETWEEN start_d AND end_d
      AND (
        NOT is_future_window
        OR scheduled_at <= NOW()
      )
    GROUP BY sdr_email, deal_id
  ),
  sem_status_agg AS (
    SELECT sdr_email, SUM(sem_status_count) as sem_status
    FROM sem_status_per_lead GROUP BY sdr_email
  ),
  agendamentos_dedup AS (
    SELECT sdr_email, deal_id, meeting_day,
      MIN(effective_booked_at) as first_booked_at
    FROM filtered_attendees
    WHERE deal_id IS NOT NULL
    GROUP BY sdr_email, deal_id, meeting_day
  ),
  agendamentos_ranked AS (
    SELECT sdr_email, deal_id, meeting_day, first_booked_at,
      ROW_NUMBER() OVER (PARTITION BY sdr_email, deal_id ORDER BY first_booked_at, meeting_day) as ordem
    FROM agendamentos_dedup
  ),
  agendamentos_cte AS (
    SELECT sdr_email, COUNT(*) as agendamentos
    FROM agendamentos_ranked
    WHERE ordem <= 2
      AND (first_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
    GROUP BY sdr_email
  ),
  -- ===== RÉGUA NOVA DE CAUÇÃO (data da transação + closer/SDR da última R1) =====
  caucoes AS (
    SELECT lower(ce.sdr_email) AS sdr_email, ce.deal_id, ce.attendee_id
    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR lower(ce.sdr_email) = lower(sdr_email_filter))
      AND (seg IS NULL OR UPPER(TRIM(COALESCE(ce.segment, ''))) = seg)
  ),
  contratos_cte AS (
    SELECT sdr_email, COUNT(DISTINCT COALESCE(deal_id::text, attendee_id::text)) as contratos
    FROM caucoes GROUP BY sdr_email
  ),
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND end_d
      OR lower(sdr_email) IN (SELECT sdr_email FROM caucoes)
  )
  SELECT json_build_object(
    'is_future_window', is_future_window,
    'effective_end_date', effective_end::text,
    'today_sp', today_sp::text,
    'metrics',
    COALESCE(json_agg(json_build_object(
      'sdr_email', u.sdr_email,
      'sdr_name', u.sdr_name,
      'agendamentos', COALESCE(a.agendamentos, 0),
      'r1_agendada', COALESCE(ag.r1_agendada, 0),
      'r1_realizada', COALESCE(rz.r1_realizada, 0),
      'no_shows', COALESCE(ns.no_shows, 0),
      'sem_status', COALESCE(ss.sem_status, 0),
      'pendentes', GREATEST(
        COALESCE(ag.r1_agendada, 0)
          - COALESCE(rz.r1_realizada, 0)
          - COALESCE(ns.no_shows, 0),
        0
      ),
      'contratos', COALESCE(c.contratos, 0)
    )), '[]'::json)
  ) INTO result
  FROM sdr_universe u
  LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
  LEFT JOIN agendada_agg ag ON ag.sdr_email = u.sdr_email
  LEFT JOIN realizada_agg rz ON rz.sdr_email = u.sdr_email
  LEFT JOIN noshow_agg ns ON ns.sdr_email = u.sdr_email
  LEFT JOIN sem_status_agg ss ON ss.sdr_email = u.sdr_email
  LEFT JOIN contratos_cte c ON c.sdr_email = lower(u.sdr_email);

  RETURN COALESCE(result, json_build_object(
    'is_future_window', is_future_window,
    'effective_end_date', effective_end::text,
    'today_sp', today_sp::text,
    'metrics', '[]'::json
  ));
END;
$fn$;

-- =====================================================================
-- 3) Closers (breakdown do Painel Comercial)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_closer_breakdown_metrics(
  start_date text,
  end_date text,
  bu_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  -- ===== RÉGUA NOVA DE CAUÇÃO =====
  caucoes AS (
    SELECT ce.closer_id, ce.closer_name, ce.closer_bu, ce.deal_id, ce.attendee_id
    FROM public.caucoes_efetivas(start_d, effective_end, bu_filter) ce
    WHERE ce.closer_id IS NOT NULL
  ),
  contratos_agg AS (
    SELECT closer_id, COUNT(DISTINCT COALESCE(deal_id::text, attendee_id::text)) as contratos
    FROM caucoes GROUP BY closer_id
  ),
  closer_universe AS (
    SELECT DISTINCT closer_id, closer_name, closer_bu
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
    UNION
    SELECT DISTINCT closer_id, closer_name, closer_bu FROM caucoes
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
      'contratos', COALESCE(c.contratos, 0)
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
$fn$;

-- =====================================================================
-- 4) Relatórios operacionais: mesma régua de caução
-- =====================================================================
DO $do$
DECLARE
  d text;
  old_t text;
  new_t text;
BEGIN
  -- ---- daily ----
  d := pg_get_functiondef('public.operacional_incorporador_daily(date,date)'::regprocedure);
  old_t := $q$      SELECT (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
             coalesce(cl.name,'Não identificado') AS closer, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id
      LEFT JOIN closers cl ON cl.id = s.closer_id
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE a.contract_paid_at IS NOT NULL
        AND (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      GROUP BY 1,2$q$;
  new_t := $q$      SELECT ce.eff_date AS dia,
             coalesce(ce.closer_name,'Não identificado') AS closer, count(*) AS c
      FROM public.caucoes_efetivas(p_from, p_to, NULL) ce
      JOIN crm_deals dl ON dl.id = ce.deal_id AND dl.origin_id = ANY(v_origins)
      GROUP BY 1,2$q$;
  IF position(old_t in d) = 0 THEN
    RAISE EXCEPTION 'CTE de caução não encontrada em operacional_incorporador_daily';
  END IF;
  EXECUTE replace(d, old_t, new_t);

  -- ---- semana_resultado ----
  d := pg_get_functiondef('public.operacional_incorporador_semana_resultado(date)'::regprocedure);
  old_t := $q$      SELECT coalesce(cl.name,'Não identificado') AS closer, count(*) AS c
      FROM meeting_slot_attendees a
      JOIN meeting_slots s ON s.id = a.meeting_slot_id
      LEFT JOIN closers cl ON cl.id = s.closer_id
      JOIN crm_deals dl ON dl.id = a.deal_id AND dl.origin_id = ANY(v_origins)
      WHERE a.contract_paid_at IS NOT NULL
        AND (a.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN v_r1_de AND v_r1_ate
      GROUP BY 1$q$;
  new_t := $q$      SELECT coalesce(ce.closer_name,'Não identificado') AS closer, count(*) AS c
      FROM public.caucoes_efetivas(v_r1_de, v_r1_ate, NULL) ce
      JOIN crm_deals dl ON dl.id = ce.deal_id AND dl.origin_id = ANY(v_origins)
      GROUP BY 1$q$;
  IF position(old_t in d) = 0 THEN
    RAISE EXCEPTION 'CTE de caução não encontrada em operacional_incorporador_semana_resultado';
  END IF;
  EXECUTE replace(d, old_t, new_t);
END $do$;