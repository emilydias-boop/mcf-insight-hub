-- Dropar função existente e recriar com nova lógica de no_shows
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
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
  WITH sdr_metrics AS (
    SELECT 
      msa.booked_by_email as sdr_email,
      COALESCE(p.full_name, msa.booked_by_name, split_part(msa.booked_by_email, '@', 1)) as sdr_name,
      
      -- Agendamentos: criados NO período (data de criação/booking)
      COUNT(DISTINCT CASE 
        WHEN (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (msa.booked_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as agendamentos,
      
      -- R1 Agendada: reuniões marcadas PARA o período (data da reunião)
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as r1_agendada,
      
      -- R1 Realizada: reuniões realizadas no período (completed, contract_paid, refunded)
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
         AND msa.status IN ('completed', 'contract_paid', 'refunded')
        THEN msa.id 
      END) as r1_realizada,
      
      -- Contratos: com contract_paid_at no período
      COUNT(DISTINCT CASE 
        WHEN (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as contratos
      
    FROM meeting_slot_attendees msa
    JOIN meeting_slots ms ON ms.id = msa.slot_id
    LEFT JOIN profiles p ON p.email = msa.booked_by_email
    WHERE msa.booked_by_email IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(msa.booked_by_email) = LOWER(sdr_email_filter))
      AND msa.reschedule_count <= 1
    GROUP BY msa.booked_by_email, COALESCE(p.full_name, msa.booked_by_name, split_part(msa.booked_by_email, '@', 1))
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE(jsonb_agg(
      jsonb_build_object(
        'sdr_email', sdr_email,
        'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        -- NOVA LÓGICA: no_shows calculado como diferença (agendamentos - r1_realizada)
        'no_shows', GREATEST(0, agendamentos - r1_realizada),
        'contratos', contratos
      )
    ), '[]'::jsonb)
  ) INTO result
  FROM sdr_metrics;
  
  RETURN result;
END;
$$;