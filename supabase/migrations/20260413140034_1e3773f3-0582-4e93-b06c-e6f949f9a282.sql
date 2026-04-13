
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text, text);

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT, end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL, bu_filter TEXT DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
      MAX(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 ELSE 0 END) as realized
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
  sdr_stats AS (
    SELECT d.sdr_email, d.sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      SUM(d.agendada_count)::int as r1_agendada,
      SUM(d.realized)::int as r1_realizada,
      COALESCE(c.contratos, 0) as contratos
    FROM dedup_agendada d
    LEFT JOIN agendamentos_cte a ON a.sdr_email = d.sdr_email
    LEFT JOIN contratos_cte c ON c.sdr_email = d.sdr_email
    GROUP BY d.sdr_email, d.sdr_name, a.agendamentos, c.contratos
  )
  SELECT json_build_object(
    'metrics', COALESCE(json_agg(
      json_build_object(
        'sdr_email', sdr_email, 'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        'no_shows', GREATEST(0, r1_agendada - r1_realizada),
        'contratos', contratos
      ) ORDER BY agendamentos DESC NULLS LAST
    ), '[]'::json)
  ) INTO result FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$function$;
