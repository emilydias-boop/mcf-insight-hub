
-- Substituir get_sdr_metrics_v2 por versão otimizada (sem subqueries repetidas, usando índices)
DROP FUNCTION IF EXISTS public.get_sdr_metrics_v2(date, date, text);

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
  -- Todas as movimentações para R1 Agendada no período (primeiro agendamento por deal)
  primeiro_agendamento AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND LOWER(COALESCE(da.to_stage, '')) LIKE '%reuni%01%agend%'
      AND (LOWER(COALESCE(da.from_stage, '')) LIKE '%lead qualificado%' 
           OR LOWER(COALESCE(da.from_stage, '')) LIKE '%novo lead%'
           OR da.from_stage IS NULL)
      AND (sdr_email_filter IS NULL 
           OR LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at ASC
  ),
  -- Reagendamentos (vindo de No-Show)
  reagendamento AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email,
      da.created_at
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND LOWER(COALESCE(da.to_stage, '')) LIKE '%reuni%01%agend%'
      AND LOWER(COALESCE(da.from_stage, '')) LIKE '%no%show%'
      AND (sdr_email_filter IS NULL 
           OR LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at ASC
  ),
  -- No-Shows no período
  no_shows AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND LOWER(COALESCE(da.to_stage, '')) LIKE '%no%show%'
      AND (sdr_email_filter IS NULL 
           OR LOWER(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at ASC
  ),
  -- Todos os deals agendados no período (para checar status atual)
  all_scheduled_deals AS (
    SELECT deal_id, sdr_email FROM primeiro_agendamento
    UNION
    SELECT deal_id, sdr_email FROM reagendamento
  ),
  -- Status atual de cada deal (join único com crm_deals + crm_stages)
  deal_current_status AS (
    SELECT 
      asd.deal_id,
      asd.sdr_email,
      COALESCE(s.stage_name, '') as current_stage
    FROM all_scheduled_deals asd
    LEFT JOIN crm_deals d ON asd.deal_id = d.id::TEXT
    LEFT JOIN crm_stages s ON d.stage_id = s.id
  ),
  -- Agregação por SDR
  sdr_aggregates AS (
    SELECT 
      sdr_email,
      COUNT(DISTINCT pa.deal_id) as primeiro_agendamento,
      COUNT(DISTINCT ra.deal_id) as reagendamento,
      COUNT(DISTINCT ns.deal_id) as no_shows,
      COUNT(DISTINCT CASE 
        WHEN dcs.current_stage ILIKE '%realizada%' 
          OR dcs.current_stage ILIKE '%contrato%' 
          OR dcs.current_stage ILIKE '%ganho%'
        THEN dcs.deal_id 
      END) as realizadas,
      COUNT(DISTINCT CASE 
        WHEN dcs.current_stage ILIKE '%contrato%' 
          OR dcs.current_stage ILIKE '%ganho%'
        THEN dcs.deal_id 
      END) as contratos
    FROM (
      SELECT DISTINCT sdr_email FROM primeiro_agendamento
      UNION
      SELECT DISTINCT sdr_email FROM reagendamento
      UNION
      SELECT DISTINCT sdr_email FROM no_shows
    ) all_sdrs
    LEFT JOIN primeiro_agendamento pa USING (sdr_email)
    LEFT JOIN reagendamento ra USING (sdr_email)
    LEFT JOIN no_shows ns USING (sdr_email)
    LEFT JOIN deal_current_status dcs USING (sdr_email)
    WHERE sdr_email IS NOT NULL
    GROUP BY sdr_email
  ),
  -- Métricas finais por SDR
  metrics AS (
    SELECT 
      sa.sdr_email,
      COALESCE(sa.sdr_email, 'Desconhecido') as sdr_name,
      COALESCE(sa.primeiro_agendamento, 0) as primeiro_agendamento,
      COALESCE(sa.reagendamento, 0) as reagendamento,
      COALESCE(sa.primeiro_agendamento, 0) + COALESCE(sa.reagendamento, 0) as total_agendamentos,
      COALESCE(sa.no_shows, 0) as no_shows,
      COALESCE(sa.realizadas, 0) as realizadas,
      COALESCE(sa.contratos, 0) as contratos
    FROM sdr_aggregates sa
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
