
CREATE OR REPLACE FUNCTION public.get_tv_funnel_metrics(target_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH r1_movements AS (
    SELECT 
      da.deal_id,
      da.created_at,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email,
      COALESCE(da.from_stage, 
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 1))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(split_part(da.description, 'movido de ', 2), ' para ', 1))
        END
      ) as from_stage,
      COALESCE(da.to_stage,
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 2))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(da.description, ' para ', 2))
        END
      ) as to_stage,
      ROW_NUMBER() OVER (PARTITION BY da.deal_id ORDER BY da.created_at ASC) as rn
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date = target_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%Reunião 01 Agendada%'
        OR COALESCE(da.to_stage, '') ILIKE '%Reuniao 01 Agendada%'
        OR COALESCE(da.to_stage, '') ILIKE '%R1 Agendada%'
        OR da.description ILIKE '%Reunião 01 Agendada%'
        OR da.description ILIKE '%Reuniao 01 Agendada%'
        OR da.description ILIKE '%R1 Agendada%'
      )
  ),
  filtered_movements AS (
    SELECT rm.*
    FROM r1_movements rm
    WHERE rm.rn = 1
      AND (
        rm.from_stage ILIKE '%Lead Qualificado%'
        OR rm.from_stage ILIKE '%LQ%'
        OR rm.from_stage ILIKE '%No-Show%'
        OR rm.from_stage ILIKE '%No Show%'
        OR rm.from_stage ILIKE '%NoShow%'
        OR rm.from_stage ILIKE '%Novo Lead%'
      )
  ),
  noshow_movements AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date = target_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%No-Show%'
        OR COALESCE(da.to_stage, '') ILIKE '%No Show%'
        OR COALESCE(da.to_stage, '') ILIKE '%NoShow%'
        OR da.description ILIKE '%No-Show%'
        OR da.description ILIKE '%No Show%'
      )
  ),
  r1_realizada_movements AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date = target_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%Reunião 01 Realizada%'
        OR COALESCE(da.to_stage, '') ILIKE '%Reuniao 01 Realizada%'
        OR COALESCE(da.to_stage, '') ILIKE '%R1 Realizada%'
        OR da.description ILIKE '%Reunião 01 Realizada%'
        OR da.description ILIKE '%Reuniao 01 Realizada%'
        OR da.description ILIKE '%R1 Realizada%'
      )
  ),
  funnel_metrics AS (
    SELECT 
      'Reunião 01 Agendada' as stage_name,
      'A' as lead_type,
      COUNT(DISTINCT fm.deal_id) as unique_leads
    FROM filtered_movements fm
    
    UNION ALL
    
    SELECT 
      'No-Show' as stage_name,
      'A' as lead_type,
      COUNT(DISTINCT deal_id) as unique_leads
    FROM noshow_movements
    
    UNION ALL
    
    SELECT 
      'Reunião 01 Realizada' as stage_name,
      'A' as lead_type,
      COUNT(DISTINCT deal_id) as unique_leads
    FROM r1_realizada_movements
  )
  SELECT COALESCE(json_agg(funnel_metrics), '[]'::json) INTO result FROM funnel_metrics;
  
  RETURN result;
END;
$function$;
