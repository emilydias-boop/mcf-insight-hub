
-- Drop existing functions first
DROP FUNCTION IF EXISTS get_sdr_metrics_v2(DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS get_sdr_all_movements_v2(DATE, DATE, TEXT);

-- Recreate get_sdr_metrics_v2 with fixed type casting
CREATE OR REPLACE FUNCTION get_sdr_metrics_v2(
  start_date DATE,
  end_date DATE,
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
  WITH r1_stages AS (
    SELECT id, stage_name
    FROM crm_stages
    WHERE stage_name ILIKE '%Reunião 01 Agendada%'
       OR stage_name ILIKE '%Reuniao 01 Agendada%'
       OR stage_name ILIKE '%R1 Agendada%'
  ),
  -- Get all R1 movements from LQ or No-Show within the period
  r1_movements AS (
    SELECT 
      da.deal_id,
      da.created_at,
      da.user_id,
      da.from_stage,
      da.to_stage,
      CASE 
        WHEN da.from_stage ILIKE '%No-Show%' OR da.from_stage ILIKE '%No Show%' THEN 'reagendamento'
        ELSE 'primeiro_agendamento'
      END as tipo_agendamento
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + INTERVAL '1 day')::timestamp
      AND EXISTS (
        SELECT 1 FROM r1_stages r WHERE da.to_stage = r.stage_name
      )
      AND (
        da.from_stage ILIKE '%Lead Qualificado%'
        OR da.from_stage ILIKE '%LQ%'
        OR da.from_stage ILIKE '%No-Show%'
        OR da.from_stage ILIKE '%No Show%'
        OR da.from_stage ILIKE '%NoShow%'
      )
  ),
  -- Get current stage for each deal (with TEXT deal_id)
  current_stages AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      to_stage as current_stage
    FROM deal_activities
    WHERE activity_type = 'stage_change'
    ORDER BY deal_id, created_at DESC
  ),
  -- Aggregate metrics by SDR
  sdr_metrics AS (
    SELECT 
      rm.user_id as sdr_email,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%No-Show%' OR cs.current_stage ILIKE '%No Show%') as no_shows,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Realizada%' OR cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as realizadas,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as contratos
    FROM r1_movements rm
    LEFT JOIN current_stages cs ON rm.deal_id = cs.deal_id
    WHERE (sdr_email_filter IS NULL OR rm.user_id = sdr_email_filter)
    GROUP BY rm.user_id
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', sm.sdr_email,
          'sdr_name', COALESCE(sm.sdr_email, 'Desconhecido'),
          'primeiro_agendamento', sm.primeiro_agendamento,
          'reagendamento', sm.reagendamento,
          'total_agendamentos', sm.total_agendamentos,
          'no_shows', sm.no_shows,
          'realizadas', sm.realizadas,
          'contratos', sm.contratos,
          'taxa_conversao', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.contratos::numeric / sm.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END,
          'taxa_no_show', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.no_shows::numeric / sm.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END
        )
      )
      FROM sdr_metrics sm
    ), '[]'::jsonb),
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

-- Recreate get_sdr_all_movements_v2 with fixed return type
CREATE OR REPLACE FUNCTION get_sdr_all_movements_v2(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  deal_id TEXT,
  deal_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  tipo TEXT,
  data_agendamento TIMESTAMPTZ,
  status_atual TEXT,
  intermediador TEXT,
  current_owner TEXT,
  closer TEXT,
  origin_name TEXT,
  probability INTEGER,
  conta BOOLEAN,
  total_movimentacoes INTEGER,
  from_stage TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH r1_stages AS (
    SELECT s.id, s.stage_name
    FROM crm_stages s
    WHERE s.stage_name ILIKE '%Reunião 01 Agendada%'
       OR s.stage_name ILIKE '%Reuniao 01 Agendada%'
       OR s.stage_name ILIKE '%R1 Agendada%'
  ),
  -- Get all R1 movements from LQ or No-Show within the period
  r1_movements AS (
    SELECT 
      da.deal_id as mov_deal_id,
      da.created_at,
      da.user_id,
      da.from_stage as from_stg,
      da.to_stage,
      CASE 
        WHEN da.from_stage ILIKE '%No-Show%' OR da.from_stage ILIKE '%No Show%' THEN 'Reagendamento Válido'
        ELSE '1º Agendamento'
      END as tipo_mov,
      TRUE as conta_mov
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + INTERVAL '1 day')::timestamp
      AND EXISTS (
        SELECT 1 FROM r1_stages r WHERE da.to_stage = r.stage_name
      )
      AND (
        da.from_stage ILIKE '%Lead Qualificado%'
        OR da.from_stage ILIKE '%LQ%'
        OR da.from_stage ILIKE '%No-Show%'
        OR da.from_stage ILIKE '%No Show%'
        OR da.from_stage ILIKE '%NoShow%'
      )
  ),
  -- Count movements per deal in period
  movement_counts AS (
    SELECT 
      rm.mov_deal_id as cnt_deal_id,
      COUNT(*) as total_movs
    FROM r1_movements rm
    GROUP BY rm.mov_deal_id
  ),
  -- Get current stage for each deal
  current_stages AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id as cs_deal_id,
      da.to_stage as current_stage
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
    ORDER BY da.deal_id, da.created_at DESC
  )
  SELECT 
    rm.mov_deal_id::TEXT as deal_id,
    d.name::TEXT as deal_name,
    c.name::TEXT as contact_name,
    c.email::TEXT as contact_email,
    c.phone::TEXT as contact_phone,
    rm.tipo_mov::TEXT as tipo,
    rm.created_at as data_agendamento,
    COALESCE(cs.current_stage, 'Desconhecido')::TEXT as status_atual,
    rm.user_id::TEXT as intermediador,
    d.owner_id::TEXT as current_owner,
    NULL::TEXT as closer,
    o.name::TEXT as origin_name,
    d.probability::INTEGER,
    rm.conta_mov as conta,
    COALESCE(mc.total_movs, 1)::INTEGER as total_movimentacoes,
    rm.from_stg::TEXT as from_stage
  FROM r1_movements rm
  LEFT JOIN crm_deals d ON rm.mov_deal_id::uuid = d.id
  LEFT JOIN crm_contacts c ON d.contact_id = c.id
  LEFT JOIN crm_origins o ON d.origin_id = o.id
  LEFT JOIN current_stages cs ON rm.mov_deal_id = cs.cs_deal_id
  LEFT JOIN movement_counts mc ON rm.mov_deal_id = mc.cnt_deal_id
  WHERE (sdr_email_filter IS NULL OR rm.user_id = sdr_email_filter)
  ORDER BY rm.created_at DESC;
END;
$$;
