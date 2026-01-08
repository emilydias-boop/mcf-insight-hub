-- Revert get_sdr_metrics_v2 to previous working version (from migration 20260108014422)
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH 
  -- Get all valid movements (LQ→R1, NoShow→R1)
  deal_movements AS (
    SELECT 
      da.deal_id as mov_deal_id,
      da.created_at as mov_created_at,
      da.user_id as mov_user_id,
      da.from_stage as mov_from_stage,
      da.to_stage as mov_to_stage,
      CASE 
        WHEN da.from_stage = 'Lead Qualificado' AND da.to_stage = 'R1 Agendada' THEN 'primeiro_agendamento'
        WHEN da.from_stage = 'No-Show' AND da.to_stage = 'R1 Agendada' THEN 'reagendamento'
        ELSE 'outro'
      END as tipo_movimento
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (
        (da.from_stage = 'Lead Qualificado' AND da.to_stage = 'R1 Agendada')
        OR (da.from_stage = 'No-Show' AND da.to_stage = 'R1 Agendada')
      )
      AND da.created_at >= (start_date || ' 00:00:00')::TIMESTAMP
      AND da.created_at <= (end_date || ' 23:59:59')::TIMESTAMP
  ),
  
  -- Get user info for intermediador
  user_info AS (
    SELECT id, email, raw_user_meta_data->>'name' as name
    FROM auth.users
  ),
  
  -- Get current stage for each deal
  current_stages AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      COALESCE(to_stage, from_stage) as current_stage
    FROM deal_activities
    WHERE activity_type IN ('stage_change', 'stage_changed')
    ORDER BY deal_id, created_at DESC
  ),
  
  -- Aggregate by SDR
  sdr_metrics AS (
    SELECT 
      ui.email as sdr_email,
      COALESCE(ui.name, ui.email) as sdr_name,
      COUNT(*) FILTER (WHERE dm.tipo_movimento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE dm.tipo_movimento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COUNT(*) FILTER (WHERE cs.current_stage = 'No-Show') as no_shows,
      COUNT(*) FILTER (WHERE cs.current_stage = 'R1 Realizada') as realizadas,
      COUNT(*) FILTER (WHERE cs.current_stage = 'Contrato') as contratos
    FROM deal_movements dm
    JOIN user_info ui ON dm.mov_user_id = ui.id
    LEFT JOIN current_stages cs ON dm.mov_deal_id = cs.deal_id
    WHERE (sdr_email_filter IS NULL OR ui.email = sdr_email_filter)
    GROUP BY ui.email, ui.name
  )
  
  SELECT jsonb_build_object(
    'metrics', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', sm.sdr_email,
          'sdr_name', sm.sdr_name,
          'primeiro_agendamento', sm.primeiro_agendamento,
          'reagendamento', sm.reagendamento,
          'total_agendamentos', sm.total_agendamentos,
          'no_shows', sm.no_shows,
          'realizadas', sm.realizadas,
          'contratos', sm.contratos,
          'taxa_conversao', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.contratos::NUMERIC / sm.total_agendamentos) * 100, 1) 
            ELSE 0 END,
          'taxa_no_show', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.no_shows::NUMERIC / sm.total_agendamentos) * 100, 1) 
            ELSE 0 END
        )
      ) FROM sdr_metrics sm),
      '[]'::jsonb
    ),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM sdr_metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM sdr_metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM sdr_metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM sdr_metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM sdr_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM sdr_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Revert get_sdr_all_movements_v2 to previous working version
CREATE OR REPLACE FUNCTION public.get_sdr_all_movements_v2(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH 
  -- Get all valid movements (LQ→R1, NoShow→R1)
  deal_movements AS (
    SELECT 
      da.deal_id as mov_deal_id,
      da.created_at as mov_created_at,
      da.user_id as mov_user_id,
      da.from_stage as mov_from_stage,
      da.to_stage as mov_to_stage,
      CASE 
        WHEN da.from_stage = 'Lead Qualificado' AND da.to_stage = 'R1 Agendada' THEN 'primeiro_agendamento'
        WHEN da.from_stage = 'No-Show' AND da.to_stage = 'R1 Agendada' THEN 'reagendamento'
        ELSE 'outro'
      END as tipo_movimento
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (
        (da.from_stage = 'Lead Qualificado' AND da.to_stage = 'R1 Agendada')
        OR (da.from_stage = 'No-Show' AND da.to_stage = 'R1 Agendada')
      )
      AND da.created_at >= (start_date || ' 00:00:00')::TIMESTAMP
      AND da.created_at <= (end_date || ' 23:59:59')::TIMESTAMP
  ),
  
  -- Get user info for intermediador
  user_info AS (
    SELECT id, email, raw_user_meta_data->>'name' as name
    FROM auth.users
  ),
  
  -- Get current stage for each deal
  current_stages AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      COALESCE(to_stage, from_stage) as current_stage
    FROM deal_activities
    WHERE activity_type IN ('stage_change', 'stage_changed')
    ORDER BY deal_id, created_at DESC
  ),
  
  -- Count total movements per deal
  movement_counts AS (
    SELECT 
      deal_id,
      COUNT(*) as total_movs
    FROM deal_activities
    WHERE activity_type IN ('stage_change', 'stage_changed')
      AND (
        (from_stage = 'Lead Qualificado' AND to_stage = 'R1 Agendada')
        OR (from_stage = 'No-Show' AND to_stage = 'R1 Agendada')
      )
    GROUP BY deal_id
  ),
  
  -- Build detailed list
  detailed_movements AS (
    SELECT 
      dm.mov_deal_id as deal_id,
      d.name as deal_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      CASE 
        WHEN dm.tipo_movimento = 'primeiro_agendamento' THEN '1º Agendamento'
        WHEN dm.tipo_movimento = 'reagendamento' THEN 'Reagendamento Válido'
        ELSE 'Outro'
      END as tipo,
      dm.mov_created_at as data_agendamento,
      COALESCE(cs.current_stage, 'R1 Agendada') as status_atual,
      COALESCE(ui.name, ui.email) as intermediador,
      d.owner_id as current_owner,
      d.custom_fields->>'closer' as closer,
      o.display_name as origin_name,
      d.probability,
      TRUE as conta,
      COALESCE(mc.total_movs, 1) as total_movimentacoes,
      dm.mov_from_stage as from_stage
    FROM deal_movements dm
    JOIN user_info ui ON dm.mov_user_id = ui.id
    LEFT JOIN crm_deals d ON dm.mov_deal_id::uuid = d.id
    LEFT JOIN crm_contacts c ON d.contact_id = c.id
    LEFT JOIN crm_origins o ON d.origin_id = o.id
    LEFT JOIN current_stages cs ON dm.mov_deal_id = cs.deal_id
    LEFT JOIN movement_counts mc ON dm.mov_deal_id = mc.deal_id
    WHERE (sdr_email_filter IS NULL OR ui.email = sdr_email_filter)
    ORDER BY dm.mov_created_at DESC
  )
  
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'deal_id', dm.deal_id,
        'deal_name', dm.deal_name,
        'contact_name', dm.contact_name,
        'contact_email', dm.contact_email,
        'contact_phone', dm.contact_phone,
        'tipo', dm.tipo,
        'data_agendamento', dm.data_agendamento,
        'status_atual', dm.status_atual,
        'intermediador', dm.intermediador,
        'current_owner', dm.current_owner,
        'closer', dm.closer,
        'origin_name', dm.origin_name,
        'probability', dm.probability,
        'conta', dm.conta,
        'total_movimentacoes', dm.total_movimentacoes,
        'from_stage', dm.from_stage
      )
    ),
    '[]'::jsonb
  ) INTO result
  FROM detailed_movements dm;
  
  RETURN result;
END;
$$;