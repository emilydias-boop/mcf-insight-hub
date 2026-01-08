-- Drop and recreate get_sdr_metrics_v2 with Hubla-based contract counting
DROP FUNCTION IF EXISTS get_sdr_metrics_v2(date, date, text);

CREATE OR REPLACE FUNCTION get_sdr_metrics_v2(
  start_date date,
  end_date date,
  sdr_email_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH deal_data AS (
    SELECT 
      d.id as deal_id,
      d.clint_id,
      d.name as deal_name,
      d.owner_id as sdr_email,
      d.contact_id,
      c.name as contact_name,
      c.phone as contact_phone,
      c.email as contact_email,
      o.name as origin_name,
      o.id as origin_id
    FROM crm_deals d
    LEFT JOIN crm_contacts c ON d.contact_id = c.id
    LEFT JOIN crm_origins o ON d.origin_id = o.id
    WHERE d.owner_id IS NOT NULL
  ),
  
  -- Primeiro agendamento: first time a deal moved to "Reunião Marcada"
  primeiro_agendamento AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.created_at as activity_date,
      dd.sdr_email,
      dd.deal_name,
      dd.contact_name,
      dd.contact_phone,
      dd.contact_email,
      dd.origin_name,
      dd.origin_id,
      'primeiro_agendamento' as tipo_agendamento
    FROM deal_activities da
    JOIN deal_data dd ON da.deal_id = dd.deal_id
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'Reunião Marcada'
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(dd.sdr_email) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at ASC
  ),
  
  -- Check if deal had previous "Reunião Marcada" before the period
  deals_with_previous_reuniao AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'Reunião Marcada'
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date < start_date
  ),
  
  -- Reagendamento: deals that moved to "Reunião Marcada" in period but had previous
  reagendamento AS (
    SELECT 
      pa.deal_id,
      pa.activity_date,
      pa.sdr_email,
      pa.deal_name,
      pa.contact_name,
      pa.contact_phone,
      pa.contact_email,
      pa.origin_name,
      pa.origin_id,
      'reagendamento' as tipo_agendamento
    FROM primeiro_agendamento pa
    WHERE pa.deal_id IN (SELECT deal_id FROM deals_with_previous_reuniao)
  ),
  
  -- Real primeiro agendamento (excluding reagendamentos)
  real_primeiro AS (
    SELECT * FROM primeiro_agendamento
    WHERE deal_id NOT IN (SELECT deal_id FROM reagendamento)
  ),
  
  -- All agendamentos combined
  all_agendamentos AS (
    SELECT * FROM real_primeiro
    UNION ALL
    SELECT * FROM reagendamento
  ),
  
  -- Realizadas: deals that moved to "Reunião Realizada" during the period
  realizadas AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.created_at as activity_date,
      dd.sdr_email,
      dd.deal_name,
      dd.contact_name,
      dd.contact_phone,
      dd.contact_email,
      dd.origin_name,
      dd.origin_id,
      'realizada' as status
    FROM deal_activities da
    JOIN deal_data dd ON da.deal_id = dd.deal_id
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'Reunião Realizada'
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(dd.sdr_email) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at DESC
  ),
  
  -- No-shows: deals that moved to "No-show" during the period
  no_shows AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.created_at as activity_date,
      dd.sdr_email,
      dd.deal_name,
      dd.contact_name,
      dd.contact_phone,
      dd.contact_email,
      dd.origin_name,
      dd.origin_id,
      'no_show' as status
    FROM deal_activities da
    JOIN deal_data dd ON da.deal_id = dd.deal_id
    WHERE da.activity_type = 'stage_change'
      AND da.to_stage = 'No-show'
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (da.created_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND (sdr_email_filter IS NULL OR LOWER(dd.sdr_email) = LOWER(sdr_email_filter))
    ORDER BY da.deal_id, da.created_at DESC
  ),
  
  -- NEW: Contratos via Hubla transactions crossed with CRM
  contratos_hubla AS (
    SELECT DISTINCT 
      ht.customer_email,
      LOWER(d.owner_id) as sdr_email,
      ht.sale_date
    FROM hubla_transactions ht
    JOIN crm_contacts c ON LOWER(c.email) = LOWER(ht.customer_email)
    JOIN crm_deals d ON d.contact_id = c.id
    WHERE (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date >= start_date
      AND (ht.sale_date AT TIME ZONE 'America/Sao_Paulo')::date <= end_date
      AND ht.sale_status = 'completed'
      AND ht.product_category = 'a010'
      AND (ht.installment_number IS NULL OR ht.installment_number <= 1)
      AND d.owner_id IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(d.owner_id) = LOWER(sdr_email_filter))
  ),
  
  -- Count contracts per SDR
  contratos_by_sdr AS (
    SELECT 
      sdr_email,
      COUNT(DISTINCT customer_email) as contrato_count
    FROM contratos_hubla
    GROUP BY sdr_email
  ),
  
  -- Get unique SDR emails from all sources
  all_sdrs AS (
    SELECT DISTINCT LOWER(sdr_email) as sdr_email FROM all_agendamentos
    UNION
    SELECT DISTINCT LOWER(sdr_email) FROM realizadas
    UNION
    SELECT DISTINCT LOWER(sdr_email) FROM no_shows
    UNION
    SELECT DISTINCT sdr_email FROM contratos_by_sdr
  ),
  
  -- Aggregate metrics per SDR
  sdr_metrics AS (
    SELECT 
      s.sdr_email,
      COALESCE(s.sdr_email, 'Desconhecido') as sdr_name,
      COUNT(DISTINCT CASE WHEN aa.tipo_agendamento = 'primeiro_agendamento' THEN aa.deal_id END) as primeiro_agendamento,
      COUNT(DISTINCT CASE WHEN aa.tipo_agendamento = 'reagendamento' THEN aa.deal_id END) as reagendamento,
      COUNT(DISTINCT aa.deal_id) as total_agendamentos,
      COUNT(DISTINCT r.deal_id) as realizadas,
      COUNT(DISTINCT ns.deal_id) as no_shows,
      COALESCE(MAX(cbs.contrato_count), 0) as contratos
    FROM all_sdrs s
    LEFT JOIN all_agendamentos aa ON LOWER(aa.sdr_email) = s.sdr_email
    LEFT JOIN realizadas r ON LOWER(r.sdr_email) = s.sdr_email
    LEFT JOIN no_shows ns ON LOWER(ns.sdr_email) = s.sdr_email
    LEFT JOIN contratos_by_sdr cbs ON cbs.sdr_email = s.sdr_email
    GROUP BY s.sdr_email
  )
  
  SELECT jsonb_build_object(
    'metrics', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'sdr_email', sm.sdr_email,
          'sdr_name', sm.sdr_name,
          'primeiro_agendamento', sm.primeiro_agendamento,
          'reagendamento', sm.reagendamento,
          'total_agendamentos', sm.total_agendamentos,
          'realizadas', sm.realizadas,
          'no_shows', sm.no_shows,
          'contratos', sm.contratos,
          'taxa_conversao', CASE 
            WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.realizadas::numeric / sm.total_agendamentos) * 100, 1)
            ELSE 0 
          END,
          'taxa_no_show', CASE 
            WHEN sm.total_agendamentos > 0 
            THEN ROUND((sm.no_shows::numeric / sm.total_agendamentos) * 100, 1)
            ELSE 0 
          END
        )
      )
      FROM sdr_metrics sm
      WHERE sm.total_agendamentos > 0 OR sm.contratos > 0
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM sdr_metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM sdr_metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM sdr_metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM sdr_metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM sdr_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contrato_count) FROM contratos_by_sdr), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;