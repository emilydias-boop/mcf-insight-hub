-- Fix type mismatch in get_sdr_metrics_v2: convert crm_deals.id to TEXT
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH primeiro_agendamento AS (
    SELECT 
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND (da.from_stage ILIKE '%Lead Qualificado%' OR da.from_stage ILIKE '%Novo Lead%' OR da.from_stage IS NULL)
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  deals_with_previous_reuniao AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND da.created_at::date < start_date
  ),
  reagendamento AS (
    SELECT 
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%Reunião 01 Agendada%'
      AND da.from_stage ILIKE '%No-Show%'
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  no_shows AS (
    SELECT DISTINCT ON (da.deal_id, da.metadata->>'owner_email')
      da.metadata->>'owner_email' as sdr_email,
      da.deal_id
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage ILIKE '%No-Show%'
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.metadata->>'owner_email' IS NOT NULL
      AND (sdr_email_filter IS NULL OR da.metadata->>'owner_email' = sdr_email_filter)
  ),
  current_stages AS (
    SELECT 
      d.id::TEXT as deal_id,
      s.stage_name as current_stage
    FROM crm_deals d
    LEFT JOIN crm_stages s ON d.stage_id = s.id
  ),
  realizadas AS (
    SELECT 
      pa.sdr_email,
      pa.deal_id
    FROM primeiro_agendamento pa
    JOIN current_stages cs ON pa.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Realizada%' 
       OR cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
    UNION
    SELECT 
      ra.sdr_email,
      ra.deal_id
    FROM reagendamento ra
    JOIN current_stages cs ON ra.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Realizada%' 
       OR cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
  ),
  contratos AS (
    SELECT 
      pa.sdr_email,
      pa.deal_id
    FROM primeiro_agendamento pa
    JOIN current_stages cs ON pa.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
    UNION
    SELECT 
      ra.sdr_email,
      ra.deal_id
    FROM reagendamento ra
    JOIN current_stages cs ON ra.deal_id = cs.deal_id
    WHERE cs.current_stage ILIKE '%Contrato%' 
       OR cs.current_stage ILIKE '%Ganho%'
  ),
  all_sdrs AS (
    SELECT DISTINCT sdr_email FROM primeiro_agendamento
    UNION
    SELECT DISTINCT sdr_email FROM reagendamento
    UNION
    SELECT DISTINCT sdr_email FROM no_shows
  ),
  metrics AS (
    SELECT 
      s.sdr_email,
      COALESCE(s.sdr_email, 'Desconhecido') as sdr_name,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM primeiro_agendamento WHERE sdr_email = s.sdr_email), 0) as primeiro_agendamento,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM reagendamento WHERE sdr_email = s.sdr_email), 0) as reagendamento,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM primeiro_agendamento WHERE sdr_email = s.sdr_email), 0) +
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM reagendamento WHERE sdr_email = s.sdr_email), 0) as total_agendamentos,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM no_shows WHERE sdr_email = s.sdr_email), 0) as no_shows,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM realizadas WHERE sdr_email = s.sdr_email), 0) as realizadas,
      COALESCE((SELECT COUNT(DISTINCT deal_id) FROM contratos WHERE sdr_email = s.sdr_email), 0) as contratos
    FROM all_sdrs s
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', m.sdr_email,
          'sdr_name', m.sdr_name,
          'primeiro_agendamento', m.primeiro_agendamento,
          'reagendamento', m.reagendamento,
          'total_agendamentos', m.total_agendamentos,
          'no_shows', m.no_shows,
          'realizadas', m.realizadas,
          'contratos', m.contratos,
          'taxa_conversao', CASE WHEN m.total_agendamentos > 0 
            THEN ROUND((m.contratos::numeric / m.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END,
          'taxa_no_show', CASE WHEN m.total_agendamentos > 0 
            THEN ROUND((m.no_shows::numeric / m.total_agendamentos * 100)::numeric, 1) 
            ELSE 0 END
        )
      )
      FROM metrics m
      WHERE m.total_agendamentos > 0 OR m.no_shows > 0
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM metrics), 0)
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- Fix type mismatch in get_sdr_all_movements_v2: convert crm_deals.id to TEXT in JOIN
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
  LEFT JOIN crm_deals d ON dm.mov_deal_id = d.id::TEXT
  LEFT JOIN crm_contacts c ON d.contact_id = c.id
  LEFT JOIN crm_origins o ON d.origin_id = o.id
  LEFT JOIN current_stages cs ON dm.mov_deal_id = cs.cs_deal_id
  LEFT JOIN movement_counts mc ON dm.mov_deal_id = mc.cnt_deal_id
  WHERE dm.sdr_email IS NOT NULL
    AND (sdr_email_filter IS NULL OR LOWER(dm.sdr_email) = LOWER(sdr_email_filter))
  ORDER BY dm.created_at DESC;
END;
$function$;