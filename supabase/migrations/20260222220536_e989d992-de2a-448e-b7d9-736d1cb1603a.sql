
DROP FUNCTION IF EXISTS public.get_sdr_meetings_from_agenda(text, text, text);

CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL
)
RETURNS TABLE(
  deal_id text,
  deal_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  tipo text,
  data_agendamento text,
  scheduled_at timestamptz,
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id::text                       AS deal_id,
    d.name::text                     AS deal_name,
    c.name::text                     AS contact_name,
    c.email::text                    AS contact_email,
    c.phone::text                    AS contact_phone,
    CASE
      WHEN msa.is_rescheduled THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::text                        AS tipo,
    ms.slot_date::text               AS data_agendamento,
    ms.start_time                    AS scheduled_at,
    COALESCE(msa.status, 'scheduled')::text AS status_atual,
    COALESCE(p_booked.full_name, '')::text  AS intermediador,
    COALESCE(cl.name, '')::text      AS closer,
    COALESCE(o.name, '')::text       AS origin_name,
    d.probability                    AS probability,
    msa.id::text                     AS attendee_id,
    ms.id::text                      AS meeting_slot_id,
    COALESCE(msa.status, 'scheduled')::text AS attendee_status,
    COALESCE(p_booked.email, '')::text      AS sdr_email
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms       ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d            ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c    ON c.id = d.contact_id
  LEFT JOIN closers cl        ON cl.id = ms.closer_id
  LEFT JOIN crm_origins o     ON o.id = d.origin_id
  LEFT JOIN profiles p_booked ON p_booked.id = ms.booked_by
  WHERE ms.meeting_type = 'r1'
    AND ms.slot_date BETWEEN start_date::date AND end_date::date
    AND COALESCE(msa.status, 'scheduled') NOT IN ('cancelled')
    AND COALESCE(msa.is_partner, false) = false
    AND (
      sdr_email_filter IS NULL
      OR LOWER(p_booked.email) = LOWER(sdr_email_filter)
    )
  ORDER BY ms.slot_date DESC, ms.start_time DESC;
END;
$$;
