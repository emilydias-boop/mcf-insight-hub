-- Drop existing function (all signatures)
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);

-- Create corrected function with proper column references
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
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
  WITH sdr_data AS (
    SELECT 
      p.email as sdr_email,
      p.full_name as sdr_name,
      
      -- Agendamentos: contagem de attendees criados no período pelo SDR
      COUNT(DISTINCT msa.id) FILTER (
        WHERE msa.booked_at::date BETWEEN start_date::date AND end_date::date
        AND msa.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM meeting_slot_attendees parent_msa
          WHERE parent_msa.id = msa.rescheduled_from_id
          AND parent_msa.status IN ('completed', 'contract_paid', 'refunded')
        )
      ) as agendamentos,
      
      -- R1 Agendada: reuniões PARA o período (scheduled_at)
      COUNT(DISTINCT msa.id) FILTER (
        WHERE ms.scheduled_at::date BETWEEN start_date::date AND end_date::date
        AND msa.status != 'cancelled'
      ) as r1_agendada,
      
      -- R1 Realizada: reuniões realizadas no período
      COUNT(DISTINCT msa.id) FILTER (
        WHERE ms.scheduled_at::date BETWEEN start_date::date AND end_date::date
        AND msa.status IN ('completed', 'contract_paid', 'refunded')
      ) as r1_realizada,
      
      -- Contratos: pagos no período
      COUNT(DISTINCT msa.id) FILTER (
        WHERE msa.contract_paid_at::date BETWEEN start_date::date AND end_date::date
      ) as contratos
      
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN profiles p ON msa.booked_by = p.id
    JOIN user_roles ur ON ur.user_id = p.id
    WHERE ur.role IN ('sdr', 'closer', 'admin', 'coordenador', 'manager')
    AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
    GROUP BY p.email, p.full_name
  )
  SELECT json_build_object(
    'metrics', COALESCE(
      json_agg(
        json_build_object(
          'sdr_email', sdr_email,
          'sdr_name', sdr_name,
          'agendamentos', agendamentos,
          'r1_agendada', r1_agendada,
          'r1_realizada', r1_realizada,
          'no_shows', GREATEST(0, r1_agendada - r1_realizada),
          'contratos', contratos
        )
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_data
  WHERE agendamentos > 0 OR r1_agendada > 0;
  
  RETURN result;
END;
$$;