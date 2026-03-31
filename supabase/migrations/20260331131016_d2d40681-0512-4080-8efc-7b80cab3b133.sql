
-- Backfill booked_at where NULL
UPDATE meeting_slot_attendees SET booked_at = created_at WHERE booked_at IS NULL;

-- Recreate 3-param version with COALESCE fallback
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text)
 RETURNS TABLE(deal_id text, deal_name text, contact_name text, contact_email text, contact_phone text, tipo text, data_agendamento text, scheduled_at text, status_atual text, intermediador text, closer text, origin_name text, probability integer, attendee_id text, meeting_slot_id text, attendee_status text, sdr_email text, booked_at text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    d.id::text                                          AS deal_id,
    d.name::text                                        AS deal_name,
    c.name::text                                        AS contact_name,
    c.email::text                                       AS contact_email,
    c.phone::text                                       AS contact_phone,
    CASE
      WHEN msa.is_reschedule THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::text                                           AS tipo,
    (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date::text AS data_agendamento,
    ms.scheduled_at::text                               AS scheduled_at,
    COALESCE(msa.status, 'scheduled')::text             AS status_atual,
    COALESCE(p_booked.full_name, p_booked.email, '')::text AS intermediador,
    COALESCE(cl.name, '')::text                         AS closer,
    COALESCE(o.name, '')::text                          AS origin_name,
    d.probability                                       AS probability,
    msa.id::text                                        AS attendee_id,
    ms.id::text                                         AS meeting_slot_id,
    COALESCE(msa.status, 'scheduled')::text             AS attendee_status,
    COALESCE(p_booked.email, '')::text                  AS sdr_email,
    COALESCE(msa.booked_at, msa.created_at)::text       AS booked_at
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
    AND (
      sdr_email_filter IS NULL
      OR LOWER(p_booked.email) = LOWER(sdr_email_filter)
    )
  ORDER BY ms.scheduled_at DESC;
END;
$function$;

-- Recreate 4-param version with COALESCE fallback
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text, bu_filter text DEFAULT NULL::text)
 RETURNS TABLE(deal_id text, deal_name text, contact_name text, contact_email text, contact_phone text, tipo text, data_agendamento text, scheduled_at text, status_atual text, intermediador text, closer text, origin_name text, probability integer, attendee_id text, meeting_slot_id text, attendee_status text, sdr_email text, booked_at text)
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
    COALESCE(p_booked.email, '')::text,
    COALESCE(msa.booked_at, msa.created_at)::text
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
