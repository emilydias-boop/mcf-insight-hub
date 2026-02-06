

# Correção Definitiva: Coluna `start_time` → `scheduled_at`

## Problema Identificado

A RPC `get_sdr_metrics_from_agenda` falha porque usa uma coluna que **não existe**:

```
ERROR: 42703: column ms.start_time does not exist
```

## Estrutura Real da Tabela `meeting_slots`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `scheduled_at` | timestamp with time zone | Data/hora da reunião |
| `meeting_type` | text | Tipo (r1, r2) |
| `status` | text | Status do slot |
| `booked_by` | uuid | Quem agendou |

## Correção SQL

Trocar em 3 lugares na função:

```text
ANTES: ms.start_time AT TIME ZONE 'America/Sao_Paulo'
DEPOIS: ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo'
```

## Migration a Aplicar

```sql
DROP FUNCTION IF EXISTS public.get_sdr_metrics_from_agenda(text, text, text);

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
      
      -- AGENDAMENTOS: originais + 1º reagendamento
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
      
      -- R1 Agendada: usa ms.scheduled_at (corrigido)
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as r1_agendada,
      
      -- R1 Realizada: usa ms.scheduled_at (corrigido)
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
         AND msa.status IN ('completed', 'contract_paid', 'refunded')
        THEN 1 
      END) as r1_realizada,
      
      -- Contratos
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
          'no_shows', GREATEST(0, COALESCE(agendamentos, 0) - COALESCE(r1_realizada, 0)),
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

## Resumo das Correções Acumuladas

| Versão | Problema | Correção |
|--------|----------|----------|
| 1ª | `msa.sdr_id` não existe | Trocado por `msa.booked_by` |
| 2ª | `p.nome/name` não existe | Trocado por `p.full_name` |
| 3ª | `rescheduled_from_id` não existe | Trocado por `parent_attendee_id` |
| **4ª (AGORA)** | `ms.start_time` não existe | Trocar por `ms.scheduled_at` |

## Resultado Esperado

Após esta correção:
- Lista de SDRs aparece no Painel Comercial
- Métricas calculadas corretamente
- Carol Correa com ~181 Agendamentos

