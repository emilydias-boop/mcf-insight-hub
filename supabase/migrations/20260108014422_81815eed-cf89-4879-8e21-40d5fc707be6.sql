
-- Corrigir get_sdr_metrics_v2 para contar reagendamentos corretamente
-- Bug: DISTINCT ON (deal_id) conta apenas 1 movimento por deal, ignorando reagendamentos
-- Fix: DISTINCT ON (deal_id, from_stage, to_stage, DATE_TRUNC('minute', created_at))
--      Remove duplicatas de webhook mas permite múltiplos agendamentos legítimos

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSONB;
BEGIN
  WITH r1_movements AS (
    SELECT 
      da.deal_id,
      da.created_at,
      (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date as mov_date,
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
      ) as to_stage
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
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
    SELECT 
      rm.deal_id,
      rm.created_at,
      rm.mov_date,
      rm.sdr_email,
      rm.from_stage,
      rm.to_stage,
      CASE 
        WHEN rm.from_stage ILIKE '%No-Show%' OR rm.from_stage ILIKE '%No Show%' OR rm.from_stage ILIKE '%NoShow%' THEN 'reagendamento'
        ELSE 'primeiro_agendamento'
      END as tipo_agendamento
    FROM r1_movements rm
    WHERE (
      rm.from_stage ILIKE '%Lead Qualificado%'
      OR rm.from_stage ILIKE '%LQ%'
      OR rm.from_stage ILIKE '%No-Show%'
      OR rm.from_stage ILIKE '%No Show%'
      OR rm.from_stage ILIKE '%NoShow%'
      OR rm.from_stage ILIKE '%Novo Lead%'
      OR rm.from_stage ILIKE '%Sem Interesse%'
    )
  ),
  -- CORREÇÃO: Deduplicar por (deal_id, from_stage, to_stage, minuto)
  -- Isso remove duplicatas de webhook (mesmo evento em milissegundos)
  -- Mas permite contar múltiplos agendamentos legítimos do mesmo deal
  deduplicated AS (
    SELECT DISTINCT ON (deal_id, from_stage, to_stage, DATE_TRUNC('minute', created_at))
      deal_id,
      sdr_email,
      tipo_agendamento,
      created_at
    FROM filtered_movements
    ORDER BY deal_id, from_stage, to_stage, DATE_TRUNC('minute', created_at), created_at ASC
  ),
  noshow_movements AS (
    SELECT DISTINCT
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%No-Show%'
        OR COALESCE(da.to_stage, '') ILIKE '%No Show%'
        OR COALESCE(da.to_stage, '') ILIKE '%NoShow%'
        OR da.description ILIKE '%No-Show%'
        OR da.description ILIKE '%No Show%'
      )
  ),
  noshow_by_sdr AS (
    SELECT 
      LOWER(nm.sdr_email) as sdr_email,
      COUNT(DISTINCT nm.deal_id) as no_show_count
    FROM noshow_movements nm
    WHERE nm.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(nm.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(nm.sdr_email)
  ),
  current_stages AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      COALESCE(to_stage,
        CASE 
          WHEN description LIKE '%→%' THEN TRIM(split_part(regexp_replace(description, '^[^:]*: ', ''), ' → ', 2))
          WHEN description LIKE '%movido de%' THEN TRIM(split_part(description, ' para ', 2))
        END
      ) as current_stage
    FROM deal_activities
    WHERE activity_type IN ('stage_change', 'stage_changed')
    ORDER BY deal_id, created_at DESC
  ),
  sdr_metrics AS (
    SELECT 
      LOWER(dd.sdr_email) as sdr_email,
      COUNT(*) FILTER (WHERE dd.tipo_agendamento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE dd.tipo_agendamento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COALESCE(MAX(nbs.no_show_count), 0) as no_shows,
      COUNT(DISTINCT dd.deal_id) FILTER (WHERE cs.current_stage ILIKE '%Realizada%' OR cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as realizadas,
      COUNT(DISTINCT dd.deal_id) FILTER (WHERE cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as contratos
    FROM deduplicated dd
    LEFT JOIN noshow_by_sdr nbs ON LOWER(dd.sdr_email) = nbs.sdr_email
    LEFT JOIN current_stages cs ON dd.deal_id = cs.deal_id
    WHERE dd.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(dd.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(dd.sdr_email)
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', sm.sdr_email,
          'sdr_name', COALESCE(sm.sdr_email, 'Desconhecido'),
          'primeiro_agendamento', sm.primeiro_agendamento,
          'reagendamento', sm.reagendamento,
          'total_agendamentos', sm.total_agendamentos,
          'no_shows', sm.no_shows,
          'realizadas', sm.realizadas,
          'contratos', sm.contratos,
          'taxa_conversao', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.contratos::numeric / sm.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END,
          'taxa_no_show', CASE WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.no_shows::numeric / sm.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END
        )
      )
      FROM sdr_metrics sm
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM sdr_metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM sdr_metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM sdr_metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_show_count) FROM noshow_by_sdr), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM sdr_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM sdr_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;


-- Corrigir get_sdr_all_movements_v2 para retornar todos os movimentos válidos
CREATE OR REPLACE FUNCTION public.get_sdr_all_movements_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS TABLE(deal_id text, deal_name text, contact_name text, contact_email text, contact_phone text, tipo text, data_agendamento timestamp with time zone, status_atual text, intermediador text, current_owner text, closer text, origin_name text, probability integer, conta boolean, total_movimentacoes integer, from_stage text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH r1_movements AS (
    SELECT 
      da.deal_id as mov_deal_id,
      da.created_at,
      (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date as mov_date,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email,
      COALESCE(da.from_stage, 
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 1))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(split_part(da.description, 'movido de ', 2), ' para ', 1))
        END
      ) as from_stg,
      COALESCE(da.to_stage,
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 2))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(da.description, ' para ', 2))
        END
      ) as to_stg
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
  ),
  filtered_movements AS (
    SELECT 
      rm.*,
      CASE 
        WHEN rm.from_stg ILIKE '%No-Show%' OR rm.from_stg ILIKE '%No Show%' OR rm.from_stg ILIKE '%NoShow%' THEN 'Reagendamento Válido'
        ELSE '1º Agendamento'
      END as tipo_mov
    FROM r1_movements rm
    WHERE (
        rm.to_stg ILIKE '%Reunião 01 Agendada%'
        OR rm.to_stg ILIKE '%Reuniao 01 Agendada%'
        OR rm.to_stg ILIKE '%R1 Agendada%'
      )
      AND (
        rm.from_stg ILIKE '%Lead Qualificado%'
        OR rm.from_stg ILIKE '%LQ%'
        OR rm.from_stg ILIKE '%No-Show%'
        OR rm.from_stg ILIKE '%No Show%'
        OR rm.from_stg ILIKE '%NoShow%'
        OR rm.from_stg ILIKE '%Novo Lead%'
        OR rm.from_stg ILIKE '%Sem Interesse%'
      )
  ),
  -- CORREÇÃO: Deduplicar por (deal_id, from_stage, to_stage, minuto)
  deduplicated_movements AS (
    SELECT DISTINCT ON (mov_deal_id, from_stg, to_stg, DATE_TRUNC('minute', created_at))
      mov_deal_id,
      created_at,
      mov_date,
      sdr_email,
      from_stg,
      to_stg,
      tipo_mov,
      ROW_NUMBER() OVER (
        PARTITION BY mov_deal_id 
        ORDER BY created_at ASC
      ) as rn_deal
    FROM filtered_movements
    ORDER BY mov_deal_id, from_stg, to_stg, DATE_TRUNC('minute', created_at), created_at ASC
  ),
  movement_counts AS (
    SELECT 
      dm.mov_deal_id as cnt_deal_id,
      COUNT(*) as total_movs
    FROM deduplicated_movements dm
    GROUP BY dm.mov_deal_id
  ),
  current_stages AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id as cs_deal_id,
      COALESCE(da.to_stage,
        CASE 
          WHEN da.description LIKE '%→%' THEN TRIM(split_part(regexp_replace(da.description, '^[^:]*: ', ''), ' → ', 2))
          WHEN da.description LIKE '%movido de%' THEN TRIM(split_part(da.description, ' para ', 2))
        END
      ) as current_stage
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
    ORDER BY da.deal_id, da.created_at DESC
  )
  SELECT 
    dm.mov_deal_id::TEXT,
    d.name::TEXT,
    c.name::TEXT,
    c.email::TEXT,
    c.phone::TEXT,
    dm.tipo_mov::TEXT,
    dm.created_at,
    COALESCE(cs.current_stage, 'Desconhecido')::TEXT,
    dm.sdr_email::TEXT,
    d.owner_id::TEXT,
    NULL::TEXT,
    o.name::TEXT,
    d.probability::INTEGER,
    (dm.rn_deal = 1)::BOOLEAN as conta_mov,
    COALESCE(mc.total_movs, 1)::INTEGER,
    dm.from_stg::TEXT
  FROM deduplicated_movements dm
  LEFT JOIN crm_deals d ON dm.mov_deal_id::uuid = d.id
  LEFT JOIN crm_contacts c ON d.contact_id = c.id
  LEFT JOIN crm_origins o ON d.origin_id = o.id
  LEFT JOIN current_stages cs ON dm.mov_deal_id = cs.cs_deal_id
  LEFT JOIN movement_counts mc ON dm.mov_deal_id = mc.cnt_deal_id
  WHERE dm.sdr_email IS NOT NULL
    AND (sdr_email_filter IS NULL OR LOWER(dm.sdr_email) = LOWER(sdr_email_filter))
  ORDER BY dm.created_at DESC;
END;
$function$;
