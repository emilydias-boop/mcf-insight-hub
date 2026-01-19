CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  deal_id TEXT,
  deal_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  tipo TEXT,
  data_agendamento DATE,
  scheduled_at TIMESTAMPTZ,
  status_atual TEXT,
  intermediador TEXT,
  closer TEXT,
  origin_name TEXT,
  probability INTEGER,
  attendee_id UUID,
  meeting_slot_id UUID,
  attendee_status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  WHERE COALESCE(msa.booked_at, msa.created_at)::DATE BETWEEN start_date AND end_date
    AND msa.status != 'cancelled'
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
  ORDER BY COALESCE(msa.booked_at, msa.created_at) DESC;
END;
$$;