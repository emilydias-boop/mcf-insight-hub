
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
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
          'no_shows', GREATEST(0, COALESCE(agendamentos, 0) - COALESCE(r1_realizada, 0)),
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
$$;

-- Recriar get_sdr_meetings_from_agenda excluindo partners
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_from_agenda(
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
    AND msa.is_partner = false
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
  ORDER BY COALESCE(msa.booked_at, msa.created_at) DESC;
END;
$$;
