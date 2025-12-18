
-- Atualizar RPC para consolidar uma linha por lead
CREATE OR REPLACE FUNCTION public.get_sdr_all_movements_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH 
  -- Todos os eventos de stage_change ordenados
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
  
  -- Análise de cada evento
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
    FROM event_analysis
    ORDER BY deal_id, created_at DESC
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
  
  -- Agrupar por deal_id - UMA LINHA POR LEAD
  grouped_movements AS (
    SELECT 
      am.deal_id,
      -- Pegar o intermediador da movimentação que conta (ou a primeira)
      (SELECT agendador_email FROM all_movements am2 
       WHERE am2.deal_id = am.deal_id 
       ORDER BY am2.conta DESC, am2.data_agendamento ASC 
       LIMIT 1) as intermediador,
      -- Pegar a data da movimentação que conta (ou a mais recente)
      (SELECT data_agendamento FROM all_movements am2 
       WHERE am2.deal_id = am.deal_id 
       ORDER BY am2.conta DESC, am2.data_agendamento DESC 
       LIMIT 1) as data_agendamento,
      -- Tipo: priorizar 1º Agendamento > Reagendamento Válido > Reagendamento Inválido
      CASE 
        WHEN bool_or(am.tipo_contagem = '1º Agendamento') THEN '1º Agendamento'
        WHEN bool_or(am.tipo_contagem = 'Reagendamento Válido') THEN 'Reagendamento Válido'
        ELSE 'Reagendamento Inválido'
      END as tipo,
      -- Conta se qualquer movimentação conta
      bool_or(am.conta) as conta,
      -- Total de movimentações no período
      COUNT(*) as total_movimentacoes
    FROM all_movements am
    GROUP BY am.deal_id
  ),
  
  -- Enriquecer com dados do deal e contato
  enriched_movements AS (
    SELECT 
      gm.deal_id::uuid,
      d.name as deal_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      gm.data_agendamento,
      gm.intermediador,
      cs.status_atual,
      cs.current_owner,
      CASE WHEN LOWER(cs.current_owner) != LOWER(gm.intermediador) 
           THEN cs.current_owner ELSE NULL END as closer,
      o.name as origin_name,
      d.probability,
      gm.tipo,
      gm.conta,
      gm.total_movimentacoes::int
    FROM grouped_movements gm
    INNER JOIN crm_deals d ON d.id = gm.deal_id::uuid
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN current_status cs ON cs.deal_id = gm.deal_id
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    WHERE (sdr_email_filter IS NULL OR LOWER(gm.intermediador) = LOWER(sdr_email_filter))
  )
  
  SELECT COALESCE(json_agg(
    json_build_object(
      'deal_id', em.deal_id,
      'deal_name', em.deal_name,
      'contact_name', em.contact_name,
      'contact_email', em.contact_email,
      'contact_phone', em.contact_phone,
      'data_agendamento', em.data_agendamento,
      'intermediador', em.intermediador,
      'status_atual', em.status_atual,
      'current_owner', em.current_owner,
      'closer', em.closer,
      'origin_name', em.origin_name,
      'probability', em.probability,
      'tipo', em.tipo,
      'conta', em.conta,
      'total_movimentacoes', em.total_movimentacoes
    ) ORDER BY em.data_agendamento DESC
  ), '[]'::json) INTO result
  FROM enriched_movements em;
  
  RETURN result;
END;
$function$;
