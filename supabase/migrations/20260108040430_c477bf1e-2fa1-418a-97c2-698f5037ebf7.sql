-- Drop and recreate get_sdr_metrics_v2 with correct stage names
DROP FUNCTION IF EXISTS get_sdr_metrics_v2(DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION get_sdr_metrics_v2(
  start_date DATE,
  end_date DATE,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH deal_data AS (
    SELECT 
      d.id as deal_id,
      d.clint_id,
      c.name as contact_name,
      c.email as contact_email,
      c.phone as contact_phone,
      d.name as deal_name,
      s.stage_name as current_stage,
      d.probability,
      o.name as origin_name,
      d.owner_id as current_owner
    FROM crm_deals d
    LEFT JOIN crm_contacts c ON d.contact_id = c.id
    LEFT JOIN crm_stages s ON d.stage_id = s.id
    LEFT JOIN crm_origins o ON d.origin_id = o.id
  ),
  primeiro_agendamento AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.user_id as intermediador,
      da.created_at as data_agendamento
    FROM deal_activities da
    WHERE da.to_stage = 'Reunião 01 Agendada'
      AND da.from_stage = 'Lead Qualificado'
      AND da.created_at::date BETWEEN start_date AND end_date
    ORDER BY da.deal_id, da.created_at ASC
  ),
  deals_with_previous_reuniao AS (
    SELECT DISTINCT da.deal_id
    FROM deal_activities da
    WHERE da.to_stage = 'Reunião 01 Agendada'
      AND da.created_at::date < start_date
  ),
  reagendamentos AS (
    SELECT 
      da.deal_id,
      da.user_id as intermediador,
      da.created_at as data_agendamento
    FROM deal_activities da
    WHERE da.to_stage = 'Reunião 01 Agendada'
      AND da.from_stage = 'No-Show'
      AND da.created_at::date BETWEEN start_date AND end_date
      AND da.deal_id IN (SELECT deal_id FROM deals_with_previous_reuniao)
  ),
  realizadas AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.user_id as intermediador,
      da.created_at as data_realizacao
    FROM deal_activities da
    INNER JOIN deal_data dd ON da.deal_id = dd.deal_id::text
    WHERE da.to_stage = 'Reunião 01 Realizada'
      AND da.created_at::date BETWEEN start_date AND end_date
    ORDER BY da.deal_id, da.created_at ASC
  ),
  no_shows AS (
    SELECT DISTINCT ON (da.deal_id)
      da.deal_id,
      da.user_id as intermediador,
      da.created_at as data_noshow
    FROM deal_activities da
    INNER JOIN deal_data dd ON da.deal_id = dd.deal_id::text
    WHERE da.to_stage = 'No-Show'
      AND da.created_at::date BETWEEN start_date AND end_date
    ORDER BY da.deal_id, da.created_at ASC
  ),
  contratos AS (
    SELECT 
      ht.intermediador_email,
      COUNT(*) as total_contratos
    FROM hubla_transactions ht
    WHERE ht.status = 'completed'
      AND ht.created_at::date BETWEEN start_date AND end_date
      AND ht.intermediador_email IS NOT NULL
    GROUP BY ht.intermediador_email
  ),
  sdr_metrics AS (
    SELECT 
      COALESCE(pa.intermediador, r.intermediador, re.intermediador, ns.intermediador) as sdr_email,
      COUNT(DISTINCT pa.deal_id) as primeiro_agendamento,
      COUNT(DISTINCT r.deal_id) as reagendamento,
      COUNT(DISTINCT re.deal_id) as realizadas,
      COUNT(DISTINCT ns.deal_id) as no_shows
    FROM primeiro_agendamento pa
    FULL OUTER JOIN reagendamentos r ON pa.deal_id = r.deal_id
    FULL OUTER JOIN realizadas re ON COALESCE(pa.deal_id, r.deal_id) = re.deal_id
    FULL OUTER JOIN no_shows ns ON COALESCE(pa.deal_id, r.deal_id) = ns.deal_id
    WHERE COALESCE(pa.intermediador, r.intermediador, re.intermediador, ns.intermediador) IS NOT NULL
    GROUP BY COALESCE(pa.intermediador, r.intermediador, re.intermediador, ns.intermediador)
  ),
  final_metrics AS (
    SELECT 
      sm.sdr_email,
      COALESCE(u.name, sm.sdr_email) as sdr_name,
      sm.primeiro_agendamento,
      sm.reagendamento,
      (sm.primeiro_agendamento + sm.reagendamento) as total_agendamentos,
      sm.no_shows,
      sm.realizadas,
      COALESCE(c.total_contratos, 0) as contratos,
      CASE 
        WHEN sm.realizadas > 0 THEN ROUND((COALESCE(c.total_contratos, 0)::numeric / sm.realizadas::numeric) * 100, 1)
        ELSE 0
      END as taxa_conversao,
      CASE 
        WHEN (sm.primeiro_agendamento + sm.reagendamento) > 0 
        THEN ROUND((sm.no_shows::numeric / (sm.primeiro_agendamento + sm.reagendamento)::numeric) * 100, 1)
        ELSE 0
      END as taxa_no_show
    FROM sdr_metrics sm
    LEFT JOIN users u ON sm.sdr_email = u.email
    LEFT JOIN contratos c ON sm.sdr_email = c.intermediador_email
    WHERE (sdr_email_filter IS NULL OR sm.sdr_email = sdr_email_filter)
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE((SELECT jsonb_agg(row_to_json(fm)) FROM final_metrics fm), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_primeiro_agendamento', COALESCE((SELECT SUM(primeiro_agendamento) FROM final_metrics), 0),
      'total_reagendamento', COALESCE((SELECT SUM(reagendamento) FROM final_metrics), 0),
      'total_agendamentos', COALESCE((SELECT SUM(total_agendamentos) FROM final_metrics), 0),
      'total_no_shows', COALESCE((SELECT SUM(no_shows) FROM final_metrics), 0),
      'total_realizadas', COALESCE((SELECT SUM(realizadas) FROM final_metrics), 0),
      'total_contratos', COALESCE((SELECT SUM(contratos) FROM final_metrics), 0)
    )
  ) INTO result;
  
  RETURN result;
END;
$$;