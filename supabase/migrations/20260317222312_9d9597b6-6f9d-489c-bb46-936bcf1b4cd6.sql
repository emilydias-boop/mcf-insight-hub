
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date date,
  end_date date,
  sdr_email_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH sdr_attendees AS (
    SELECT
      p.email as sdr_email,
      COALESCE(p.full_name, e.name, p.email) as sdr_name,
      msa.status as attendee_status,
      msa.is_partner,
      msa.created_at as booked_at,
      ms.scheduled_at,
      ms.meeting_type
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p ON p.id = msa.booked_by
    LEFT JOIN employees e ON e.profile_id = msa.booked_by
    WHERE msa.booked_by IS NOT NULL
      AND msa.is_partner = false
      AND ms.meeting_type = 'r1'
      AND msa.status NOT IN ('cancelled', 'rescheduled')
  ),
  -- Agendamentos criados no período (by created_at/booked_at)
  agendamentos_periodo AS (
    SELECT
      sdr_email,
      sdr_name,
      COUNT(*) as agendamentos
    FROM sdr_attendees
    WHERE (booked_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (booked_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(sdr_email) = LOWER(sdr_email_filter))
    GROUP BY sdr_email, sdr_name
  ),
  -- Reuniões PARA o período (by scheduled_at)
  reunioes_periodo AS (
    SELECT
      sdr_email,
      sdr_name,
      COUNT(*) as r1_agendada,
      COUNT(CASE WHEN attendee_status IN ('completed', 'contract_paid', 'refunded') THEN 1 END) as r1_realizada,
      COUNT(CASE WHEN attendee_status = 'no_show' THEN 1 END) as no_shows,
      COUNT(CASE WHEN attendee_status = 'contract_paid' THEN 1 END) as contratos
    FROM sdr_attendees
    WHERE (scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(sdr_email) = LOWER(sdr_email_filter))
    GROUP BY sdr_email, sdr_name
  ),
  -- Combinar
  combined AS (
    SELECT
      COALESCE(a.sdr_email, r.sdr_email) as sdr_email,
      COALESCE(a.sdr_name, r.sdr_name) as sdr_name,
      COALESCE(a.agendamentos, 0) as agendamentos,
      COALESCE(r.r1_agendada, 0) as r1_agendada,
      COALESCE(r.r1_realizada, 0) as r1_realizada,
      COALESCE(r.no_shows, 0) as no_shows,
      COALESCE(r.contratos, 0) as contratos
    FROM agendamentos_periodo a
    FULL OUTER JOIN reunioes_periodo r ON a.sdr_email = r.sdr_email
  )
  SELECT json_build_object(
    'metrics', COALESCE((
      SELECT json_agg(
        json_build_object(
          'sdr_email', c.sdr_email,
          'sdr_name', c.sdr_name,
          'agendamentos', c.agendamentos,
          'r1_agendada', c.r1_agendada,
          'r1_realizada', c.r1_realizada,
          'no_shows', c.no_shows,
          'contratos', c.contratos
        )
      )
      FROM combined c
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$function$;

-- Fix existing attendees that are stuck with invited/scheduled status
-- on meeting_slots that were already rescheduled
UPDATE meeting_slot_attendees msa
SET status = 'rescheduled'
FROM meeting_slots ms
WHERE msa.meeting_slot_id = ms.id
  AND ms.status = 'rescheduled'
  AND msa.status IN ('invited', 'scheduled');
