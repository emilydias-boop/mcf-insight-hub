CREATE OR REPLACE FUNCTION get_sdr_metrics_from_agenda(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH attendee_data AS (
    SELECT 
      msa.id,
      msa.status,
      msa.parent_attendee_id,
      msa.deal_id,
      msa.created_at,
      ms.scheduled_at,
      ms.booked_by,
      ms.closer_id,
      p.email as sdr_email,
      DATE(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo') as scheduled_date,
      -- Verificar dados do parent (se existir)
      (
        SELECT json_build_object(
          'status', parent_msa.status,
          'scheduled_date', DATE(parent_ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')
        )
        FROM meeting_slot_attendees parent_msa
        JOIN meeting_slots parent_ms ON parent_msa.meeting_slot_id = parent_ms.id
        WHERE parent_msa.id = msa.parent_attendee_id
      ) as parent_info
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON msa.meeting_slot_id = ms.id
    LEFT JOIN profiles p ON ms.booked_by = p.id
    WHERE ms.scheduled_at >= start_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
      AND ms.scheduled_at < (end_date + INTERVAL '1 day')::timestamp AT TIME ZONE 'America/Sao_Paulo'
      AND msa.status NOT IN ('cancelled', 'rescheduled')
  ),
  classified_attendees AS (
    SELECT 
      ad.*,
      -- 1º Agendamento: sem parent
      CASE WHEN ad.parent_attendee_id IS NULL THEN true ELSE false END as is_primeiro_agendamento,
      -- Remanejamento mesmo dia: tem parent E mesma data
      CASE 
        WHEN ad.parent_attendee_id IS NOT NULL 
          AND (ad.parent_info->>'scheduled_date')::date = ad.scheduled_date
        THEN true 
        ELSE false 
      END as is_same_day_move,
      -- Reagendamento válido: parent com no_show E data diferente
      CASE 
        WHEN ad.parent_attendee_id IS NOT NULL 
          AND ad.parent_info->>'status' = 'no_show'
          AND (ad.parent_info->>'scheduled_date')::date != ad.scheduled_date
        THEN true 
        ELSE false 
      END as is_valid_reschedule
    FROM attendee_data ad
  ),
  sdr_metrics AS (
    SELECT 
      sdr_email,
      -- 1º Agendamento: sem parent E não é remanejamento
      COUNT(*) FILTER (WHERE is_primeiro_agendamento = true) as primeiro_agendamento,
      -- Reagendamento: veio de no-show E dia diferente
      COUNT(*) FILTER (WHERE is_valid_reschedule = true) as reagendamento,
      -- Realizadas
      COUNT(*) FILTER (WHERE status = 'completed') as realizadas,
      -- No-Shows
      COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
      -- Contratos
      COUNT(*) FILTER (WHERE status = 'contract_paid') as contratos
    FROM classified_attendees
    WHERE sdr_email IS NOT NULL
      AND is_same_day_move = false -- Exclui remanejamentos do mesmo dia
      AND (sdr_email_filter IS NULL OR LOWER(sdr_email) = LOWER(sdr_email_filter))
    GROUP BY sdr_email
  )
  SELECT json_build_object(
    'metrics', COALESCE((
      SELECT json_agg(
        json_build_object(
          'sdr_email', sm.sdr_email,
          'sdr_name', sm.sdr_email,
          'primeiro_agendamento', sm.primeiro_agendamento,
          'reagendamento', sm.reagendamento,
          'total_agendamentos', sm.primeiro_agendamento + sm.reagendamento,
          'realizadas', sm.realizadas,
          'no_shows', sm.no_shows,
          'contratos', sm.contratos,
          'taxa_conversao', CASE 
            WHEN (sm.primeiro_agendamento + sm.reagendamento) > 0 
            THEN ROUND((sm.contratos::numeric / (sm.primeiro_agendamento + sm.reagendamento)) * 100, 1)
            ELSE 0 
          END,
          'taxa_no_show', CASE 
            WHEN (sm.primeiro_agendamento + sm.reagendamento) > 0 
            THEN ROUND((sm.no_shows::numeric / (sm.primeiro_agendamento + sm.reagendamento)) * 100, 1)
            ELSE 0 
          END
        )
      )
      FROM sdr_metrics sm
    ), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$$;