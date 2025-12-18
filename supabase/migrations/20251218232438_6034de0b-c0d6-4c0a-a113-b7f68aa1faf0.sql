-- Atualizar constraint para incluir novo tipo
ALTER TABLE ghost_appointments_audit DROP CONSTRAINT IF EXISTS ghost_appointments_audit_ghost_type_check;
ALTER TABLE ghost_appointments_audit ADD CONSTRAINT ghost_appointments_audit_ghost_type_check 
  CHECK (ghost_type IN ('tipo_a', 'tipo_b', 'ciclo_infinito', 'regressao', 'excesso_requalificacao'));

-- Recriar função com novo tipo de detecção
CREATE OR REPLACE FUNCTION public.detect_ghost_appointments(days_back integer DEFAULT 14)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH 
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
      AND da.created_at >= (NOW() - (days_back || ' days')::interval)
    ORDER BY da.deal_id, da.created_at
  ),
  
  classified_events AS (
    SELECT 
      e.deal_id,
      e.created_at,
      e.to_stage,
      e.from_stage,
      e.owner_email,
      (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date as event_date,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%AGENDADA%' 
           OR UPPER(e.to_stage) = 'R1 AGENDADA' 
           OR e.to_stage = '45ac09c8-0f59-46aa-8ba0-3e0d87ca4b26'
      THEN TRUE ELSE FALSE END as is_r1_agendada,
      CASE WHEN UPPER(e.to_stage) LIKE '%NO%SHOW%' 
           OR UPPER(e.to_stage) = 'NO-SHOW'
           OR e.to_stage = '6bb76ad9-3d48-4e91-b24a-c6e8e18d9e9e'
      THEN TRUE ELSE FALSE END as is_no_show,
      CASE WHEN UPPER(e.to_stage) LIKE '%LEAD%QUALIFICADO%'
           OR UPPER(e.to_stage) = 'LEAD QUALIFICADO'
      THEN TRUE ELSE FALSE END as is_lead_qualificado,
      CASE WHEN UPPER(e.to_stage) LIKE '%REUNI%01%REALIZADA%' 
           OR UPPER(e.to_stage) = 'R1 REALIZADA'
           OR e.to_stage = 'da2e1d78-6eb1-4b89-9ef2-48abe7f46bb0'
      THEN TRUE ELSE FALSE END as is_r1_realizada,
      CASE WHEN UPPER(e.to_stage) LIKE '%NOVO%LEAD%'
           OR UPPER(e.to_stage) = 'NOVO LEAD'
      THEN TRUE ELSE FALSE END as is_novo_lead,
      ROW_NUMBER() OVER (PARTITION BY e.deal_id ORDER BY e.created_at) as event_order
    FROM all_events e
  ),
  
  -- Detectar ciclos R1 Agendada → Lead Qualificado → R1 Agendada sem progressão
  requalificacao_cycles AS (
    SELECT 
      r1.deal_id,
      r1.owner_email,
      r1.created_at as r1_at,
      lq.created_at as lq_at,
      next_r1.created_at as next_r1_at
    FROM classified_events r1
    INNER JOIN classified_events lq ON lq.deal_id = r1.deal_id 
      AND lq.is_lead_qualificado = TRUE
      AND lq.created_at > r1.created_at
    INNER JOIN classified_events next_r1 ON next_r1.deal_id = r1.deal_id
      AND next_r1.is_r1_agendada = TRUE
      AND next_r1.created_at > lq.created_at
    WHERE r1.is_r1_agendada = TRUE
      -- Garantir que lq é o próximo evento após r1 (sem outro R1 Agendada no meio)
      AND NOT EXISTS (
        SELECT 1 FROM classified_events mid
        WHERE mid.deal_id = r1.deal_id
          AND mid.is_r1_agendada = TRUE
          AND mid.created_at > r1.created_at
          AND mid.created_at < lq.created_at
      )
      -- Garantir que next_r1 é o próximo R1 após lq
      AND NOT EXISTS (
        SELECT 1 FROM classified_events mid
        WHERE mid.deal_id = r1.deal_id
          AND mid.is_r1_agendada = TRUE
          AND mid.created_at > lq.created_at
          AND mid.created_at < next_r1.created_at
      )
      -- SEM No-Show ou R1 Realizada entre r1 e next_r1
      AND NOT EXISTS (
        SELECT 1 FROM classified_events prog
        WHERE prog.deal_id = r1.deal_id
          AND (prog.is_no_show = TRUE OR prog.is_r1_realizada = TRUE)
          AND prog.created_at > r1.created_at
          AND prog.created_at < next_r1.created_at
      )
  ),
  
  -- Contar ciclos por deal
  excesso_requalificacao AS (
    SELECT 
      deal_id,
      owner_email,
      COUNT(*) as ciclos_count
    FROM requalificacao_cycles
    GROUP BY deal_id, owner_email
    HAVING COUNT(*) >= 2
  ),
  
  deal_summary AS (
    SELECT 
      ce.deal_id,
      ce.owner_email,
      COUNT(*) FILTER (WHERE ce.is_r1_agendada) as total_r1_agendada,
      COUNT(DISTINCT ce.event_date) FILTER (WHERE ce.is_r1_agendada) as distinct_r1_days,
      COUNT(*) FILTER (WHERE ce.is_no_show) as no_show_count,
      MIN(ce.created_at) FILTER (WHERE ce.is_r1_agendada) as first_r1,
      MAX(ce.created_at) FILTER (WHERE ce.is_r1_agendada) as last_r1,
      -- Tipo A: mesmo dia
      EXISTS (
        SELECT 1 
        FROM classified_events ce2 
        WHERE ce2.deal_id = ce.deal_id 
          AND ce2.is_r1_agendada 
          AND EXISTS (
            SELECT 1 FROM classified_events ce3 
            WHERE ce3.deal_id = ce2.deal_id 
              AND ce3.is_lead_qualificado 
              AND ce3.created_at > ce2.created_at
              AND ce3.event_date = ce2.event_date
              AND EXISTS (
                SELECT 1 FROM classified_events ce4 
                WHERE ce4.deal_id = ce3.deal_id 
                  AND ce4.is_r1_agendada 
                  AND ce4.created_at > ce3.created_at
                  AND ce4.event_date = ce3.event_date
                  AND NOT EXISTS (
                    SELECT 1 FROM classified_events ce5 
                    WHERE ce5.deal_id = ce3.deal_id 
                      AND ce5.is_no_show 
                      AND ce5.created_at > ce2.created_at 
                      AND ce5.created_at < ce4.created_at
                  )
              )
          )
      ) as has_tipo_a,
      EXISTS (
        SELECT 1 
        FROM classified_events ce2 
        WHERE ce2.deal_id = ce.deal_id 
          AND ce2.is_r1_realizada 
          AND EXISTS (
            SELECT 1 FROM classified_events ce3 
            WHERE ce3.deal_id = ce2.deal_id 
              AND ce3.is_novo_lead 
              AND ce3.created_at > ce2.created_at
          )
      ) as has_regressao,
      -- Excesso de requalificação (2+ ciclos sem progressão)
      COALESCE((SELECT ciclos_count FROM excesso_requalificacao er WHERE er.deal_id = ce.deal_id AND er.owner_email = ce.owner_email), 0) as requalificacao_ciclos,
      json_agg(
        json_build_object(
          'date', ce.created_at,
          'to_stage', ce.to_stage,
          'from_stage', ce.from_stage,
          'owner', ce.owner_email
        ) ORDER BY ce.created_at
      ) as movement_history
    FROM classified_events ce
    GROUP BY ce.deal_id, ce.owner_email
    -- Incluir deals com 2+ R1 Agendada OU com excesso de requalificação
    HAVING COUNT(*) FILTER (WHERE ce.is_r1_agendada) >= 2
  ),
  
  classified_cases AS (
    SELECT 
      ds.deal_id::uuid,
      ds.owner_email as sdr_email,
      COALESCE(s.name, p.full_name, ds.owner_email) as sdr_name,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      d.contact_id,
      ds.total_r1_agendada,
      ds.distinct_r1_days,
      ds.no_show_count,
      ds.first_r1,
      ds.last_r1,
      ds.movement_history,
      ds.requalificacao_ciclos,
      CASE 
        WHEN ds.requalificacao_ciclos >= 2 THEN 'excesso_requalificacao'
        WHEN ds.has_tipo_a THEN 'tipo_a'
        WHEN ds.has_regressao THEN 'regressao'
        WHEN ds.distinct_r1_days >= 4 THEN 'ciclo_infinito'
        WHEN ds.no_show_count >= 2 AND ds.distinct_r1_days >= 2 THEN 'tipo_b'
        ELSE 'tipo_b'
      END as ghost_type,
      CASE 
        WHEN ds.requalificacao_ciclos >= 3 THEN 'critical'
        WHEN ds.requalificacao_ciclos >= 2 THEN 'high'
        WHEN ds.has_tipo_a THEN 'high'
        WHEN ds.has_regressao THEN 'high'
        WHEN ds.distinct_r1_days >= 4 THEN 'critical'
        WHEN ds.distinct_r1_days >= 3 THEN 'high'
        WHEN ds.distinct_r1_days >= 2 AND ds.no_show_count = 0 THEN 'high'
        ELSE 'medium'
      END as severity,
      CASE 
        WHEN ds.requalificacao_ciclos >= 2 THEN 'Excesso de requalificação: ' || ds.requalificacao_ciclos || ' ciclos R1 Agendada → Lead Qualificado → R1 Agendada SEM No-Show ou R1 Realizada'
        WHEN ds.has_tipo_a THEN 'R1 Agendada → Lead Qualificado → R1 Agendada no mesmo dia SEM No-Show intermediário'
        WHEN ds.has_regressao THEN 'Regressão estranha: R1 Realizada → Novo Lead'
        WHEN ds.distinct_r1_days >= 4 THEN 'Ciclo infinito: ' || ds.distinct_r1_days || ' dias distintos em R1 Agendada'
        WHEN ds.no_show_count >= 2 AND ds.distinct_r1_days >= 2 THEN 'Múltiplos No-Shows (' || ds.no_show_count || ') com reagendamentos em ' || ds.distinct_r1_days || ' dias distintos'
        ELSE ds.distinct_r1_days || ' movimentações para R1 Agendada em dias distintos sem progressão real'
      END as detection_reason
    FROM deal_summary ds
    LEFT JOIN crm_deals d ON d.id = ds.deal_id::uuid
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN sdr s ON LOWER(s.email) = LOWER(ds.owner_email)
    LEFT JOIN profiles p ON LOWER(p.email) = LOWER(ds.owner_email)
    WHERE ds.distinct_r1_days >= 2 OR ds.requalificacao_ciclos >= 2
  )
  
  SELECT COALESCE(json_agg(
    json_build_object(
      'deal_id', cc.deal_id,
      'contact_id', cc.contact_id,
      'contact_name', cc.contact_name,
      'contact_email', cc.contact_email,
      'contact_phone', cc.contact_phone,
      'sdr_email', cc.sdr_email,
      'sdr_name', cc.sdr_name,
      'ghost_type', cc.ghost_type,
      'severity', cc.severity,
      'total_r1_agendada', cc.total_r1_agendada,
      'distinct_days', cc.distinct_r1_days,
      'no_show_count', cc.no_show_count,
      'detection_reason', cc.detection_reason,
      'movement_history', cc.movement_history,
      'first_r1_date', cc.first_r1,
      'last_r1_date', cc.last_r1
    ) ORDER BY 
      CASE cc.severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        ELSE 4 
      END,
      cc.distinct_r1_days DESC
  ), '[]'::json) INTO result
  FROM classified_cases cc;
  
  RETURN result;
END;
$function$;