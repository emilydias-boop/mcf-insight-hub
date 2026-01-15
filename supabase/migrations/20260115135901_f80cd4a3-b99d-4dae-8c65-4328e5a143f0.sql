-- Update the RPC function to match the visual agenda counting logic
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
      msa.sdr_email,
      COALESCE(msa.sdr_name, msa.sdr_email) as sdr_name,
      -- 1º Agendamento: attendees sem parent_attendee_id
      COUNT(CASE WHEN msa.parent_attendee_id IS NULL THEN 1 END) as primeiro_agendamento,
      -- Reagendamento: attendees com parent_attendee_id (independente do status do parent)
      COUNT(CASE WHEN msa.parent_attendee_id IS NOT NULL THEN 1 END) as reagendamento,
      -- Total: todos attendees (exceto cancelled)
      COUNT(*) as total_agendamentos,
      -- Realizadas: status completed ou contract_paid
      COUNT(CASE WHEN msa.status IN ('completed', 'contract_paid') THEN 1 END) as realizadas,
      -- No-shows
      COUNT(CASE WHEN msa.status = 'no_show' THEN 1 END) as no_shows,
      -- Contratos
      COUNT(CASE WHEN msa.status = 'contract_paid' THEN 1 END) as contratos
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.slot_id
    WHERE 
      ms.slot_date >= start_date::DATE
      AND ms.slot_date <= end_date::DATE
      AND msa.status != 'cancelled'
      AND msa.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR msa.sdr_email = sdr_email_filter)
    GROUP BY msa.sdr_email, COALESCE(msa.sdr_name, msa.sdr_email)
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