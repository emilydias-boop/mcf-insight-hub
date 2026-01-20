
-- Corrigir RPC para contar corretamente reagendamentos após no-show
-- Usa is_reschedule como fallback quando parent_attendee_id está nulo

CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(start_date text, end_date text, sdr_email_filter text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH sdr_stats AS (
    SELECT 
      p.email as sdr_email,
      COALESCE(p.full_name, p.email) as sdr_name,
      -- Agendamentos no período usando booked_at (data real do agendamento)
      -- Conta: originais (sem parent E não é reschedule) OU 1º reagendamento (parent sem avô OU is_reschedule sem parent)
      COUNT(CASE 
        WHEN COALESCE(msa.booked_at, msa.created_at)::date >= start_date::DATE 
         AND COALESCE(msa.booked_at, msa.created_at)::date <= end_date::DATE
         AND (
           -- Agendamento original: sem parent e não é reschedule
           (msa.parent_attendee_id IS NULL AND COALESCE(msa.is_reschedule, false) = false)
           -- 1º reagendamento com vínculo: parent existe e parent não tem avô
           OR (msa.parent_attendee_id IS NOT NULL AND parent_msa.parent_attendee_id IS NULL)
           -- 1º reagendamento órfão: is_reschedule=true mas sem parent (dados legados)
           OR (msa.parent_attendee_id IS NULL AND msa.is_reschedule = true)
         )
        THEN 1 
      END) as agendamentos,
      -- R1 Agendada: reuniões marcadas PARA o período (scheduled_at)
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE THEN 1 END) as r1_agendada,
      -- R1 Realizada: completed/contract_paid no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status IN ('completed', 'contract_paid') THEN 1 END) as r1_realizada,
      -- No-show no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status = 'no_show' THEN 1 END) as no_shows,
      -- Contrato pago no período
      COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
                  AND ms.scheduled_at::date <= end_date::DATE 
                  AND msa.status = 'contract_paid' THEN 1 END) as contratos
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p ON p.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id
    WHERE msa.status != 'cancelled'
      AND p.email IS NOT NULL
      AND (sdr_email_filter IS NULL OR p.email = sdr_email_filter)
      AND (
        -- Include if booked_at is in range OR scheduled_at is in range
        (COALESCE(msa.booked_at, msa.created_at)::date >= start_date::DATE 
         AND COALESCE(msa.booked_at, msa.created_at)::date <= end_date::DATE)
        OR (ms.scheduled_at::date >= start_date::DATE 
            AND ms.scheduled_at::date <= end_date::DATE)
      )
    GROUP BY p.email, COALESCE(p.full_name, p.email)
  )
  SELECT json_build_object(
    'metrics', COALESCE(
      json_agg(
        json_build_object(
          'sdr_email', sdr_email,
          'sdr_name', sdr_name,
          'agendamentos', agendamentos,
          'r1_agendada', r1_agendada,
          'r1_realizada', r1_realizada,
          'no_shows', no_shows,
          'contratos', contratos
        )
        ORDER BY agendamentos DESC
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_stats;
  
  RETURN result;
END;
$function$;
