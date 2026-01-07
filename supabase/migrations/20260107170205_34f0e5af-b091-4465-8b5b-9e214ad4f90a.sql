-- Dropar função existente para recriar com correções
DROP FUNCTION IF EXISTS public.get_sdr_metrics_v3(date, date, text);

-- Recriar get_sdr_metrics_v3 para usar data do deal em atividades reprocessadas
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v3(
  start_date date,
  end_date date,
  sdr_email_filter text DEFAULT NULL
)
RETURNS TABLE (
  sdr_email text,
  novo_lead bigint,
  lq bigint,
  r1_agendada bigint,
  r1_realizada bigint,
  no_show bigint,
  ganho bigint,
  perdido bigint,
  total_agendamentos bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH r1_movements AS (
    -- Pegar movimentações para R1 Agendada com deduplicação por deal
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.created_at as activity_created_at,
      da.from_stage,
      da.to_stage,
      COALESCE(
        da.metadata->>'owner_email',
        da.metadata->>'deal_user',
        d.owner_id
      ) as owner_email,
      -- CORREÇÃO: Usar data do deal para atividades reprocessadas
      CASE 
        WHEN da.description LIKE 'Reprocessado:%' 
             OR (da.metadata->>'reprocessed')::boolean = true
        THEN (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      END as mov_date
    FROM deal_activities da
    LEFT JOIN crm_deals d ON da.deal_id = d.id::text
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND LOWER(COALESCE(da.to_stage, '')) LIKE '%reuni%01%agend%'
    ORDER BY da.deal_id, da.created_at ASC
  ),
  other_movements AS (
    -- Outras movimentações (não R1 Agendada)
    SELECT 
      da.deal_id,
      da.created_at as activity_created_at,
      da.from_stage,
      da.to_stage,
      COALESCE(
        da.metadata->>'owner_email',
        da.metadata->>'deal_user',
        d.owner_id
      ) as owner_email,
      -- CORREÇÃO: Usar data do deal para atividades reprocessadas
      CASE 
        WHEN da.description LIKE 'Reprocessado:%' 
             OR (da.metadata->>'reprocessed')::boolean = true
        THEN (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date
      END as mov_date
    FROM deal_activities da
    LEFT JOIN crm_deals d ON da.deal_id = d.id::text
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND NOT (LOWER(COALESCE(da.to_stage, '')) LIKE '%reuni%01%agend%')
  ),
  all_movements AS (
    SELECT * FROM r1_movements
    UNION ALL
    SELECT deal_id, activity_created_at, from_stage, to_stage, owner_email, mov_date FROM other_movements
  ),
  filtered_movements AS (
    SELECT *
    FROM all_movements
    WHERE mov_date BETWEEN start_date AND end_date
      AND owner_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR owner_email = sdr_email_filter)
  ),
  sdr_stats AS (
    SELECT 
      fm.owner_email as sdr,
      -- Novo Lead: entrada inicial no funil
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%novo%lead%' 
        THEN fm.deal_id 
      END) as novo_lead_count,
      -- LQ: Lead Qualificado
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%lq%' 
             OR LOWER(COALESCE(fm.to_stage, '')) LIKE '%lead%qualif%'
        THEN fm.deal_id 
      END) as lq_count,
      -- R1 Agendada (já deduplicado na CTE)
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%reuni%01%agend%' 
        THEN fm.deal_id 
      END) as r1_agendada_count,
      -- R1 Realizada
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%reuni%01%realiz%' 
        THEN fm.deal_id 
      END) as r1_realizada_count,
      -- No-Show
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%no%show%' 
             OR LOWER(COALESCE(fm.to_stage, '')) LIKE '%noshow%'
        THEN fm.deal_id 
      END) as no_show_count,
      -- Ganho
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%ganh%' 
             OR LOWER(COALESCE(fm.to_stage, '')) LIKE '%won%'
             OR LOWER(COALESCE(fm.to_stage, '')) LIKE '%fechad%'
        THEN fm.deal_id 
      END) as ganho_count,
      -- Perdido
      COUNT(DISTINCT CASE 
        WHEN LOWER(COALESCE(fm.to_stage, '')) LIKE '%perd%' 
             OR LOWER(COALESCE(fm.to_stage, '')) LIKE '%lost%'
        THEN fm.deal_id 
      END) as perdido_count
    FROM filtered_movements fm
    GROUP BY fm.owner_email
  )
  SELECT 
    s.sdr as sdr_email,
    s.novo_lead_count as novo_lead,
    s.lq_count as lq,
    s.r1_agendada_count as r1_agendada,
    s.r1_realizada_count as r1_realizada,
    s.no_show_count as no_show,
    s.ganho_count as ganho,
    s.perdido_count as perdido,
    s.r1_agendada_count as total_agendamentos
  FROM sdr_stats s
  ORDER BY s.r1_agendada_count DESC;
END;
$$;