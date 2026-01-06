
-- Atualizar get_sdr_metrics_v2 para usar deal_activities e mesma lógica do get_sdr_all_movements_v2
-- Isso garante consistência entre o resumo e a lista de reuniões

DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(date, date, text);

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
  -- Todos os eventos de stage_change ordenados (usando deal_activities, não webhook_events)
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
  
  -- Análise de cada evento (mesma lógica do get_sdr_all_movements_v2)
  event_analysis AS (
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
      THEN TRUE ELSE FALSE END as is_contrato,
      ROW_NUMBER() OVER (PARTITION BY e.deal_id ORDER BY e.created_at) as event_order
    FROM all_events e
  ),
  
  -- Identificar primeiro agendamento de cada deal (histórico completo)
  first_agendamento_ever AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      created_at as primeiro_agendamento_at,
      owner_email as primeiro_agendador
    FROM event_analysis
    WHERE is_r1_agendada = TRUE
    ORDER BY deal_id, created_at
  ),
  
  -- Identificar todos os no-shows de cada deal
  all_no_shows AS (
    SELECT 
      deal_id,
      created_at as no_show_at,
      ROW_NUMBER() OVER (PARTITION BY deal_id ORDER BY created_at) as no_show_order
    FROM event_analysis
    WHERE is_no_show = TRUE
  ),
  
  -- Todos os movimentos para R1 Agendada no período com classificação
  all_movements AS (
    SELECT 
      ea.deal_id,
      ea.created_at as data_agendamento,
      ea.owner_email as agendador_email,
      ea.from_stage,
      -- Determinar se é 1º agendamento, reagendamento válido ou inválido
      CASE 
        WHEN fa.primeiro_agendamento_at = ea.created_at THEN '1º Agendamento'
        WHEN EXISTS (
          SELECT 1 FROM all_no_shows ns 
          WHERE ns.deal_id = ea.deal_id 
            AND ns.no_show_at < ea.created_at
            AND ns.no_show_at > fa.primeiro_agendamento_at
        ) THEN 'Reagendamento Válido'
        ELSE 'Reagendamento Inválido'
      END as tipo_contagem,
      -- Flag se conta ou não
      CASE 
        WHEN fa.primeiro_agendamento_at = ea.created_at THEN TRUE
        WHEN EXISTS (
          SELECT 1 FROM all_no_shows ns 
          WHERE ns.deal_id = ea.deal_id 
            AND ns.no_show_at < ea.created_at
            AND ns.no_show_at > fa.primeiro_agendamento_at
        ) THEN TRUE
        ELSE FALSE
      END as conta
    FROM event_analysis ea
    LEFT JOIN first_agendamento_ever fa ON fa.deal_id = ea.deal_id
    WHERE ea.is_r1_agendada = TRUE
      AND ea.created_at >= start_date::timestamp
      AND ea.created_at < (end_date + interval '1 day')::timestamp
  ),
  
  -- Agrupar por deal_id - UMA LINHA POR LEAD (evita dupla contagem)
  grouped_movements AS (
    SELECT 
      am.deal_id,
      -- Pegar o intermediador da movimentação que conta (ou a primeira)
      (SELECT agendador_email FROM all_movements am2 
       WHERE am2.deal_id = am.deal_id 
       ORDER BY am2.conta DESC, am2.data_agendamento ASC 
       LIMIT 1) as intermediador,
      -- Tipo: priorizar 1º Agendamento > Reagendamento Válido > Reagendamento Inválido
      CASE 
        WHEN bool_or(am.tipo_contagem = '1º Agendamento') THEN '1º Agendamento'
        WHEN bool_or(am.tipo_contagem = 'Reagendamento Válido') THEN 'Reagendamento Válido'
        ELSE 'Reagendamento Inválido'
      END as tipo,
      -- Conta se qualquer movimentação conta
      bool_or(am.conta) as conta
    FROM all_movements am
    GROUP BY am.deal_id
  ),
  
  -- Status atual de cada deal (para no-show/realizada/contrato)
  current_status AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      CASE 
        WHEN is_contrato THEN 'Contrato'
        WHEN is_r1_realizada THEN 'Realizada'
        WHEN is_no_show THEN 'No-Show'
        WHEN is_r1_agendada THEN 'Agendada'
        ELSE to_stage
      END as status_atual
    FROM event_analysis
    ORDER BY deal_id, created_at DESC
  ),
  
  -- Métricas por SDR baseadas em deals consolidados
  sdr_metrics AS (
    SELECT 
      LOWER(gm.intermediador) as sdr_email,
      COUNT(DISTINCT CASE WHEN gm.tipo = '1º Agendamento' AND gm.conta THEN gm.deal_id END) as primeiro_agendamento,
      COUNT(DISTINCT CASE WHEN gm.tipo = 'Reagendamento Válido' AND gm.conta THEN gm.deal_id END) as reagendamento,
      COUNT(DISTINCT CASE WHEN gm.conta THEN gm.deal_id END) as total_agendamentos,
      -- No-shows: deals que este SDR agendou e que viraram No-Show
      COUNT(DISTINCT CASE WHEN cs.status_atual = 'No-Show' THEN gm.deal_id END) as no_shows,
      -- Realizadas: deals que este SDR agendou e que viraram Realizada ou Contrato
      COUNT(DISTINCT CASE WHEN cs.status_atual IN ('Realizada', 'Contrato') THEN gm.deal_id END) as realizadas,
      -- Contratos: deals que este SDR agendou e que viraram Contrato
      COUNT(DISTINCT CASE WHEN cs.status_atual = 'Contrato' THEN gm.deal_id END) as contratos
    FROM grouped_movements gm
    LEFT JOIN current_status cs ON cs.deal_id = gm.deal_id
    WHERE gm.intermediador IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(gm.intermediador) = LOWER(sdr_email_filter))
    GROUP BY LOWER(gm.intermediador)
  ),
  
  -- Calcular taxas e enriquecer com nome
  final_metrics AS (
    SELECT 
      sm.sdr_email,
      COALESCE(
        (SELECT p.full_name FROM profiles p WHERE lower(p.email) = sm.sdr_email LIMIT 1),
        INITCAP(REPLACE(SPLIT_PART(sm.sdr_email, '@', 1), '.', ' '))
      ) as sdr_name,
      sm.primeiro_agendamento::int,
      sm.reagendamento::int,
      sm.total_agendamentos::int,
      sm.no_shows::int,
      sm.realizadas::int,
      sm.contratos::int,
      CASE 
        WHEN sm.realizadas > 0 THEN ROUND((sm.contratos::numeric / sm.realizadas::numeric) * 100, 1)
        ELSE 0 
      END as taxa_conversao,
      CASE 
        WHEN sm.total_agendamentos > 0 THEN ROUND((sm.no_shows::numeric / sm.total_agendamentos::numeric) * 100, 1)
        ELSE 0 
      END as taxa_no_show
    FROM sdr_metrics sm
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
$function$;
