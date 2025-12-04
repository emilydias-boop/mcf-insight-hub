CREATE OR REPLACE FUNCTION public.get_tv_sdr_metrics(target_date date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH hubla_a010_emails AS (
    -- Emails de quem comprou A010 no dia
    SELECT DISTINCT LOWER(customer_email) as email
    FROM hubla_transactions
    WHERE product_category = 'a010'
    AND customer_email IS NOT NULL
    AND DATE(sale_date AT TIME ZONE 'America/Sao_Paulo') = target_date
  ),
  sdr_metrics AS (
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
      -- Conta Novo Lead apenas se o email existe na Hubla A010 do mesmo dia
      COUNT(DISTINCT CASE 
        WHEN event_data->>'deal_stage' = 'Novo Lead' 
        AND (event_data->>'deal_old_stage' IS NULL OR event_data->>'deal_old_stage' = '')
        AND LOWER(event_data->>'contact_email') IN (SELECT email FROM hubla_a010_emails)
        THEN event_data->>'contact_email'
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
$function$;