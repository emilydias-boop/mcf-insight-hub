-- Corrige a referência de coluna s.nome para s.name na função get_sdr_metrics_v2
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH 
  -- Pegar todos os eventos de stage_change no período
  all_events AS (
    SELECT 
      da.deal_id,
      da.created_at,
      da.to_stage,
      da.from_stage,
      da.user_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as owner_email,
      da.metadata
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
    ORDER BY da.deal_id, da.created_at
  ),
  
  -- Para cada deal, identificar eventos chave
  deal_analysis AS (
    SELECT 
      e.deal_id,
      e.created_at,
      e.to_stage,
      e.from_stage,
      e.owner_email,
      -- Verificar se é transição para R1 Agendada
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%AGENDADA%' 
           OR UPPER(e.to_stage) = 'R1 AGENDADA' 
           OR e.to_stage = '45ac09c8-0f59-46aa-8ba0-3e0d87ca4b26'
      THEN TRUE ELSE FALSE END as is_r1_agendada,
      -- Verificar se é No-Show
      CASE WHEN UPPER(e.to_stage) LIKE '%NO%SHOW%' 
           OR UPPER(e.to_stage) = 'NO-SHOW'
           OR e.to_stage = '6bb76ad9-3d48-4e91-b24a-c6e8e18d9e9e'
      THEN TRUE ELSE FALSE END as is_no_show,
      -- Verificar se é R1 Realizada
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%REALIZADA%' 
           OR UPPER(e.to_stage) = 'R1 REALIZADA'
           OR e.to_stage = 'da2e1d78-6eb1-4b89-9ef2-48abe7f46bb0'
      THEN TRUE ELSE FALSE END as is_r1_realizada,
      -- Verificar se é Contrato Pago
      CASE WHEN UPPER(e.to_stage) LIKE '%CONTRATO%PAGO%' 
           OR e.to_stage = 'bd3d2c9a-1f58-4b5e-8e4a-7c9d5f2e1a3b'
      THEN TRUE ELSE FALSE END as is_contrato,
      -- Row number para identificar ordem
      ROW_NUMBER() OVER (PARTITION BY e.deal_id ORDER BY e.created_at) as event_order
    FROM all_events e
  ),
  
  -- Identificar primeiro agendamento e intermediador de cada deal
  first_agendamento AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      owner_email as intermediador_email,
      created_at as primeiro_agendamento_at
    FROM deal_analysis
    WHERE is_r1_agendada = TRUE
    ORDER BY deal_id, created_at
  ),
  
  -- Identificar no-shows com owner no momento
  no_shows AS (
    SELECT 
      da.deal_id,
      da.owner_email as no_show_owner,
      da.created_at as no_show_at,
      ROW_NUMBER() OVER (PARTITION BY da.deal_id ORDER BY da.created_at) as no_show_order
    FROM deal_analysis da
    WHERE da.is_no_show = TRUE
  ),
  
  -- Identificar reagendamentos válidos (após no-show, apenas 1x por lead)
  reagendamentos AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.owner_email as reagendador_email,
      da.created_at as reagendamento_at
    FROM deal_analysis da
    INNER JOIN no_shows ns ON ns.deal_id = da.deal_id AND ns.no_show_at < da.created_at
    WHERE da.is_r1_agendada = TRUE
      AND EXISTS (
        SELECT 1 FROM first_agendamento fa 
        WHERE fa.deal_id = da.deal_id AND fa.primeiro_agendamento_at < da.created_at
      )
    ORDER BY da.deal_id, da.created_at
  ),
  
  -- Identificar realizadas com intermediador
  realizadas AS (
    SELECT 
      da.deal_id,
      da.owner_email as realizada_owner,
      da.created_at as realizada_at,
      fa.intermediador_email
    FROM deal_analysis da
    INNER JOIN first_agendamento fa ON fa.deal_id = da.deal_id
    WHERE da.is_r1_realizada = TRUE
  ),
  
  -- Identificar contratos com intermediador
  contratos AS (
    SELECT 
      da.deal_id,
      da.owner_email as contrato_owner,
      da.created_at as contrato_at,
      fa.intermediador_email
    FROM deal_analysis da
    INNER JOIN first_agendamento fa ON fa.deal_id = da.deal_id
    WHERE da.is_contrato = TRUE
  ),
  
  -- Agregar métricas por SDR
  sdr_metrics AS (
    SELECT 
      sdr_email,
      COUNT(DISTINCT primeiro_agendamento_deal) as primeiro_agendamento,
      COUNT(DISTINCT reagendamento_deal) as reagendamento,
      COUNT(DISTINCT no_show_deal) as no_shows,
      COUNT(DISTINCT realizada_deal) as realizadas,
      COUNT(DISTINCT contrato_deal) as contratos
    FROM (
      -- 1º Agendamentos
      SELECT 
        fa.intermediador_email as sdr_email,
        fa.deal_id::text as primeiro_agendamento_deal,
        NULL::text as reagendamento_deal,
        NULL::text as no_show_deal,
        NULL::text as realizada_deal,
        NULL::text as contrato_deal
      FROM first_agendamento fa
      WHERE (sdr_email_filter IS NULL OR LOWER(fa.intermediador_email) = LOWER(sdr_email_filter))
      
      UNION ALL
      
      -- Reagendamentos
      SELECT 
        r.reagendador_email as sdr_email,
        NULL::text as primeiro_agendamento_deal,
        r.deal_id::text as reagendamento_deal,
        NULL::text as no_show_deal,
        NULL::text as realizada_deal,
        NULL::text as contrato_deal
      FROM reagendamentos r
      WHERE (sdr_email_filter IS NULL OR LOWER(r.reagendador_email) = LOWER(sdr_email_filter))
      
      UNION ALL
      
      -- No-Shows (owner no momento)
      SELECT 
        ns.no_show_owner as sdr_email,
        NULL::text as primeiro_agendamento_deal,
        NULL::text as reagendamento_deal,
        ns.deal_id::text as no_show_deal,
        NULL::text as realizada_deal,
        NULL::text as contrato_deal
      FROM no_shows ns
      WHERE ns.no_show_order = 1
        AND (sdr_email_filter IS NULL OR LOWER(ns.no_show_owner) = LOWER(sdr_email_filter))
      
      UNION ALL
      
      -- Realizadas (por intermediação)
      SELECT 
        r.intermediador_email as sdr_email,
        NULL::text as primeiro_agendamento_deal,
        NULL::text as reagendamento_deal,
        NULL::text as no_show_deal,
        r.deal_id::text as realizada_deal,
        NULL::text as contrato_deal
      FROM realizadas r
      WHERE (sdr_email_filter IS NULL OR LOWER(r.intermediador_email) = LOWER(sdr_email_filter))
      
      UNION ALL
      
      -- Contratos (por intermediação)
      SELECT 
        c.intermediador_email as sdr_email,
        NULL::text as primeiro_agendamento_deal,
        NULL::text as reagendamento_deal,
        NULL::text as no_show_deal,
        NULL::text as realizada_deal,
        c.deal_id::text as contrato_deal
      FROM contratos c
      WHERE (sdr_email_filter IS NULL OR LOWER(c.intermediador_email) = LOWER(sdr_email_filter))
    ) all_metrics
    WHERE sdr_email IS NOT NULL
    GROUP BY sdr_email
  ),
  
  -- Adicionar nomes e calcular taxas - CORRIGIDO: s.name em vez de s.nome
  final_metrics AS (
    SELECT 
      sm.sdr_email,
      COALESCE(s.name, p.full_name, sm.sdr_email) as sdr_name,
      sm.primeiro_agendamento,
      sm.reagendamento,
      (sm.primeiro_agendamento + sm.reagendamento) as total_agendamentos,
      sm.no_shows,
      sm.realizadas,
      sm.contratos,
      CASE 
        WHEN (sm.primeiro_agendamento + sm.reagendamento) > 0 
        THEN ROUND((sm.realizadas::numeric / (sm.primeiro_agendamento + sm.reagendamento)::numeric) * 100, 1)
        ELSE 0 
      END as taxa_conversao,
      CASE 
        WHEN (sm.primeiro_agendamento + sm.reagendamento) > 0 
        THEN ROUND((sm.no_shows::numeric / (sm.primeiro_agendamento + sm.reagendamento)::numeric) * 100, 1)
        ELSE 0 
      END as taxa_no_show
    FROM sdr_metrics sm
    LEFT JOIN sdr s ON LOWER(s.email) = LOWER(sm.sdr_email)
    LEFT JOIN profiles p ON LOWER(p.email) = LOWER(sm.sdr_email)
    ORDER BY sm.realizadas DESC, sm.primeiro_agendamento DESC
  )
  
  SELECT json_build_object(
    'metrics', COALESCE((SELECT json_agg(fm) FROM final_metrics fm), '[]'::json),
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
$function$;