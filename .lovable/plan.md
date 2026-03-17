
## Diagnóstico

O banco atualmente tem **apenas a versão `date`** da função:
```
get_sdr_metrics_from_agenda(start_date date, end_date date, sdr_email_filter text)
```

O frontend (todos os hooks: `useSdrMetricsFromAgenda`, `useSdrAgendaMetricsBySdrId`, edge function `recalculate-sdr-payout`) chama a função passando **strings texto** (`'2026-03-17'`), não tipo `date`.

O PostgREST não faz cast automático de `text → date` na chamada RPC, causando o erro 400/PGRST203 que zera todos os números do dashboard.

A última migration que funcionava corretamente era `20260211133828` (versão `text, text, text`). A migration `20260206012734` criou a versão `date, date, text` e a `20260206013613` tentou dropar ambas mas o resultado final no banco ficou com `date`.

## Solução

Criar uma migration que:
1. Dropa a versão `date` atual
2. Recria com parâmetros `TEXT` (mesma lógica da migration `20260211133828` que estava funcionando)

**Arquivo:** `supabase/migrations/[timestamp]_fix_sdr_metrics_text_params.sql`

```sql
-- Drop versão date (causa do problema)
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(date, date, text);

-- Recriar com parâmetros TEXT (compatível com o frontend)
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  WITH sdr_stats AS (
    SELECT 
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, p_booker.email) as sdr_name,
      COUNT(CASE 
        WHEN (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
         AND (
           (msa.parent_attendee_id IS NULL AND COALESCE(msa.is_reschedule, false) = false)
           OR (msa.parent_attendee_id IS NOT NULL AND parent_msa.parent_attendee_id IS NULL)
           OR (msa.parent_attendee_id IS NULL AND msa.is_reschedule = true)
         )
        THEN 1 
      END) as agendamentos,
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as r1_agendada,
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
         AND msa.status IN ('completed', 'contract_paid', 'refunded')
        THEN 1 
      END) as r1_realizada,
      COUNT(CASE 
        WHEN (msa.contract_paid_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as contratos
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p_booker ON p_booker.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id
    WHERE msa.status != 'cancelled'
      AND ms.meeting_type = 'r1'
      AND msa.is_partner = false
      AND (sdr_email_filter IS NULL OR p_booker.email = sdr_email_filter)
    GROUP BY p_booker.email, p_booker.full_name
    HAVING p_booker.email IS NOT NULL
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
          'no_shows', GREATEST(0, COALESCE(r1_agendada, 0) - COALESCE(r1_realizada, 0)),
          'contratos', COALESCE(contratos, 0)
        )
        ORDER BY agendamentos DESC NULLS LAST
      ),
      '[]'::json
    )
  ) INTO result
  FROM sdr_stats;

  RETURN COALESCE(result, json_build_object('metrics', '[]'::json));
END;
$$;
```

## Nenhuma alteração no frontend

O frontend já passa strings texto (`'2026-03-17'`) — está correto. Apenas o banco precisa ser corrigido. Uma única migration resolve tudo: dashboard de reuniões de equipe, Minhas Reuniões, cálculo de remuneração dos SDRs.
