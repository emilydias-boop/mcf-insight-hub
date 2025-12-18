-- Função RPC para calcular métricas SDR com nova lógica de contagem
-- Regras:
-- 1º Agendamento: primeira transição para R1 Agendada (owner = intermediador)
-- Reagendamento: APENAS se passou por No-Show antes (1x por lead apenas)
-- Ping-pong: retornos para R1 Agendada SEM No-Show antes = IGNORAR
-- No-Show: creditado ao owner NO MOMENTO do evento
-- Realizada/Contrato: creditado ao INTERMEDIADOR (owner do 1º agendamento)

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        fa.deal_id as primeiro_agendamento_deal,
        NULL::uuid as reagendamento_deal,
        NULL::uuid as no_show_deal,
        NULL::uuid as realizada_deal,
        NULL::uuid as contrato_deal
      FROM first_agendamento fa
      WHERE (sdr_email_filter IS NULL OR fa.intermediador_email = sdr_email_filter)
      
      UNION ALL
      
      -- Reagendamentos
      SELECT 
        r.reagendador_email as sdr_email,
        NULL::uuid,
        r.deal_id as reagendamento_deal,
        NULL::uuid,
        NULL::uuid,
        NULL::uuid
      FROM reagendamentos r
      WHERE (sdr_email_filter IS NULL OR r.reagendador_email = sdr_email_filter)
      
      UNION ALL
      
      -- No-Shows (owner no momento)
      SELECT 
        ns.no_show_owner as sdr_email,
        NULL::uuid,
        NULL::uuid,
        ns.deal_id as no_show_deal,
        NULL::uuid,
        NULL::uuid
      FROM no_shows ns
      WHERE ns.no_show_order = 1 -- Contar apenas primeiro no-show por deal
        AND (sdr_email_filter IS NULL OR ns.no_show_owner = sdr_email_filter)
      
      UNION ALL
      
      -- Realizadas (por intermediação)
      SELECT 
        r.intermediador_email as sdr_email,
        NULL::uuid,
        NULL::uuid,
        NULL::uuid,
        r.deal_id as realizada_deal,
        NULL::uuid
      FROM realizadas r
      WHERE (sdr_email_filter IS NULL OR r.intermediador_email = sdr_email_filter)
      
      UNION ALL
      
      -- Contratos (por intermediação)
      SELECT 
        c.intermediador_email as sdr_email,
        NULL::uuid,
        NULL::uuid,
        NULL::uuid,
        NULL::uuid,
        c.deal_id as contrato_deal
      FROM contratos c
      WHERE (sdr_email_filter IS NULL OR c.intermediador_email = sdr_email_filter)
    ) all_metrics
    WHERE sdr_email IS NOT NULL
    GROUP BY sdr_email
  ),
  
  -- Adicionar nomes e calcular taxas
  final_metrics AS (
    SELECT 
      sm.sdr_email,
      COALESCE(s.nome, p.full_name, sm.sdr_email) as sdr_name,
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
$$;

-- Função para obter lista de reuniões com detalhes
CREATE OR REPLACE FUNCTION public.get_sdr_meetings_v2(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  WITH 
  -- Todos os eventos de stage_change
  all_events AS (
    SELECT 
      da.deal_id,
      da.created_at,
      da.to_stage,
      da.from_stage,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as owner_email,
      da.metadata
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
    ORDER BY da.deal_id, da.created_at
  ),
  
  -- Análise de cada deal
  deal_analysis AS (
    SELECT 
      e.deal_id,
      e.created_at,
      e.to_stage,
      e.from_stage,
      e.owner_email,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%AGENDADA%' 
           OR UPPER(e.to_stage) = 'R1 AGENDADA' 
           OR e.to_stage = '45ac09c8-0f59-46aa-8ba0-3e0d87ca4b26'
      THEN TRUE ELSE FALSE END as is_r1_agendada,
      CASE WHEN UPPER(e.to_stage) LIKE '%NO%SHOW%' 
           OR UPPER(e.to_stage) = 'NO-SHOW'
           OR e.to_stage = '6bb76ad9-3d48-4e91-b24a-c6e8e18d9e9e'
      THEN TRUE ELSE FALSE END as is_no_show,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%REALIZADA%' 
           OR UPPER(e.to_stage) = 'R1 REALIZADA'
           OR e.to_stage = 'da2e1d78-6eb1-4b89-9ef2-48abe7f46bb0'
      THEN TRUE ELSE FALSE END as is_r1_realizada,
      CASE WHEN UPPER(e.to_stage) LIKE '%CONTRATO%PAGO%' 
           OR e.to_stage = 'bd3d2c9a-1f58-4b5e-8e4a-7c9d5f2e1a3b'
      THEN TRUE ELSE FALSE END as is_contrato
    FROM all_events e
  ),
  
  -- Primeiro agendamento
  first_agendamento AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      owner_email as intermediador_email,
      created_at as primeiro_agendamento_at
    FROM deal_analysis
    WHERE is_r1_agendada = TRUE
    ORDER BY deal_id, created_at
  ),
  
  -- No-shows
  no_shows AS (
    SELECT 
      da.deal_id,
      da.created_at as no_show_at
    FROM deal_analysis da
    WHERE da.is_no_show = TRUE
  ),
  
  -- Reagendamentos válidos
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
  
  -- Status atual de cada deal
  current_status AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      CASE 
        WHEN is_contrato THEN 'Contrato'
        WHEN is_r1_realizada THEN 'Realizada'
        WHEN is_no_show THEN 'No-Show'
        WHEN is_r1_agendada THEN 'Agendada'
        ELSE to_stage
      END as status_atual,
      owner_email as current_owner
    FROM deal_analysis
    ORDER BY deal_id, created_at DESC
  ),
  
  -- Reuniões com todos os detalhes
  meetings AS (
    -- 1º Agendamentos
    SELECT 
      fa.deal_id,
      d.name as deal_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      '1º Agendamento'::text as tipo,
      fa.primeiro_agendamento_at as data_agendamento,
      cs.status_atual,
      fa.intermediador_email,
      cs.current_owner,
      CASE WHEN LOWER(cs.current_owner) != LOWER(fa.intermediador_email) 
           THEN cs.current_owner ELSE NULL END as closer,
      o.name as origin_name,
      d.probability
    FROM first_agendamento fa
    INNER JOIN crm_deals d ON d.id = fa.deal_id
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN current_status cs ON cs.deal_id = fa.deal_id
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    WHERE fa.primeiro_agendamento_at >= start_date::timestamp
      AND fa.primeiro_agendamento_at < (end_date + interval '1 day')::timestamp
      AND (sdr_email_filter IS NULL OR LOWER(fa.intermediador_email) = LOWER(sdr_email_filter))
    
    UNION ALL
    
    -- Reagendamentos
    SELECT 
      r.deal_id,
      d.name as deal_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      'Reagendamento'::text as tipo,
      r.reagendamento_at as data_agendamento,
      cs.status_atual,
      fa.intermediador_email,
      cs.current_owner,
      CASE WHEN LOWER(cs.current_owner) != LOWER(r.reagendador_email) 
           THEN cs.current_owner ELSE NULL END as closer,
      o.name as origin_name,
      d.probability
    FROM reagendamentos r
    INNER JOIN crm_deals d ON d.id = r.deal_id
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN current_status cs ON cs.deal_id = r.deal_id
    LEFT JOIN first_agendamento fa ON fa.deal_id = r.deal_id
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    WHERE r.reagendamento_at >= start_date::timestamp
      AND r.reagendamento_at < (end_date + interval '1 day')::timestamp
      AND (sdr_email_filter IS NULL OR LOWER(r.reagendador_email) = LOWER(sdr_email_filter))
  )
  
  SELECT COALESCE(json_agg(
    json_build_object(
      'deal_id', m.deal_id,
      'deal_name', m.deal_name,
      'contact_name', m.contact_name,
      'contact_email', m.contact_email,
      'contact_phone', m.contact_phone,
      'tipo', m.tipo,
      'data_agendamento', m.data_agendamento,
      'status_atual', m.status_atual,
      'intermediador', m.intermediador_email,
      'current_owner', m.current_owner,
      'closer', m.closer,
      'origin_name', m.origin_name,
      'probability', m.probability
    ) ORDER BY m.data_agendamento DESC
  ), '[]'::json) INTO result
  FROM meetings m;
  
  RETURN result;
END;
$$;