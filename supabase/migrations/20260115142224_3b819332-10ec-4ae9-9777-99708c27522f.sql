-- Update function with dual date logic:
-- agendamentos: filter by created_at (when SDR created the appointment)
-- r1_agendada, r1_realizada, no_shows, contratos: filter by scheduled_at (when meeting is scheduled FOR)
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
      -- Agendamentos CRIADOS no período (created_at)
      COUNT(CASE WHEN msa.created_at::date >= start_date::DATE 
                  AND msa.created_at::date <= end_date::DATE THEN 1 END) as agendamentos,
      -- R1 Agendada: reuniões marcadas PARA o período (scheduled_at)
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE THEN 1 END) as r1_agendada,
      -- R1 Realizada: completed/contract_paid no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status IN ('completed', 'contract_paid') THEN 1 END) as r1_realizada,
      -- No-show no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status = 'no_show' THEN 1 END) as no_shows,
      -- Contrato pago no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status = 'contract_paid' THEN 1 END) as contratos
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p ON p.id = msa.booked_by
    WHERE msa.status != 'cancelled'
      AND p.email IS NOT NULL
      AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
      AND (
        -- Include if created_at is in range OR scheduled_at is in range
        (msa.created_at::date >= start_date::DATE AND msa.created_at::date <= end_date::DATE)
        OR (ms.scheduled_at::date >= start_date::DATE AND ms.scheduled_at::date <= end_date::DATE)
      )
    GROUP BY p.email, COALESCE(p.full_name, p.email)
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
          'no_shows', no_shows,
          'contratos', contratos
        )
        ORDER BY agendamentos DESC
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_stats;
  
  RETURN result;
END;
$$;