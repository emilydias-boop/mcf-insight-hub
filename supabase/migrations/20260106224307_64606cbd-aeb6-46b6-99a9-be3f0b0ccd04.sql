
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
      LOWER(rm.sdr_email) as sdr_email,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE rm.tipo_agendamento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COALESCE(MAX(nbs.no_show_count), 0) as no_shows,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Realizada%' OR cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as realizadas,
      COUNT(*) FILTER (WHERE cs.current_stage ILIKE '%Contrato%' OR cs.current_stage ILIKE '%Ganho%') as contratos
    FROM deduplicated rm
    LEFT JOIN noshow_by_sdr nbs ON LOWER(rm.sdr_email) = nbs.sdr_email
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
      'total_no_shows', COALESCE((SELECT SUM(no_show_count) FROM noshow_by_sdr), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM sdr_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM sdr_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;
