-- Drop current faulty function and recreate with working logic
DROP FUNCTION IF EXISTS get_sdr_metrics_v2(date, date, text);

CREATE OR REPLACE FUNCTION get_sdr_metrics_v2(
  start_date date,
  end_date date,
  sdr_email_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH primeiro_agendamento AS (
    SELECT 
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND (da.from_stage ILIKE '%Lead Qualificado%' OR da.from_stage ILIKE '%Novo Lead%' OR da.from_stage IS NULL)
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  deals_with_previous_reuniao AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND da.created_at::date < start_date
  ),
  reagendamento AS (
    SELECT 
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND da.from_stage ILIKE '%No-Show%'
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  no_shows AS (
    SELECT DISTINCT ON (da.deal_id, da.metadata->>'owner_email')
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%No-Show%'
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  current_stages AS (
    SELECT 
      d.id as deal_id,
      s.stage_name as current_stage
    FROM crm_deals d
    LEFT JOIN crm_stages s ON d.stage_id = s.id
  ),
  realizadas AS (
    SELECT 
      pa.sdr_email,
      pa.deal_id
    FROM primeiro_agendamento pa
    JOIN current_stages cs ON pa.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Realizada%' 
       OR cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
    UNION
    SELECT 
      ra.sdr_email,
      ra.deal_id
    FROM reagendamento ra
    JOIN current_stages cs ON ra.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Realizada%' 
       OR cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
  ),
  contratos AS (
    SELECT 
      pa.sdr_email,
      pa.deal_id
    FROM primeiro_agendamento pa
    JOIN current_stages cs ON pa.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
    UNION
    SELECT 
      ra.sdr_email,
      ra.deal_id
    FROM reagendamento ra
    JOIN current_stages cs ON ra.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
  ),
  all_sdrs AS (
    SELECT DISTINCT sdr_email FROM primeiro_agendamento
    UNION
    SELECT DISTINCT sdr_email FROM reagendamento
    UNION
    SELECT DISTINCT sdr_email FROM no_shows
  ),
  metrics AS (
    SELECT 
      s.sdr_email,
      COALESCE(s.sdr_email, 'Desconhecido') as sdr_name,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM primeiro_agendamento WHERE sdr_email = s.sdr_email), 0) as primeiro_agendamento,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM reagendamento WHERE sdr_email = s.sdr_email), 0) as reagendamento,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM primeiro_agendamento WHERE sdr_email = s.sdr_email), 0) +
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM reagendamento WHERE sdr_email = s.sdr_email), 0) as total_agendamentos,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM no_shows WHERE sdr_email = s.sdr_email), 0) as no_shows,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM realizadas WHERE sdr_email = s.sdr_email), 0) as realizadas,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM contratos WHERE sdr_email = s.sdr_email), 0) as contratos
    FROM all_sdrs s
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', m.sdr_email,
          'sdr_name', m.sdr_name,
          'primeiro_agendamento', m.primeiro_agendamento,
          'reagendamento', m.reagendamento,
          'total_agendamentos', m.total_agendamentos,
          'no_shows', m.no_shows,
          'realizadas', m.realizadas,
          'contratos', m.contratos,
          'taxa_conversao', CASE WHEN m.total_agendamentos > 0 
            THEN ROUND((m.contratos::numeric / m.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END,
          'taxa_no_show', CASE WHEN m.total_agendamentos > 0 
            THEN ROUND((m.no_shows::numeric / m.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END
        )
      )
      FROM metrics m
      WHERE m.total_agendamentos > 0 OR m.no_shows > 0
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM metrics), 0)
    )
  ) INTO result;

  RETURN result;
END;
$$;