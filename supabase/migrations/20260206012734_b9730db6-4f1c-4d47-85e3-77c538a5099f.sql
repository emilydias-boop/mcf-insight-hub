-- Drop and recreate get_sdr_metrics_from_agenda with correct column name (scheduled_at)
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date date,
  end_date date,
  sdr_email_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH sdr_metrics AS (
    SELECT 
      msa.booked_by_email AS sdr_email,
      COALESCE(p.full_name, msa.booked_by_name, split_part(msa.booked_by_email, '@', 1)) AS sdr_name,
      
      -- Agendamentos: criados no período (by booked_at date in São Paulo timezone)
      COUNT(DISTINCT CASE 
        WHEN (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date AND end_date
        THEN msa.id 
      END) AS agendamentos,
      
      -- R1 Agendada: reuniões PARA o período (scheduled_at in range)
      COUNT(DISTINCT CASE 
        WHEN ms.meeting_type = 'R1' 
          AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date AND end_date
        THEN msa.id 
      END) AS r1_agendada,
      
      -- R1 Realizada: completed/contract_paid/refunded no período
      COUNT(DISTINCT CASE 
        WHEN ms.meeting_type = 'R1' 
          AND msa.status IN ('completed', 'contract_paid', 'refunded')
          AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date AND end_date
        THEN msa.id 
      END) AS r1_realizada,
      
      -- Contratos: pagos no período
      COUNT(DISTINCT CASE 
        WHEN msa.status = 'contract_paid'
          AND (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN start_date AND end_date
        THEN msa.id 
      END) AS contratos
      
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.slot_id
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.rescheduled_from_attendee_id
    LEFT JOIN profiles p ON p.email = msa.booked_by_email
    WHERE msa.booked_by_email IS NOT NULL
      AND msa.status != 'cancelled'
      AND (sdr_email_filter IS NULL OR msa.booked_by_email = sdr_email_filter)
      -- Only count original appointments (not reschedules) for agendamentos
      AND (parent_msa.id IS NULL OR parent_msa.status = 'cancelled')
    GROUP BY msa.booked_by_email, COALESCE(p.full_name, msa.booked_by_name, split_part(msa.booked_by_email, '@', 1))
  )
  SELECT json_build_object(
    'metrics', COALESCE(json_agg(
      json_build_object(
        'sdr_email', sdr_email,
        'sdr_name', sdr_name,
        'agendamentos', COALESCE(agendamentos, 0),
        'r1_agendada', COALESCE(r1_agendada, 0),
        'r1_realizada', COALESCE(r1_realizada, 0),
        'no_shows', GREATEST(0, COALESCE(agendamentos, 0) - COALESCE(r1_realizada, 0)),
        'contratos', COALESCE(contratos, 0)
      )
    ), '[]'::json)
  ) INTO result
  FROM sdr_metrics;
  
  RETURN result;
END;
$$;