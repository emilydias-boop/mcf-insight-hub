-- Update the function to filter by created_at (when the appointment was created)
-- instead of scheduled_at (when the meeting is scheduled for)
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
      p.email as sdr_email,
      COALESCE(p.full_name, p.email) as sdr_name,
      COUNT(CASE WHEN msa.parent_attendee_id IS NULL THEN 1 END) as primeiro_agendamento,
      COUNT(CASE WHEN msa.parent_attendee_id IS NOT NULL THEN 1 END) as reagendamento,
      COUNT(*) as total_agendamentos,
      COUNT(CASE WHEN msa.status IN ('completed', 'contract_paid') THEN 1 END) as realizadas,
      COUNT(CASE WHEN msa.status = 'no_show' THEN 1 END) as no_shows,
      COUNT(CASE WHEN msa.status = 'contract_paid' THEN 1 END) as contratos
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p ON p.id = msa.booked_by
    WHERE 
      msa.created_at::date >= start_date::DATE
      AND msa.created_at::date <= end_date::DATE
      AND msa.status != 'cancelled'
      AND p.email IS NOT NULL
      AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
    GROUP BY p.email, COALESCE(p.full_name, p.email)
  )
  SELECT json_build_object(
    'metrics', COALESCE(
      json_agg(
        json_build_object(
          'sdr_email', sdr_email,
          'sdr_name', sdr_name,
          'primeiro_agendamento', primeiro_agendamento,
          'reagendamento', reagendamento,
          'total_agendamentos', total_agendamentos,
          'realizadas', realizadas,
          'no_shows', no_shows,
          'contratos', contratos,
          'taxa_conversao', CASE WHEN total_agendamentos > 0 THEN ROUND((contratos::NUMERIC / total_agendamentos) * 100, 1) ELSE 0 END,
          'taxa_no_show', CASE WHEN total_agendamentos > 0 THEN ROUND((no_shows::NUMERIC / total_agendamentos) * 100, 1) ELSE 0 END
        )
        ORDER BY total_agendamentos DESC
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_stats;
  
  RETURN result;
END;
$$;