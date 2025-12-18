CREATE OR REPLACE FUNCTION public.get_novo_lead_count(target_date date, valid_emails text[] DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH 
  -- Para cada deal, encontrar o primeiro evento de TODOS os tempos
  first_event_ever AS (
    SELECT DISTINCT ON (we.event_data->>'deal_id')
      we.event_data->>'deal_id' as deal_id,
      we.event_data->>'deal_user' as sdr_email,
      we.event_data->>'contact_email' as contact_email,
      we.event_data->>'contact_name' as contact_name,
      we.created_at as first_event_at
    FROM webhook_events we
    WHERE we.event_type = 'deal.stage_changed'
      AND we.event_data->>'deal_origin' = 'PIPELINE INSIDE SALES'
    ORDER BY we.event_data->>'deal_id', we.created_at ASC
  ),
  -- Filtrar apenas os que tiveram primeiro evento na data alvo
  novos_leads_do_dia AS (
    SELECT 
      fe.deal_id,
      fe.sdr_email,
      fe.contact_email,
      fe.contact_name
    FROM first_event_ever fe
    WHERE DATE(fe.first_event_at AT TIME ZONE 'America/Sao_Paulo') = target_date
      -- Filtro opcional: apenas emails válidos
      AND (valid_emails IS NULL OR LOWER(fe.sdr_email) = ANY(valid_emails))
  ),
  -- Agrupar por SDR
  por_sdr AS (
    SELECT 
      nl.sdr_email,
      COUNT(DISTINCT nl.deal_id) as novo_lead_count
    FROM novos_leads_do_dia nl
    WHERE nl.sdr_email IS NOT NULL
    GROUP BY nl.sdr_email
  )
  SELECT json_build_object(
    'total', COALESCE((SELECT COUNT(DISTINCT deal_id) FROM novos_leads_do_dia), 0),
    'por_sdr', COALESCE((SELECT json_agg(json_build_object('sdr_email', sdr_email, 'count', novo_lead_count)) FROM por_sdr), '[]'::json)
  ) INTO result;
  
  RETURN result;
END;
$function$;