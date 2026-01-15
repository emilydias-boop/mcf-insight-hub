CREATE OR REPLACE FUNCTION get_sdr_meetings_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
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
  probability INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    msa.deal_id::TEXT,
    d.name::TEXT as deal_name,
    msa.attendee_name::TEXT as contact_name,
    c.email::TEXT as contact_email,
    msa.attendee_phone::TEXT as contact_phone,
    CASE 
      WHEN msa.parent_attendee_id IS NOT NULL THEN 'Reagendamento'
      ELSE '1º Agendamento'
    END::TEXT as tipo,
    msa.created_at as data_agendamento,
    ms.scheduled_at,
    CASE msa.status
      WHEN 'completed' THEN 'Reunião 01 Realizada'
      WHEN 'contract_paid' THEN 'Contrato Pago'
      WHEN 'no_show' THEN 'No-Show'
      WHEN 'cancelled' THEN 'Cancelada'
      ELSE 'Reunião 01 Agendada'
    END::TEXT as status_atual,
    p_sdr.email::TEXT as intermediador,
    p_closer.full_name::TEXT as closer,
    o.name::TEXT as origin_name,
    d.probability::INT
  FROM meeting_slot_attendees msa
  INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  LEFT JOIN profiles p_sdr ON p_sdr.id = msa.booked_by
  LEFT JOIN profiles p_closer ON p_closer.id = ms.booked_by
  LEFT JOIN crm_deals d ON d.id = msa.deal_id
  LEFT JOIN crm_contacts c ON c.id = d.contact_id
  LEFT JOIN crm_origins o ON o.id = d.origin_id
  WHERE msa.status != 'cancelled'
    AND p_sdr.email IS NOT NULL
    AND (sdr_email_filter IS NULL OR p_sdr.email = sdr_email_filter)
    AND msa.created_at::date >= start_date::DATE 
    AND msa.created_at::date <= end_date::DATE
  ORDER BY msa.created_at DESC;
END;
$$ LANGUAGE plpgsql;