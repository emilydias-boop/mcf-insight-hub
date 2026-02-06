-- =================================================================
-- FIX: Remove duplicate function signatures causing PGRST203 error
-- =================================================================

-- Step 1: Drop ALL existing versions of the function
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);

-- Step 2: Create a SINGLE unified version with text parameters
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text,
  end_date text,
  sdr_email_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH sdr_metrics AS (
    SELECT 
      p.email as sdr_email,
      COALESCE(p.nome, p.name, p.email) as sdr_name,
      
      -- Agendamentos: created_at no período, excluindo cancelados e reagendamentos inválidos
      COUNT(DISTINCT CASE 
        WHEN (msa.created_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::date AND end_date::date
             AND msa.status != 'cancelled'
             AND NOT EXISTS (
               SELECT 1 FROM meeting_slot_attendees parent_msa
               WHERE parent_msa.id = msa.rescheduled_from_id
               AND parent_msa.status = 'cancelled'
             )
        THEN msa.id 
      END) as agendamentos,
      
      -- R1 Agendada: reuniões PARA o período (scheduled_at)
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::date AND end_date::date
             AND msa.status NOT IN ('cancelled', 'no_show')
        THEN msa.id 
      END) as r1_agendada,
      
      -- R1 Realizada: status 'completed' no período
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::date AND end_date::date
             AND msa.status = 'completed'
        THEN msa.id 
      END) as r1_realizada,
      
      -- Contratos: vendas pagas no período
      COUNT(DISTINCT CASE 
        WHEN msa.sale_status = 'paid'
             AND (msa.created_at AT TIME ZONE 'America/Sao_Paulo')::date 
                 BETWEEN start_date::date AND end_date::date
        THEN msa.id 
      END) as contratos

    FROM profiles p
    INNER JOIN meeting_slot_attendees msa ON msa.sdr_id = p.id
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    WHERE p.role IN ('sdr', 'sdr_closer', 'gestor_comercial', 'head_comercial', 'admin')
      AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
    GROUP BY p.id, p.email, p.nome, p.name
  )
  SELECT json_build_object(
    'metrics', COALESCE(
      json_agg(
        json_build_object(
          'sdr_email', sdr_email,
          'sdr_name', sdr_name,
          'agendamentos', COALESCE(agendamentos, 0),
          'r1_agendada', COALESCE(r1_agendada, 0),
          'r1_realizada', COALESCE(r1_realizada, 0),
          'no_shows', GREATEST(0, COALESCE(agendamentos, 0) - COALESCE(r1_realizada, 0)),
          'contratos', COALESCE(contratos, 0)
        )
        ORDER BY agendamentos DESC NULLS LAST
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_metrics
  WHERE agendamentos > 0 OR r1_realizada > 0;

  RETURN COALESCE(result, '{"metrics": []}'::json);
END;
$$;