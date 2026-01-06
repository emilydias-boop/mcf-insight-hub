-- DROP e recriar função get_sdr_metrics_v2 com nova lógica de contagem
-- Conta apenas deals que tiveram seu PRIMEIRO agendamento no período como "primeiro_agendamento"
-- Deals que já tinham sido agendados antes são contados como "reagendamento"

DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(date, date, text);

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
  -- Identificar a primeira vez que cada deal foi para R1 Agendada (em toda a história)
  first_ever_r1 AS (
    SELECT 
      we.event_data->>'deal_id' as deal_id,
      lower(we.event_data->>'deal_user') as primeiro_sdr,
      MIN(we.created_at) as first_r1_date
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_stage' = 'Reunião 01 Agendada'
      AND we.event_data->>'deal_id' IS NOT NULL
    GROUP BY we.event_data->>'deal_id', lower(we.event_data->>'deal_user')
  ),
  
  -- Apenas primeiro R1 de cada deal (histórico global)
  first_r1_global AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      primeiro_sdr,
      first_r1_date
    FROM first_ever_r1
    ORDER BY deal_id, first_r1_date ASC
  ),
  
  -- Deals que tiveram seu PRIMEIRO R1 no período (Primeiro Agendamento)
  primeiros_agendamentos AS (
    SELECT 
      frg.deal_id,
      frg.primeiro_sdr as sdr_email
    FROM first_r1_global frg
    WHERE DATE(frg.first_r1_date AT TIME ZONE 'America/Sao_Paulo') >= start_date 
      AND DATE(frg.first_r1_date AT TIME ZONE 'America/Sao_Paulo') <= end_date
  ),
  
  -- Deals que já tinham R1 antes e voltaram para R1 no período (Reagendamento)
  reagendamentos AS (
    SELECT DISTINCT
      we.event_data->>'deal_id' as deal_id,
      lower(we.event_data->>'deal_user') as sdr_email
    FROM webhook_events we
    INNER JOIN first_r1_global frg ON we.event_data->>'deal_id' = frg.deal_id
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_stage' = 'Reunião 01 Agendada'
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') >= start_date 
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') <= end_date
      -- É reagendamento se o primeiro R1 global foi ANTES do período
      AND DATE(frg.first_r1_date AT TIME ZONE 'America/Sao_Paulo') < start_date
  ),
  
  -- Métricas por SDR - Contagem de deals distintos
  sdr_appointments AS (
    SELECT 
      sdr_email,
      COUNT(DISTINCT deal_id) as primeiro_agendamento,
      0 as reagendamento
    FROM primeiros_agendamentos
    GROUP BY sdr_email
    
    UNION ALL
    
    SELECT 
      sdr_email,
      0 as primeiro_agendamento,
      COUNT(DISTINCT deal_id) as reagendamento
    FROM reagendamentos
    GROUP BY sdr_email
  ),
  
  -- Agregar métricas
  sdr_appointments_agg AS (
    SELECT 
      sdr_email,
      SUM(primeiro_agendamento) as primeiro_agendamento,
      SUM(reagendamento) as reagendamento,
      SUM(primeiro_agendamento) + SUM(reagendamento) as total_agendamentos
    FROM sdr_appointments
    GROUP BY sdr_email
  ),
  
  -- No-shows no período
  sdr_no_shows AS (
    SELECT 
      lower(we.event_data->>'deal_user') as sdr_email,
      COUNT(DISTINCT we.event_data->>'deal_id') as no_shows
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_stage' = 'No-Show'
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
    GROUP BY lower(we.event_data->>'deal_user')
  ),
  
  -- Realizadas no período
  sdr_realizadas AS (
    SELECT 
      lower(we.event_data->>'deal_user') as sdr_email,
      COUNT(DISTINCT we.event_data->>'deal_id') as realizadas
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_stage' = 'Reunião 01 Realizada'
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
    GROUP BY lower(we.event_data->>'deal_user')
  ),
  
  -- Contratos no período
  sdr_contratos AS (
    SELECT 
      lower(we.event_data->>'deal_user') as sdr_email,
      COUNT(DISTINCT we.event_data->>'deal_id') as contratos
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_stage' IN ('Contrato Pago', 'Venda realizada')
      AND DATE(we.created_at AT TIME ZONE 'America/Sao_Paulo') BETWEEN start_date AND end_date
    GROUP BY lower(we.event_data->>'deal_user')
  ),
  
  -- Combinar todas as métricas
  combined_metrics AS (
    SELECT 
      COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) as sdr_email,
      COALESCE(sa.primeiro_agendamento, 0)::int as primeiro_agendamento,
      COALESCE(sa.reagendamento, 0)::int as reagendamento,
      COALESCE(sa.total_agendamentos, 0)::int as total_agendamentos,
      COALESCE(ns.no_shows, 0)::int as no_shows,
      COALESCE(r.realizadas, 0)::int as realizadas,
      COALESCE(c.contratos, 0)::int as contratos
    FROM sdr_appointments_agg sa
    FULL OUTER JOIN sdr_no_shows ns ON sa.sdr_email = ns.sdr_email
    FULL OUTER JOIN sdr_realizadas r ON COALESCE(sa.sdr_email, ns.sdr_email) = r.sdr_email
    FULL OUTER JOIN sdr_contratos c ON COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email) = c.sdr_email
    WHERE COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) IS NOT NULL
      AND (sdr_email_filter IS NULL OR COALESCE(sa.sdr_email, ns.sdr_email, r.sdr_email, c.sdr_email) = lower(sdr_email_filter))
  ),
  
  -- Calcular taxas
  final_metrics AS (
    SELECT 
      cm.sdr_email,
      COALESCE(
        (SELECT p.full_name FROM profiles p WHERE lower(p.email) = cm.sdr_email LIMIT 1),
        INITCAP(REPLACE(SPLIT_PART(cm.sdr_email, '@', 1), '.', ' '))
      ) as sdr_name,
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
  
  SELECT json_build_object(
    'metrics', COALESCE((SELECT json_agg(row_to_json(fm)) FROM final_metrics fm), '[]'::json),
    'summary', json_build_object(
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