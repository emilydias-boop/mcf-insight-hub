
-- Add bu_filter to get_sdr_metrics_from_agenda
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL,
  bu_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH sdr_stats AS (
    SELECT 
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      COUNT(CASE 
        WHEN (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
         AND (
           (msa.parent_attendee_id IS NULL AND COALESCE(msa.is_reschedule, false) = false)
           OR (msa.parent_attendee_id IS NOT NULL AND parent_msa.parent_attendee_id IS NULL)
           OR (msa.parent_attendee_id IS NULL AND msa.is_reschedule = true)
         )
        THEN 1 
      END) as agendamentos,
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as r1_agendada,
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
         AND msa.status IN ('completed', 'contract_paid', 'refunded')
        THEN 1 
      END) as r1_realizada,
      COUNT(CASE 
        WHEN (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as contratos
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
    GROUP BY p_booker.email, p_booker.full_name
    HAVING p_booker.email IS NOT NULL
  )
  SELECT json_build_object(
    'metrics', COALESCE(
      json_agg(
        json_build_object(
          'sdr_email', sdr_email,
          'sdr_name', sdr_name,
          'agendamentos', COALESCE(agendamentos, 0),
          'r1_agendada', COALESCE(r1_agendada, 0),
          'r1_realizada', COALESCE(r1_realizada, 0),
          'no_shows', GREATEST(0, COALESCE(r1_agendada, 0) - COALESCE(r1_realizada, 0)),
          'contratos', COALESCE(contratos, 0)
        )
        ORDER BY agendamentos DESC NULLS LAST
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$function$;

-- Add bu_filter to get_sdr_meetings_from_agenda
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL,
  bu_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  deal_id text,
  deal_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tipo text,
  data_agendamento text,
  scheduled_at text,
  status_atual text,
  intermediador text,
  closer text,
  origin_name text,
  probability integer,
  attendee_id text,
  meeting_slot_id text,
  attendee_status text,
  sdr_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id::text,
    d.name::text,
    c.name::text,
    c.email::text,
    c.phone::text,
    CASE
      WHEN msa.is_reschedule THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::text,
    (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date::text,
    ms.scheduled_at::text,
    COALESCE(msa.status, 'scheduled')::text,
    COALESCE(p_booked.full_name, p_booked.email, '')::text,
    COALESCE(cl.name, '')::text,
    COALESCE(o.name, '')::text,
    d.probability,
    msa.id::text,
    ms.id::text,
    COALESCE(msa.status, 'scheduled')::text,
    COALESCE(p_booked.email, '')::text
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms       ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d            ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c    ON c.id = d.contact_id
  LEFT JOIN closers cl        ON cl.id = ms.closer_id
  LEFT JOIN crm_origins o     ON o.id = d.origin_id
  LEFT JOIN profiles p_booked ON p_booked.id = COALESCE(msa.booked_by, ms.booked_by)
  WHERE ms.meeting_type = 'r1'
    AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN start_date::date AND end_date::date
    AND COALESCE(msa.status, 'scheduled') != 'cancelled'
    AND COALESCE(msa.is_partner, false) = false
    AND (sdr_email_filter IS NULL OR LOWER(p_booked.email) = LOWER(sdr_email_filter))
    AND (bu_filter IS NULL OR cl.bu = bu_filter)
  ORDER BY ms.scheduled_at DESC;
END;
$function$;
