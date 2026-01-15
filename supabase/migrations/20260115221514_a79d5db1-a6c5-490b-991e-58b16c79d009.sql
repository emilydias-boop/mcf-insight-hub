-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS get_sdr_meetings_from_agenda(TEXT, TEXT, TEXT);

-- Recreate with new return type including attendee fields
CREATE OR REPLACE FUNCTION get_sdr_meetings_from_agenda(
  start_date TEXT, 
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  deal_id TEXT,
  deal_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  tipo TEXT,
  data_agendamento TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  status_atual TEXT,
  intermediador TEXT,
  closer TEXT,
  origin_name TEXT,
  probability INT,
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
    msa.deal_id::TEXT,
    d.name::TEXT as deal_name,
    c.name::TEXT as contact_name,
    c.email::TEXT as contact_email,
    c.phone::TEXT as contact_phone,
    CASE 
      WHEN msa.is_reschedule THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::TEXT as tipo,
    msa.created_at as data_agendamento,
    ms.start_datetime as scheduled_at,
    CASE msa.status
      WHEN 'completed' THEN 'Reunião 01 Realizada'
      WHEN 'contract_paid' THEN 'Contrato Pago'
      WHEN 'no_show' THEN 'No-Show'
      WHEN 'cancelled' THEN 'Cancelada'
      WHEN 'rescheduled' THEN 'Reagendada'
      ELSE 'Reunião 01 Agendada'
    END::TEXT as status_atual,
    booked_by_profile.full_name::TEXT as intermediador,
    closer_record.name::TEXT as closer,
    o.name::TEXT as origin_name,
    COALESCE(d.probability, 0)::INT as probability,
    msa.id as attendee_id,
    msa.meeting_slot_id as meeting_slot_id,
    msa.status::TEXT as attendee_status
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c ON c.id = d.contact_id
  LEFT JOIN profiles booked_by_profile ON booked_by_profile.id = msa.booked_by
  LEFT JOIN closers closer_record ON closer_record.id = ms.closer_id
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  WHERE ms.start_datetime::DATE >= start_date::DATE
    AND ms.start_datetime::DATE <= end_date::DATE
    AND msa.status != 'cancelled'
    AND (sdr_email_filter IS NULL OR booked_by_profile.email = sdr_email_filter)
  ORDER BY ms.start_datetime;
END;
$$;

-- Update RLS policy for meeting_slot_attendees - allow SDRs to update their booked attendees
DROP POLICY IF EXISTS "Admins, coordenadores and closers can update attendees" ON meeting_slot_attendees;

CREATE POLICY "Users can update attendees they booked or have elevated roles"
  ON meeting_slot_attendees FOR UPDATE
  USING (
    booked_by = auth.uid() OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'coordenador') OR
    has_role(auth.uid(), 'closer')
  );

-- Update RLS policy for meeting_slots - allow SDRs to update slots they booked
DROP POLICY IF EXISTS "Users can update their booked slots or admins/coordenadores can" ON meeting_slots;

CREATE POLICY "Users can update slots they booked or have elevated roles"
  ON meeting_slots FOR UPDATE
  USING (
    booked_by = auth.uid() OR
    has_role(auth.uid(), 'admin') OR
    has_role(auth.uid(), 'coordenador') OR
    has_role(auth.uid(), 'closer')
  );