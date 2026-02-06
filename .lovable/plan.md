
# Diagnóstico Completo e Solução Definitiva

## Análise Realizada

### Frontend (✅ OK)
| Arquivo | Status | Observação |
|---------|--------|------------|
| `useSdrMetricsFromAgenda.ts` | Correto | Chama RPC com parâmetros `text` |
| `useTeamMeetingsData.ts` | Correto | Processa resposta normalmente |

### Backend (❌ ERRO)
| Objeto | Problema |
|--------|----------|
| RPC `get_sdr_metrics_from_agenda` | Usa `msa.rescheduled_from_id` que **NÃO EXISTE** |

### Estrutura Real da Tabela `meeting_slot_attendees`
```text
Colunas relevantes:
├── booked_by (uuid)         --> profiles.id (SDR)
├── booked_at (timestamp)    --> Data do agendamento
├── parent_attendee_id (uuid)--> ID do attendee pai (reagendamento)
├── is_reschedule (boolean)  --> Flag de reagendamento
├── status (text)
└── contract_paid_at (timestamp)

NOTA: Não existe coluna "rescheduled_from_id"
```

## Causa Raiz

A migration `20260206013613` sobrescreveu a função com a coluna errada:
- **Usou:** `msa.rescheduled_from_id` 
- **Deveria usar:** `msa.parent_attendee_id`

## Solução

Nova migration que restaura a função correta baseada na versão funcional (`20260206012145`):

### SQL a Aplicar

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
      
      -- R1 Agendada
      COUNT(CASE 
        WHEN (ms.start_time AT TIME ZONE 'America/Sao_Paulo')::date 
             BETWEEN start_date::DATE AND end_date::DATE
        THEN 1 
      END) as r1_agendada,
      
      -- R1 Realizada
      COUNT(CASE 
        WHEN (ms.start_time AT TIME ZONE 'America/Sao_Paulo')::date 
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

## Diferenças Críticas

| Aspecto | Versão Errada (Atual) | Versão Correta |
|---------|----------------------|----------------|
| Coluna reagendamento | `rescheduled_from_id` ❌ | `parent_attendee_id` ✅ |
| JOIN parent | Inexistente | `LEFT JOIN parent_msa` ✅ |
| Data reunião | `scheduled_at` | `start_time` ✅ |
| Filtro tipo | Nenhum | `meeting_type = 'r1'` ✅ |
| Timezone | Sem conversão | `AT TIME ZONE 'America/Sao_Paulo'` ✅ |

## Resultado Esperado

Após a correção:
- Lista de SDRs aparece no Painel Comercial
- Métricas corretas: Carol Correa com ~181 Agendamentos
- No-Show calculado: `Agendamentos - R1 Realizada`
