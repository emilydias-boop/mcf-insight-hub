-- Função RPC para métricas do funil por tipo de lead (A/B)
CREATE OR REPLACE FUNCTION get_tv_funnel_metrics(target_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH funnel_metrics AS (
    SELECT 
      event_data->>'deal_stage' as stage_name,
      CASE 
        WHEN LOWER(COALESCE(event_data->>'contact_tag', '')) LIKE '%lead a%' THEN 'A'
        WHEN LOWER(COALESCE(event_data->>'contact_tag', '')) LIKE '%lead b%' THEN 'B'
        ELSE 'UNKNOWN'
      END as lead_type,
      COUNT(DISTINCT COALESCE(event_data->>'contact_email', event_data->>'contact_name')) as unique_leads
    FROM webhook_events
    WHERE event_type = 'deal.stage_changed'
    AND event_data->>'deal_origin' = 'PIPELINE INSIDE SALES'
    AND created_at >= target_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
    AND created_at < (target_date + interval '1 day')::timestamp AT TIME ZONE 'America/Sao_Paulo'
    AND event_data->>'deal_stage' IN ('Reunião 01 Agendada', 'Reunião 01 Realizada', 'No-Show', 'Contrato Pago')
    GROUP BY event_data->>'deal_stage', 
      CASE 
        WHEN LOWER(COALESCE(event_data->>'contact_tag', '')) LIKE '%lead a%' THEN 'A'
        WHEN LOWER(COALESCE(event_data->>'contact_tag', '')) LIKE '%lead b%' THEN 'B'
        ELSE 'UNKNOWN'
      END
  )
  SELECT COALESCE(json_agg(funnel_metrics), '[]'::json) INTO result FROM funnel_metrics;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_tv_funnel_metrics(DATE) TO anon, authenticated;