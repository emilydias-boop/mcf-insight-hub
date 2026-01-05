-- Primeiro remover a funcao existente, depois recriar com JOINs corrigidos
DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(date, date, text);

CREATE FUNCTION public.get_sdr_metrics_v2(
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
  WITH 
  -- Passo 1: Buscar todos os eventos de webhook que moveram para R1 Agendada no periodo
  webhook_r1_events AS (
    SELECT 
      we.deal_id,
      we.sdr_email,
      DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') as event_date,
      we.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY we.deal_id, DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo')
        ORDER BY we.created_at ASC
      ) as rn_day
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage.updated'
      AND we.to_stage = 'R1 Agendada'
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
      AND (sdr_email_filter IS NULL OR we.sdr_email = sdr_email_filter)
  ),
  
  -- Passo 2: Filtrar apenas 1 agendamento por deal por dia
  unique_daily_appointments AS (
    SELECT 
      deal_id,
      sdr_email,
      event_date,
      created_at
    FROM webhook_r1_events
    WHERE rn_day = 1
  ),
  
  -- Passo 3: Identificar primeiro agendamento vs reagendamento
  appointments_classified AS (
    SELECT 
      uda.*,
      ROW_NUMBER() OVER (PARTITION BY uda.deal_id ORDER BY uda.created_at ASC) as occurrence_number
    FROM unique_daily_appointments uda
  ),
  
  -- Passo 4: Contar metricas por SDR
  sdr_appointments AS (
    SELECT 
      ac.sdr_email,
      COUNT(*) FILTER (WHERE ac.occurrence_number = 1) as primeiro_agendamento,
      COUNT(*) FILTER (WHERE ac.occurrence_number > 1) as reagendamento,
      COUNT(*) as total_agendamentos
    FROM appointments_classified ac
    GROUP BY ac.sdr_email
  ),
  
  -- Passo 5: No-shows (de deal_activities, movimentos para Nao Compareceu)
  sdr_no_shows AS (
    SELECT 
      d.owner_id as sdr_email,
      COUNT(DISTINCT da.deal_id) as no_shows
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id::text
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'Nao Compareceu'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
      AND (sdr_email_filter IS NULL OR d.owner_id = sdr_email_filter)
    GROUP BY d.owner_id
  ),
  
  -- Passo 6: Realizadas (movimentos para R1 Realizada)
  sdr_realizadas AS (
    SELECT 
      d.owner_id as sdr_email,
      COUNT(DISTINCT da.deal_id) as realizadas
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id::text
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'R1 Realizada'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
      AND (sdr_email_filter IS NULL OR d.owner_id = sdr_email_filter)
    GROUP BY d.owner_id
  ),
  
  -- Passo 7: Contratos (movimentos para Contrato Fechado)
  sdr_contratos AS (
    SELECT 
      d.owner_id as sdr_email,
      COUNT(DISTINCT da.deal_id) as contratos
    FROM deal_activities da
    JOIN crm_deals d ON da.deal_id = d.id::text
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'Contrato Fechado'
      AND DATE(da.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
      AND (sdr_email_filter IS NULL OR d.owner_id = sdr_email_filter)
    GROUP BY d.owner_id
  ),
  
  -- Passo 8: Combinar todas as metricas
  combined_metrics AS (
    SELECT 
      COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) as sdr_email,
      COALESCE(sa.primeiro_agendamento, 0) as primeiro_agendamento,
      COALESCE(sa.reagendamento, 0) as reagendamento,
      COALESCE(sa.total_agendamentos, 0) as total_agendamentos,
      COALESCE(ns.no_shows, 0) as no_shows,
      COALESCE(r.realizadas, 0) as realizadas,
      COALESCE(c.contratos, 0) as contratos
    FROM sdr_appointments sa
    FULL OUTER JOIN sdr_no_shows ns ON sa.sdr_email = ns.sdr_email
    FULL OUTER JOIN sdr_realizadas r ON COALESCE(sa.sdr_email, ns.sdr_email) = r.sdr_email
    FULL OUTER JOIN sdr_contratos c ON COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email) = c.sdr_email
    WHERE COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) IS NOT NULL
  ),
  
  -- Passo 9: Calcular taxas e formatar resultado
  final_metrics AS (
    SELECT 
      cm.sdr_email,
      COALESCE(cm.sdr_email, 'Desconhecido') as sdr_name,
      cm.primeiro_agendamento,
      cm.reagendamento,
      cm.total_agendamentos,
      cm.no_shows,
      cm.realizadas,
      cm.contratos,
      CASE 
        WHEN cm.realizadas > 0 THEN ROUND((cm.contratos::numeric / cm.realizadas::numeric) * 100, 1)
        ELSE 0 
      END as taxa_conversao,
      CASE 
        WHEN cm.total_agendamentos > 0 THEN ROUND((cm.no_shows::numeric / cm.total_agendamentos::numeric) * 100, 1)
        ELSE 0 
      END as taxa_no_show
    FROM combined_metrics cm
  )
  
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', fm.sdr_email,
          'sdr_name', fm.sdr_name,
          'primeiro_agendamento', fm.primeiro_agendamento,
          'reagendamento', fm.reagendamento,
          'total_agendamentos', fm.total_agendamentos,
          'no_shows', fm.no_shows,
          'realizadas', fm.realizadas,
          'contratos', fm.contratos,
          'taxa_conversao', fm.taxa_conversao,
          'taxa_no_show', fm.taxa_no_show
        )
      )
      FROM final_metrics fm
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM final_metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM final_metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM final_metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM final_metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM final_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM final_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;