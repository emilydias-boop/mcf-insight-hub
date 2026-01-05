-- Recriar get_sdr_metrics_v2 usando webhook_events como fonte para agendamentos
-- Lógica: 1 agendamento por deal por dia (mesma lógica do Clint)

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(
  start_date DATE,
  end_date DATE,
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
  WITH 
  -- Agendamentos únicos por deal por dia usando webhook_events
  agendamentos_webhook AS (
    SELECT DISTINCT
      LOWER(TRIM(event_data->>'deal_user')) as sdr_email,
      event_data->>'deal_id' as deal_id,
      DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as event_date
    FROM webhook_events
    WHERE event_type = 'deal.stage_changed'
      AND event_data->>'deal_stage' = 'Reunião 01 Agendada'
      AND event_data->>'deal_origin' = 'PIPELINE INSIDE SALES'
      AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') >= start_date
      AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(TRIM(event_data->>'deal_user')) = LOWER(sdr_email_filter))
  ),
  
  -- Primeira vez que cada deal apareceu em R1 Agendada (histórico completo)
  primeiro_agendamento_deal AS (
    SELECT 
      event_data->>'deal_id' as deal_id,
      MIN(DATE(created_at AT TIME ZONE 'America/Sao_Paulo')) as primeira_data
    FROM webhook_events
    WHERE event_type = 'deal.stage_changed'
      AND event_data->>'deal_stage' = 'Reunião 01 Agendada'
      AND event_data->>'deal_origin' = 'PIPELINE INSIDE SALES'
    GROUP BY event_data->>'deal_id'
  ),
  
  -- Classificar cada agendamento como 1º ou reagendamento
  agendamentos_classificados AS (
    SELECT 
      a.sdr_email,
      a.deal_id,
      a.event_date,
      CASE 
        WHEN a.event_date = p.primeira_data THEN 'primeiro_agendamento'
        ELSE 'reagendamento'
      END as tipo
    FROM agendamentos_webhook a
    LEFT JOIN primeiro_agendamento_deal p ON a.deal_id = p.deal_id
  ),
  
  -- No-shows, Realizadas e Contratos continuam usando deal_activities
  no_shows AS (
    SELECT 
      LOWER(TRIM(d.custom_fields->>'responsavel')) as sdr_email,
      COUNT(DISTINCT da.deal_id) as total
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id
    WHERE da.activity_type = 'stage_changed'
      AND da.to_stage = 'No-Show'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') >= start_date
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') <= end_date
      AND d.origin_id IN (SELECT id FROM crm_origins WHERE name = 'PIPELINE INSIDE SALES')
      AND (sdr_email_filter IS NULL OR LOWER(TRIM(d.custom_fields->>'responsavel')) = LOWER(sdr_email_filter))
    GROUP BY LOWER(TRIM(d.custom_fields->>'responsavel'))
  ),
  
  realizadas AS (
    SELECT 
      LOWER(TRIM(d.custom_fields->>'responsavel')) as sdr_email,
      COUNT(DISTINCT da.deal_id) as total
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id
    WHERE da.activity_type = 'stage_changed'
      AND da.to_stage = 'Reunião 01 Realizada'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') >= start_date
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') <= end_date
      AND d.origin_id IN (SELECT id FROM crm_origins WHERE name = 'PIPELINE INSIDE SALES')
      AND (sdr_email_filter IS NULL OR LOWER(TRIM(d.custom_fields->>'responsavel')) = LOWER(sdr_email_filter))
    GROUP BY LOWER(TRIM(d.custom_fields->>'responsavel'))
  ),
  
  contratos AS (
    SELECT 
      LOWER(TRIM(d.custom_fields->>'responsavel')) as sdr_email,
      COUNT(DISTINCT da.deal_id) as total
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id
    WHERE da.activity_type = 'stage_changed'
      AND da.to_stage = 'Contrato Fechado'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') >= start_date
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') <= end_date
      AND d.origin_id IN (SELECT id FROM crm_origins WHERE name = 'PIPELINE INSIDE SALES')
      AND (sdr_email_filter IS NULL OR LOWER(TRIM(d.custom_fields->>'responsavel')) = LOWER(sdr_email_filter))
    GROUP BY LOWER(TRIM(d.custom_fields->>'responsavel'))
  ),
  
  -- Agregar métricas por SDR
  metricas_por_sdr AS (
    SELECT 
      ac.sdr_email,
      COUNT(*) FILTER (WHERE ac.tipo = 'primeiro_agendamento') as r1_agendada,
      COUNT(*) FILTER (WHERE ac.tipo = 'reagendamento') as reagendamentos,
      COUNT(*) as total_agendamentos
    FROM agendamentos_classificados ac
    GROUP BY ac.sdr_email
  ),
  
  -- Combinar todas as métricas
  combined AS (
    SELECT 
      COALESCE(m.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) as sdr_email,
      COALESCE(m.r1_agendada, 0) as r1_agendada,
      COALESCE(m.reagendamentos, 0) as reagendamentos,
      COALESCE(m.total_agendamentos, 0) as total_agendamentos,
      COALESCE(ns.total, 0) as no_shows,
      COALESCE(r.total, 0) as r1_realizada,
      COALESCE(c.total, 0) as contratos
    FROM metricas_por_sdr m
    FULL OUTER JOIN no_shows ns ON m.sdr_email = ns.sdr_email
    FULL OUTER JOIN realizadas r ON COALESCE(m.sdr_email, ns.sdr_email) = r.sdr_email
    FULL OUTER JOIN contratos c ON COALESCE(m.sdr_email, ns.sdr_email, r.sdr_email) = c.sdr_email
    WHERE COALESCE(m.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) IS NOT NULL
  )
  
  SELECT json_build_object(
    'metrics', (SELECT json_agg(row_to_json(combined)) FROM combined),
    'summary', (
      SELECT json_build_object(
        'total_r1_agendada', COALESCE(SUM(r1_agendada), 0),
        'total_reagendamentos', COALESCE(SUM(reagendamentos), 0),
        'total_agendamentos', COALESCE(SUM(total_agendamentos), 0),
        'total_no_shows', COALESCE(SUM(no_shows), 0),
        'total_r1_realizada', COALESCE(SUM(r1_realizada), 0),
        'total_contratos', COALESCE(SUM(contratos), 0)
      )
      FROM combined
    )
  ) INTO result;
  
  RETURN result;
END;
$$;