CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text, bu_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result JSON;
BEGIN
  WITH raw_attendees AS (
    SELECT
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      msa.deal_id,
      (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date as meeting_day,
      msa.status,
      msa.contract_paid_at,
      msa.parent_attendee_id,
      msa.is_reschedule,
      COALESCE(msa.booked_at, msa.created_at) as effective_booked_at,
      parent_msa.parent_attendee_id as parent_parent_id
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN closers cl ON cl.id = ms.closer_id
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
      AND (bu_filter IS NULL OR cl.bu = bu_filter)
      AND p_booker.email IS NOT NULL
  ),
  dedup_agendada AS (
    SELECT sdr_email, sdr_name, deal_id,
      LEAST(COUNT(DISTINCT meeting_day), 2) as agendada_count,
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized,
      MAX(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as is_noshow
    FROM raw_attendees
    WHERE meeting_day BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email, sdr_name, deal_id
  ),
  agendamentos_cte AS (
    SELECT sdr_email,
      COUNT(*) as agendamentos
    FROM raw_attendees
    WHERE (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
      AND (
        (parent_attendee_id IS NULL AND COALESCE(is_reschedule, false) = false)
        OR (parent_attendee_id IS NOT NULL AND parent_parent_id IS NULL)
        OR (parent_attendee_id IS NULL AND is_reschedule = true)
      )
    GROUP BY sdr_email
  ),
  contratos_cte AS (
    SELECT sdr_email,
      COUNT(*) as contratos
    FROM raw_attendees
    WHERE (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
          BETWEEN start_date::DATE AND end_date::DATE
    GROUP BY sdr_email
  ),
  -- Universe of SDRs that had ANY activity in the period (meeting, booking, or contract)
  sdr_universe AS (
    SELECT DISTINCT sdr_email, sdr_name
    FROM raw_attendees
    WHERE
      meeting_day BETWEEN start_date::DATE AND end_date::DATE
      OR (effective_booked_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
      OR (contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date
         BETWEEN start_date::DATE AND end_date::DATE
  ),
  -- Pick a single sdr_name per email (avoid duplicates if name varies)
  sdr_universe_dedup AS (
    SELECT sdr_email, MIN(sdr_name) as sdr_name
    FROM sdr_universe
    GROUP BY sdr_email
  ),
  dedup_agg AS (
    SELECT sdr_email,
      SUM(agendada_count)::int as r1_agendada,
      SUM(realized)::int as r1_realizada,
      SUM(is_noshow)::int as no_shows
    FROM dedup_agendada
    GROUP BY sdr_email
  ),
  sdr_stats AS (
    SELECT u.sdr_email, u.sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      COALESCE(d.r1_agendada, 0) as r1_agendada,
      COALESCE(d.r1_realizada, 0) as r1_realizada,
      COALESCE(d.no_shows, 0) as no_shows,
      COALESCE(c.contratos, 0) as contratos
    FROM sdr_universe_dedup u
    LEFT JOIN dedup_agg d ON d.sdr_email = u.sdr_email
    LEFT JOIN agendamentos_cte a ON a.sdr_email = u.sdr_email
    LEFT JOIN contratos_cte c ON c.sdr_email = u.sdr_email
  )
  SELECT json_build_object(
    'metrics', COALESCE(json_agg(
      json_build_object(
        'sdr_email', sdr_email, 'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        'no_shows', no_shows,
        'contratos', contratos
      ) ORDER BY agendamentos DESC NULLS LAST
    ), '[]'::json)
  ) INTO result FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$function$;