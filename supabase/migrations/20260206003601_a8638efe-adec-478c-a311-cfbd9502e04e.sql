-- Fix get_sdr_metrics_from_agenda function with correct column references
CREATE OR REPLACE FUNCTION get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH sdr_metrics AS (
    SELECT 
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, split_part(p_booker.email, '@', 1)) as sdr_name,
      
      -- Agendamentos: criados NO período (data de criação/booking)
      COUNT(DISTINCT CASE 
        WHEN (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as agendamentos,
      
      -- R1 Agendada: reuniões marcadas PARA o período
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as r1_agendada,
      
      -- R1 Realizada: reuniões realizadas no período
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
         AND msa.status IN ('completed', 'contract_paid', 'refunded')
        THEN msa.id 
      END) as r1_realizada,
      
      -- Contratos: com contract_paid_at no período
      COUNT(DISTINCT CASE 
        WHEN (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as contratos
      
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN profiles p_booker ON p_booker.id = msa.booked_by
    WHERE msa.booked_by IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(p_booker.email) = LOWER(sdr_email_filter))
      AND (msa.is_reschedule IS NOT TRUE OR msa.is_reschedule IS NULL)
    GROUP BY p_booker.email, COALESCE(p_booker.full_name, split_part(p_booker.email, '@', 1))
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE(jsonb_agg(
      jsonb_build_object(
        'sdr_email', sdr_email,
        'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        'no_shows', GREATEST(0, agendamentos - r1_realizada),
        'contratos', contratos
      )
    ), '[]'::jsonb)
  ) INTO result
  FROM sdr_metrics;
  
  RETURN result;
END;
$$;