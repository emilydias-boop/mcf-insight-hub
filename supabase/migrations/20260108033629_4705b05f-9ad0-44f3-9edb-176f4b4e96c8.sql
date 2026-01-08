-- Drop and recreate get_sdr_metrics_v2 to count contracts by closing date
DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(date, date, text);

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
  -- NOVO: Contar contratos pela data de movimentação para Contrato/Ganho
  contratos_fechados AS (
    SELECT DISTINCT
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%Contrato%Pago%'
        OR COALESCE(da.to_stage, '') ILIKE '%Ganho%'
        OR da.description ILIKE '%Contrato Pago%'
        OR da.description ILIKE '%Ganho%'
      )
  ),
  contratos_by_sdr AS (
    SELECT 
      LOWER(cf.sdr_email) as sdr_email,
      COUNT(DISTINCT cf.deal_id) as contrato_count
    FROM contratos_fechados cf
    WHERE cf.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(cf.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(cf.sdr_email)
  ),
  -- NOVO: Contar realizadas pela data de movimentação para Realizada
  realizadas_fechadas AS (
    SELECT DISTINCT
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email
    FROM deal_activities da
    WHERE da.activity_type IN ('stage_change', 'stage_changed')
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (
        COALESCE(da.to_stage, '') ILIKE '%Reunião 01 Realizada%'
        OR COALESCE(da.to_stage, '') ILIKE '%Reuniao 01 Realizada%'
        OR COALESCE(da.to_stage, '') ILIKE '%R1 Realizada%'
        OR da.description ILIKE '%Reunião 01 Realizada%'
        OR da.description ILIKE '%Reuniao 01 Realizada%'
        OR da.description ILIKE '%R1 Realizada%'
      )
  ),
  realizadas_by_sdr AS (
    SELECT 
      LOWER(rf.sdr_email) as sdr_email,
      COUNT(DISTINCT rf.deal_id) as realizada_count
    FROM realizadas_fechadas rf
    WHERE rf.sdr_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(rf.sdr_email) = LOWER(sdr_email_filter))
    GROUP BY LOWER(rf.sdr_email)
  ),
  sdr_metrics AS (
    SELECT 
      LOWER(dd.sdr_email) as sdr_email,
      COUNT(*) FILTER (WHERE dd.tipo_agendamento = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE dd.tipo_agendamento = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      COALESCE(MAX(nbs.no_show_count), 0) as no_shows,
      COALESCE(MAX(rbs.realizada_count), 0) as realizadas,
      COALESCE(MAX(cbs.contrato_count), 0) as contratos
    FROM deduplicated dd
    LEFT JOIN noshow_by_sdr nbs ON LOWER(dd.sdr_email) = nbs.sdr_email
    LEFT JOIN realizadas_by_sdr rbs ON LOWER(dd.sdr_email) = rbs.sdr_email
    LEFT JOIN contratos_by_sdr cbs ON LOWER(dd.sdr_email) = cbs.sdr_email
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
      'total_realizadas', COALESCE((SELECT SUM(realizada_count) FROM realizadas_by_sdr), 0),
      'total_contratos', COALESCE((SELECT SUM(contrato_count) FROM contratos_by_sdr), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$function$;