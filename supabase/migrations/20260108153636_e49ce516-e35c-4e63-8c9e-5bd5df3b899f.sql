-- Migração 2: Reescrever get_sdr_metrics_v2 com otimização usando a view materializada
-- Esta versão usa a view materializada deal_current_stages para performance

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_v2(start_date date, end_date date, sdr_email_filter text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH 
  -- Classificar eventos de agendamento R1
  classified AS (
    SELECT 
      da.deal_id,
      da.created_at,
      LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) as sdr_email,
      LOWER(COALESCE(da.from_stage, '')) as from_stage_lower,
      -- Classificar tipo de agendamento
      CASE 
        WHEN LOWER(COALESCE(da.from_stage, '')) ~ 'no.?show' THEN 'reagendamento'
        WHEN LOWER(COALESCE(da.from_stage, '')) ~ '(lead.?qualificado|lq|novo.?lead|sem.?interesse)' THEN 'primeiro_agendamento'
        ELSE 'invalido'
      END as tipo
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND LOWER(COALESCE(da.to_stage, '')) ~ 'reuni.*01.*agend'
  ),
  
  -- Deduplicar: um agendamento por (deal, tipo, minuto)
  dedup AS (
    SELECT DISTINCT ON (c.deal_id, c.tipo, DATE_TRUNC('minute', c.created_at))
      c.deal_id,
      c.sdr_email,
      c.tipo,
      c.created_at
    FROM classified c
    WHERE c.tipo != 'invalido'
      AND c.sdr_email != ''
      AND (sdr_email_filter IS NULL OR c.sdr_email = LOWER(sdr_email_filter))
    ORDER BY c.deal_id, c.tipo, DATE_TRUNC('minute', c.created_at), c.created_at
  ),
  
  -- No-Shows no período
  noshows AS (
    SELECT DISTINCT
      da.deal_id,
      LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) as sdr_email
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND LOWER(COALESCE(da.to_stage, '')) ~ 'no.?show'
      AND (sdr_email_filter IS NULL 
           OR LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) = LOWER(sdr_email_filter))
  ),
  
  -- Agregação por SDR
  metrics AS (
    SELECT 
      d.sdr_email,
      d.sdr_email as sdr_name,
      COUNT(*) FILTER (WHERE d.tipo = 'primeiro_agendamento') as primeiro_agendamento,
      COUNT(*) FILTER (WHERE d.tipo = 'reagendamento') as reagendamento,
      COUNT(*) as total_agendamentos,
      -- No-shows: contar deals distintos com no-show para este SDR
      COALESCE((
        SELECT COUNT(DISTINCT ns.deal_id) 
        FROM noshows ns 
        WHERE ns.sdr_email = d.sdr_email
      ), 0) as no_shows,
      -- Realizadas: deals agendados por este SDR que estão em estágio de realizada/contrato
      COUNT(DISTINCT d.deal_id) FILTER (
        WHERE dcs.current_stage_lower ~ '(realizada|contrato|ganho)'
      ) as realizadas,
      -- Contratos: deals agendados por este SDR que estão em estágio de contrato/ganho
      COUNT(DISTINCT d.deal_id) FILTER (
        WHERE dcs.current_stage_lower ~ '(contrato|ganho)'
      ) as contratos
    FROM dedup d
    LEFT JOIN deal_current_stages dcs ON d.deal_id = dcs.deal_id
    GROUP BY d.sdr_email
  ),
  
  -- Calcular totais
  summary AS (
    SELECT 
      COALESCE(SUM(m.primeiro_agendamento), 0) as total_primeiro_agendamento,
      COALESCE(SUM(m.reagendamento), 0) as total_reagendamento,
      COALESCE(SUM(m.total_agendamentos), 0) as total_agendamentos,
      COALESCE(SUM(m.no_shows), 0) as total_no_shows,
      COALESCE(SUM(m.realizadas), 0) as total_realizadas,
      COALESCE(SUM(m.contratos), 0) as total_contratos
    FROM metrics m
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
        ORDER BY m.total_agendamentos DESC
      )
      FROM metrics m
      WHERE m.total_agendamentos > 0
    ), '[]'::jsonb),
    'summary', (SELECT jsonb_build_object(
      'total_primeiro_agendamento', s.total_primeiro_agendamento,
      'total_reagendamento', s.total_reagendamento,
      'total_agendamentos', s.total_agendamentos,
      'total_no_shows', s.total_no_shows,
      'total_realizadas', s.total_realizadas,
      'total_contratos', s.total_contratos
    ) FROM summary s)
  ) INTO result;
  
  RETURN result;
END;
$function$;