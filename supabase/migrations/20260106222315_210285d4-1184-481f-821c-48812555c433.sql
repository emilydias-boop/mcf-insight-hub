-- Backfill to_stage e from_stage nas activities que têm a info na description
UPDATE deal_activities
SET 
  from_stage = COALESCE(from_stage, 
    CASE 
      WHEN description LIKE '%→%' THEN TRIM(split_part(regexp_replace(description, '^[^:]*: ', ''), ' → ', 1))
      WHEN description LIKE '%movido de%' THEN TRIM(split_part(split_part(description, 'movido de ', 2), ' para ', 1))
    END
  ),
  to_stage = COALESCE(to_stage,
    CASE 
      WHEN description LIKE '%→%' THEN TRIM(split_part(regexp_replace(description, '^[^:]*: ', ''), ' → ', 2))
      WHEN description LIKE '%movido de%' THEN TRIM(split_part(description, ' para ', 2))
    END
  )
WHERE (to_stage IS NULL OR from_stage IS NULL)
  AND activity_type IN ('stage_change', 'stage_changed')
  AND (description LIKE '%→%' OR description LIKE '%movido de%');

-- Atualizar RPC get_sdr_all_movements_v2 para aceitar ambos activity_types
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
      ) as to_stg,
      ROW_NUMBER() OVER (
        PARTITION BY da.deal_id, (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date 
        ORDER BY da.created_at ASC
      ) as rn_dia
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
      )
  ),
  movement_counts AS (
    SELECT 
      fm.mov_deal_id as cnt_deal_id,
      COUNT(*) as total_movs
    FROM filtered_movements fm
    GROUP BY fm.mov_deal_id
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
    fm.mov_deal_id::TEXT,
    d.name::TEXT,
    c.name::TEXT,
    c.email::TEXT,
    c.phone::TEXT,
    fm.tipo_mov::TEXT,
    fm.created_at,
    COALESCE(cs.current_stage, 'Desconhecido')::TEXT,
    fm.sdr_email::TEXT,
    d.owner_id::TEXT,
    NULL::TEXT,
    o.name::TEXT,
    d.probability::INTEGER,
    (fm.rn_dia = 1)::BOOLEAN as conta_mov,
    COALESCE(mc.total_movs, 1)::INTEGER,
    fm.from_stg::TEXT
  FROM filtered_movements fm
  LEFT JOIN crm_deals d ON fm.mov_deal_id::uuid = d.id
  LEFT JOIN crm_contacts c ON d.contact_id = c.id
  LEFT JOIN crm_origins o ON d.origin_id = o.id
  LEFT JOIN current_stages cs ON fm.mov_deal_id = cs.cs_deal_id
  LEFT JOIN movement_counts mc ON fm.mov_deal_id = mc.cnt_deal_id
  WHERE fm.sdr_email IS NOT NULL
    AND (sdr_email_filter IS NULL OR LOWER(fm.sdr_email) = LOWER(sdr_email_filter))
  ORDER BY fm.created_at DESC;
END;
$function$;

-- Atualizar RPC get_sdr_metrics_v2 para aceitar ambos activity_types
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
      ) as to_stage,
      ROW_NUMBER() OVER (
        PARTITION BY da.deal_id, (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date 
        ORDER BY da.created_at ASC
      ) as rn_dia
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
  ),
  filtered_movements AS (
    SELECT 
      rm.*,
      CASE 
        WHEN rm.from_stage ILIKE '%No-Show%' OR rm.from_stage ILIKE '%No Show%' OR rm.from_stage ILIKE '%NoShow%' THEN 'reagendamento'
        ELSE 'primeiro_agendamento'
      END as tipo_agendamento
    FROM r1_movements rm
    WHERE (
        rm.to_stage ILIKE '%Reunião 01 Agendada%'
        OR rm.to_stage ILIKE '%Reuniao 01 Agendada%'
        OR rm.to_stage ILIKE '%R1 Agendada%'
      )
      AND (
        rm.from_stage ILIKE '%Lead Qualificado%'
        OR rm.from_stage ILIKE '%LQ%'
        OR rm.from_stage ILIKE '%No-Show%'
        OR rm.from_stage ILIKE '%No Show%'
        OR rm.from_stage ILIKE '%NoShow%'
        OR rm.from_stage ILIKE '%Novo Lead%'
      )
  ),
  deduplicated AS (
    SELECT * FROM filtered_movements WHERE rn_dia = 1
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
      LOWER(rm.sdr_email) as sdr_email,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%No-Show%' OR cs.current_stage ILIKE '%No Show%') as no_shows,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Realizada%' OR cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as realizadas,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as contratos
    FROM deduplicated rm
    LEFT JOIN current_stages cs ON rm.deal_id = cs.deal_id
    WHERE rm.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(rm.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(rm.sdr_email)
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
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM sdr_metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM sdr_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM sdr_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;