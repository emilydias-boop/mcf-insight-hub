-- Substituir get_sdr_metrics_v2 por versão otimizada (single scan)
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
  -- Single scan: classificar cada evento relevante
  classified_events AS (
    SELECT 
      da.deal_id,
      da.created_at,
      COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user') as sdr_email,
      lower(coalesce(da.to_stage, '')) as to_stage_lower,
      lower(coalesce(da.from_stage, '')) as from_stage_lower,
      -- Classificações booleanas
      (lower(coalesce(da.to_stage, '')) LIKE '%reuni%01%agend%') as is_r1_agendada,
      (lower(coalesce(da.to_stage, '')) LIKE '%no%show%') as is_no_show,
      (lower(coalesce(da.from_stage, '')) LIKE '%no%show%') as from_no_show
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.created_at >= start_date::timestamp
      AND da.created_at < (end_date + interval '1 day')::timestamp
      AND (
        lower(coalesce(da.to_stage, '')) LIKE '%reuni%01%agend%'
        OR lower(coalesce(da.to_stage, '')) LIKE '%no%show%'
      )
      AND (sdr_email_filter IS NULL 
           OR lower(COALESCE(da.metadata->>'owner_email', da.metadata->>'deal_user', '')) = lower(sdr_email_filter))
  ),
  -- Primeiro agendamento por deal (vindo de LQ/Novo Lead, não de No-Show)
  primeiro_agendamento AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      sdr_email
    FROM classified_events
    WHERE is_r1_agendada = TRUE
      AND from_no_show = FALSE
    ORDER BY deal_id, created_at ASC
  ),
  -- Reagendamento por deal (vindo de No-Show)
  reagendamento AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      sdr_email
    FROM classified_events
    WHERE is_r1_agendada = TRUE
      AND from_no_show = TRUE
    ORDER BY deal_id, created_at ASC
  ),
  -- No-Shows por deal
  no_shows AS (
    SELECT DISTINCT ON (deal_id)
      deal_id,
      sdr_email
    FROM classified_events
    WHERE is_no_show = TRUE
    ORDER BY deal_id, created_at ASC
  ),
  -- Todos os deals agendados no período
  all_scheduled_deals AS (
    SELECT deal_id, sdr_email FROM primeiro_agendamento
    UNION
    SELECT deal_id, sdr_email FROM reagendamento
  ),
  -- Status atual (single query para todos os deals)
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
  -- Métricas finais
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