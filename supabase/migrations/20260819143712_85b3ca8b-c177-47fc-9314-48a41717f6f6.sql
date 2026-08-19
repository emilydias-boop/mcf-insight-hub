CREATE OR REPLACE FUNCTION public.get_agenda_fatos_consorcio(start_date text, end_date text)
RETURNS TABLE (
  fato text,
  deal_id uuid,
  meeting_day date,
  attendee_status text,
  sdr_email text,
  sdr_name text,
  closer_id uuid,
  closer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT
    msa.id AS attendee_id,
    msa.deal_id,
    COALESCE(msa.deal_id::text, 'msa:' || msa.id::text) AS unit_key,
    (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date AS meeting_day,
    msa.status::text AS attendee_status,
    COALESCE(msa.booked_at, msa.created_at) AS effective_booked_at,
    LOWER(p_booker.email) AS sdr_email,
    COALESCE(p_booker.full_name, p_booker.email) AS sdr_name,
    ms.closer_id,
    cl.name AS closer_name
  FROM meeting_slot_attendees msa
  INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  INNER JOIN closers cl ON cl.id = ms.closer_id
  LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
  WHERE msa.status <> 'cancelled'
    AND ms.meeting_type = 'r1'
    AND msa.is_partner = false
    AND cl.bu = 'consorcio'
    AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
        BETWEEN start_date::date AND end_date::date
),
-- 1 unidade por (deal, dia); representante prioriza completed > no_show > resto
units AS (
  SELECT DISTINCT ON (unit_key, meeting_day)
    unit_key, deal_id, meeting_day, attendee_status,
    sdr_email, sdr_name, closer_id, closer_name, effective_booked_at
  FROM base
  ORDER BY unit_key, meeting_day,
    CASE attendee_status WHEN 'completed' THEN 0 WHEN 'no_show' THEN 1 ELSE 2 END,
    effective_booked_at
),
-- cap de 2 dias distintos por deal
capped AS (
  SELECT *
  FROM (
    SELECT u.*, ROW_NUMBER() OVER (PARTITION BY unit_key ORDER BY meeting_day) AS rn
    FROM units u
  ) x
  WHERE rn <= 2
)
SELECT 'agendada'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name FROM capped
UNION ALL
SELECT 'realizada'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name FROM capped WHERE attendee_status = 'completed'
UNION ALL
SELECT 'no_show'::text, deal_id, meeting_day, attendee_status, sdr_email, sdr_name, closer_id, closer_name FROM capped WHERE attendee_status = 'no_show';
$function$;

GRANT EXECUTE ON FUNCTION public.get_agenda_fatos_consorcio(text, text) TO authenticated, service_role;