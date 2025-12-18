CREATE OR REPLACE FUNCTION public.get_sdr_meetings_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      fa.deal_id::uuid as deal_id,
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
    INNER JOIN crm_deals d ON d.id = fa.deal_id::uuid
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN current_status cs ON cs.deal_id = fa.deal_id
    LEFT JOIN crm_origins o ON o.id = d.origin_id
    WHERE fa.primeiro_agendamento_at >= start_date::timestamp
      AND fa.primeiro_agendamento_at < (end_date + interval '1 day')::timestamp
      AND (sdr_email_filter IS NULL OR LOWER(fa.intermediador_email) = LOWER(sdr_email_filter))
    
    UNION ALL
    
    -- Reagendamentos
    SELECT 
      r.deal_id::uuid as deal_id,
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
    INNER JOIN crm_deals d ON d.id = r.deal_id::uuid
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
$function$;