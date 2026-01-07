
-- Criar versão corrigida da RPC que não filtra from_stage restritivamente
CREATE OR REPLACE FUNCTION get_sdr_metrics_v3(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH r1_movements AS (
    -- Captura TODOS os movimentos para R1 Agendada, sem filtro restritivo de from_stage
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
    -- Classifica tipo mas NÃO filtra por from_stage
    SELECT 
      rm.deal_id,
      rm.created_at,
      rm.mov_date,
      rm.sdr_email,
      rm.from_stage,
      CASE 
        WHEN rm.from_stage ILIKE '%No-Show%' OR rm.from_stage ILIKE '%No Show%' OR rm.from_stage ILIKE '%NoShow%' THEN 'reagendamento'
        ELSE 'primeiro_agendamento'
      END as tipo_agendamento
    FROM r1_movements rm
    WHERE rm.sdr_email IS NOT NULL
  ),
  deduplicated AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      sdr_email,
      tipo_agendamento
    FROM filtered_movements
    ORDER BY deal_id, created_at ASC
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
      COUNT(*) FILTER (
        WHERE cs.current_stage IS NOT NULL 
        AND (
          cs.current_stage ILIKE '%Reunião 01 Realizada%'
          OR cs.current_stage ILIKE '%Reuniao 01 Realizada%'
          OR cs.current_stage ILIKE '%R1 Realizada%'
          OR cs.current_stage ILIKE '%Contrato%'
          OR cs.current_stage ILIKE '%Venda%'
          OR cs.current_stage ILIKE '%Ganho%'
        )
      ) as realizadas,
      COUNT(*) FILTER (
        WHERE cs.current_stage IS NOT NULL 
        AND (
          cs.current_stage ILIKE '%Contrato%'
          OR cs.current_stage ILIKE '%Venda%'
          OR cs.current_stage ILIKE '%Ganho%'
        )
      ) as contratos
    FROM deduplicated dd
    LEFT JOIN current_stages cs ON dd.deal_id = cs.deal_id
    WHERE (sdr_email_filter IS NULL OR LOWER(dd.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(dd.sdr_email)
  ),
  final_metrics AS (
    SELECT 
      sm.sdr_email,
      sm.primeiro_agendamento,
      sm.reagendamento,
      sm.total_agendamentos,
      COALESCE(ns.no_show_count, 0) as no_shows,
      sm.realizadas,
      sm.contratos,
      CASE 
        WHEN sm.total_agendamentos > 0 
        THEN ROUND((sm.contratos::numeric / sm.total_agendamentos::numeric) * 100, 2)
        ELSE 0 
      END as taxa_conversao,
      CASE 
        WHEN sm.total_agendamentos > 0 
        THEN ROUND((COALESCE(ns.no_show_count, 0)::numeric / sm.total_agendamentos::numeric) * 100, 2)
        ELSE 0 
      END as taxa_no_show
    FROM sdr_metrics sm
    LEFT JOIN noshow_by_sdr ns ON sm.sdr_email = ns.sdr_email
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((SELECT jsonb_agg(row_to_json(fm)) FROM final_metrics fm), '[]'::jsonb),
    'summary', (
      SELECT jsonb_build_object(
        'total_primeiro_agendamento', COALESCE(SUM(primeiro_agendamento), 0),
        'total_reagendamento', COALESCE(SUM(reagendamento), 0),
        'total_agendamentos', COALESCE(SUM(total_agendamentos), 0),
        'total_no_shows', COALESCE(SUM(no_shows), 0),
        'total_realizadas', COALESCE(SUM(realizadas), 0),
        'total_contratos', COALESCE(SUM(contratos), 0),
        'taxa_conversao_media', CASE 
          WHEN SUM(total_agendamentos) > 0 
          THEN ROUND((SUM(contratos)::numeric / SUM(total_agendamentos)::numeric) * 100, 2)
          ELSE 0 
        END,
        'taxa_no_show_media', CASE 
          WHEN SUM(total_agendamentos) > 0 
          THEN ROUND((SUM(no_shows)::numeric / SUM(total_agendamentos)::numeric) * 100, 2)
          ELSE 0 
        END
      )
      FROM final_metrics
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
