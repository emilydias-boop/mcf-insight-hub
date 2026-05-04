CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text, bu_filter text DEFAULT NULL::text)
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
  is_future_window BOOLEAN := end_d >= today_sp;
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
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
      AND p_booker.email IS NOT NULL
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
        COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day >= DATE '2026-04-28'),
        2
      )
      +
      LEAST(
        COUNT(DISTINCT meeting_day) FILTER (WHERE meeting_day < DATE '2026-04-28'),
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
    FROM raw_attendees
    WHERE deal_id IS NOT NULL
    GROUP BY sdr_email, deal_id, meeting_day
  ),
  agendamentos_ranked AS (
    SELECT sdr_email, deal_id, meeting_day, first_booked_at,
      ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY first_booked_at, meeting_day) as ordem
    FROM agendamentos_dedup
  ),
  agendamentos_cte AS (
    SELECT sdr_email, COUNT(*) as agendamentos
    FROM agendamentos_ranked
    WHERE ordem <= 2
      AND (first_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
      AND (sdr_email_filter IS NULL OR lower(sdr_email) = lower(sdr_email_filter))
    GROUP BY sdr_email
  ),
  contratos_cte AS (
    SELECT sdr_email, COUNT(DISTINCT deal_id) as contratos
    FROM filtered_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
      AND deal_id IS NOT NULL
    GROUP BY sdr_email
  ),
  contratos_no_deal_cte AS (
    SELECT sdr_email, COUNT(*) as contratos_extra
    FROM filtered_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
      AND deal_id IS NULL
    GROUP BY sdr_email
  ),
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM filtered_attendees
    WHERE meeting_day BETWEEN start_d AND end_d
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND end_d
      OR (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND end_d
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
      'contratos', COALESCE(c.contratos, 0) + COALESCE(cnd.contratos_extra, 0)
    )), '[]'::json)
  ) INTO result
  FROM sdr_universe u
  LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
  LEFT JOIN agendada_agg ag ON ag.sdr_email = u.sdr_email
  LEFT JOIN realizada_agg rz ON rz.sdr_email = u.sdr_email
  LEFT JOIN noshow_agg ns ON ns.sdr_email = u.sdr_email
  LEFT JOIN sem_status_agg ss ON ss.sdr_email = u.sdr_email
  LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
  LEFT JOIN contratos_no_deal_cte cnd ON cnd.sdr_email = u.sdr_email;

  RETURN COALESCE(result, json_build_object(
    'is_future_window', is_future_window,
    'effective_end_date', effective_end::text,
    'today_sp', today_sp::text,
    'metrics', '[]'::json
  ));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda_aligned(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text, bu_filter text DEFAULT NULL::text, include_cancelled boolean DEFAULT false)
RETURNS TABLE(deal_id text, deal_name text, contact_name text, contact_email text, contact_phone text, tipo text, data_agendamento text, scheduled_at text, status_atual text, intermediador text, closer text, origin_name text, probability integer, attendee_id text, meeting_slot_id text, attendee_status text, sdr_email text, booked_at text, ordem_no_show integer, total_no_shows_deal integer, conta_no_show boolean, conta_kpi boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  start_d DATE := start_date::date;
  end_d   DATE := end_date::date;
  today_sp DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  effective_end DATE := LEAST(end_d, today_sp);
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      msa.id as b_msa_id,
      msa.deal_id as b_deal_id,
      msa.status as b_status,
      ms.id as b_ms_id,
      ms.scheduled_at as b_scheduled_at,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as b_meeting_day,
      cl.name as b_closer_name,
      cl.bu as b_closer_bu,
      d.id as b_d_id,
      d.name as b_d_name,
      d.probability as b_probability,
      c.name as b_c_name,
      c.email as b_c_email,
      c.phone as b_c_phone,
      o.name as b_o_name,
      p_booked.email as b_booker_email,
      p_booked.full_name as b_booker_full_name,
      COALESCE(msa.booked_at, msa.created_at) as b_effective_booked_at,
      sdr_at_time.squad as b_sdr_squad_at_booking
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms      ON ms.id = msa.meeting_slot_id
    JOIN crm_deals d           ON d.id = msa.deal_id
    LEFT JOIN crm_contacts c   ON c.id = d.contact_id
    LEFT JOIN closers cl       ON cl.id = ms.closer_id
    LEFT JOIN crm_origins o    ON o.id = d.origin_id
    LEFT JOIN profiles p_booked ON p_booked.id = COALESCE(msa.booked_by, ms.booked_by)
    LEFT JOIN LATERAL (
      SELECT h.squad
      FROM public.sdr s
      INNER JOIN public.sdr_squad_history h ON h.sdr_id = s.id
      WHERE LOWER(s.email) = LOWER(p_booked.email)
        AND h.valid_from <= COALESCE(msa.booked_at, msa.created_at)
        AND COALESCE(h.valid_to, 'infinity'::timestamptz) > COALESCE(msa.booked_at, msa.created_at)
      ORDER BY h.valid_from DESC
      LIMIT 1
    ) sdr_at_time ON true
    WHERE ms.meeting_type = 'r1'
      AND (include_cancelled OR COALESCE(msa.status, 'scheduled') != 'cancelled')
      AND COALESCE(msa.is_partner, false) = false
      AND p_booked.email IS NOT NULL
      AND msa.deal_id IS NOT NULL
      AND (
        bu_filter IS NULL
        OR sdr_at_time.squad = bu_filter
        OR (sdr_at_time.squad IS NULL AND cl.bu = bu_filter)
      )
  ),
  per_day AS (
    SELECT DISTINCT ON (b.b_deal_id, b.b_meeting_day)
      b.*,
      MIN(b.b_effective_booked_at) OVER (PARTITION BY b.b_deal_id, b.b_meeting_day) as b_first_booked_at_day
    FROM base b
    ORDER BY b.b_deal_id, b.b_meeting_day, b.b_effective_booked_at, b.b_scheduled_at
  ),
  ranked AS (
    SELECT pd.*,
      ROW_NUMBER() OVER (
        PARTITION BY pd.b_deal_id
        ORDER BY pd.b_first_booked_at_day, pd.b_meeting_day
      ) as b_ordem
    FROM per_day pd
  )
  SELECT
    r.b_d_id::text,
    r.b_d_name::text,
    r.b_c_name::text,
    r.b_c_email::text,
    r.b_c_phone::text,
    (CASE WHEN r.b_ordem = 1 THEN '1º Agendamento' ELSE 'Reagendamento Válido' END)::text,
    r.b_meeting_day::text,
    r.b_scheduled_at::text,
    COALESCE(r.b_status, 'scheduled')::text,
    COALESCE(r.b_booker_full_name, r.b_booker_email, '')::text,
    COALESCE(r.b_closer_name, '')::text,
    COALESCE(r.b_o_name, '')::text,
    r.b_probability,
    r.b_msa_id::text,
    r.b_ms_id::text,
    COALESCE(r.b_status, 'scheduled')::text,
    COALESCE(r.b_booker_email, '')::text,
    r.b_effective_booked_at::text,
    NULL::integer,
    NULL::integer,
    NULL::boolean,
    true
  FROM ranked r
  WHERE r.b_ordem <= 2
    AND (r.b_first_booked_at_day AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_d AND effective_end
    AND (sdr_email_filter IS NULL OR LOWER(r.b_booker_email) = LOWER(sdr_email_filter))
  ORDER BY r.b_first_booked_at_day DESC, r.b_scheduled_at DESC;
END;
$function$;