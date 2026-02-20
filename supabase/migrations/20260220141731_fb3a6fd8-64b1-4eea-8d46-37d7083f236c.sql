CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text
)
RETURNS TABLE(
  deal_id text, deal_name text, contact_name text, contact_email text, contact_phone text,
  tipo text, data_agendamento date, scheduled_at timestamp with time zone, status_atual text,
  intermediador text, closer text, origin_name text, probability integer,
  attendee_id uuid, meeting_slot_id uuid, attendee_status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id::TEXT as deal_id,
    d.name as deal_name,
    c.name as contact_name,
    c.email as contact_email,
    c.phone as contact_phone,
    CASE 
      WHEN ms.meeting_type = 'reagendamento' THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END as tipo,
    COALESCE(msa.booked_at, msa.created_at)::DATE as data_agendamento,
    ms.scheduled_at,
    COALESCE(s.stage_name, 'Reunião 01 Agendada') as status_atual,
    COALESCE(p.full_name, p.email, '') as intermediador,
    cl.name as closer,
    COALESCE(o.name, '') as origin_name,
    COALESCE(d.probability, 0)::INTEGER as probability,
    msa.id as attendee_id,
    ms.id as meeting_slot_id,
    msa.status as attendee_status
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN crm_deals d ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c ON c.id = d.contact_id
  LEFT JOIN crm_stages s ON s.id = d.stage_id
  LEFT JOIN profiles p ON p.id = msa.booked_by
  LEFT JOIN closers cl ON cl.id = ms.closer_id
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  WHERE COALESCE(msa.booked_at, msa.created_at)::DATE BETWEEN start_date::DATE AND end_date::DATE
    AND msa.status != 'cancelled'
    AND msa.is_partner = false
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
  ORDER BY COALESCE(msa.booked_at, msa.created_at) DESC;
END;
$$;