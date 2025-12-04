-- Função RPC para calcular métricas SDR diretamente no banco
-- Contorna o limite de 1000 registros do Supabase client

CREATE OR REPLACE FUNCTION get_tv_sdr_metrics(target_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH sdr_metrics AS (
    SELECT 
      event_data->>'deal_user' as sdr_email,
      COUNT(DISTINCT CASE 
        WHEN event_data->>'deal_stage' = 'Reunião 01 Agendada' 
        THEN COALESCE(event_data->>'contact_email', event_data->>'contact_name')
      END) as r1_agendada,
      COUNT(DISTINCT CASE 
        WHEN event_data->>'deal_stage' = 'Reunião 01 Realizada' 
        THEN COALESCE(event_data->>'contact_email', event_data->>'contact_name')
      END) as r1_realizada,
      COUNT(DISTINCT CASE 
        WHEN event_data->>'deal_stage' = 'No-Show' 
        THEN COALESCE(event_data->>'contact_email', event_data->>'contact_name')
      END) as no_show,
      COUNT(DISTINCT CASE 
        WHEN event_data->>'deal_stage' = 'Novo Lead' 
        AND (event_data->>'deal_old_stage' IS NULL OR event_data->>'deal_old_stage' = '')
        THEN COALESCE(event_data->>'contact_email', event_data->>'contact_name')
      END) as novo_lead
    FROM webhook_events
    WHERE event_type = 'deal.stage_changed'
    AND event_data->>'deal_origin' = 'PIPELINE INSIDE SALES'
    AND created_at >= target_date::timestamp AT TIME ZONE 'America/Sao_Paulo'
    AND created_at < (target_date + interval '1 day')::timestamp AT TIME ZONE 'America/Sao_Paulo'
    GROUP BY event_data->>'deal_user'
  )
  SELECT COALESCE(json_agg(sdr_metrics), '[]'::json) INTO result FROM sdr_metrics;
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_tv_sdr_metrics(DATE) TO anon, authenticated;