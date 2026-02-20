
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
  scheduled_at text,
  status_atual text,
  intermediador text,
  closer text,
  origin_name text,
  probability numeric,
  attendee_id text,
  meeting_slot_id text,
  attendee_status text,
  sdr_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id::text as deal_id,
    d.name::text as deal_name,
    COALESCE(c.name, '')::text as contact_name,
    COALESCE(c.email, '')::text as contact_email,
    COALESCE(c.phone, '')::text as contact_phone,
    CASE
      WHEN msa.is_reschedule THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::text as tipo,
    to_char(COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')::text as data_agendamento,
    to_char(ms.start_time AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS')::text as scheduled_at,
    COALESCE(msa.status, 'scheduled')::text as status_atual,
    COALESCE(p.full_name, p.email, '')::text as intermediador,
    COALESCE(cl.name, '')::text as closer,
    COALESCE(o.name, '')::text as origin_name,
    COALESCE(d.probability, 0)::numeric as probability,
    msa.id::text as attendee_id,
    ms.id::text as meeting_slot_id,
    COALESCE(msa.status, 'scheduled')::text as attendee_status,
    COALESCE(p.email, '')::text as sdr_email
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.slot_id
  JOIN closers cl ON cl.id = ms.closer_id
  LEFT JOIN crm_deals d ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c ON c.id = d.contact_id
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  LEFT JOIN profiles p ON p.id = msa.booked_by
  WHERE COALESCE(msa.booked_at, msa.created_at)::DATE BETWEEN start_date::DATE AND end_date::DATE
    AND msa.status != 'cancelled'
    AND msa.is_partner = false
    AND ms.meeting_type = 'r1'
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
  ORDER BY COALESCE(msa.booked_at, msa.created_at) DESC;
END;
$$;
