
# Plano: Correção Urgente da Função RPC get_sdr_metrics_from_agenda

## Problemas Identificados

### Problema 1: Fórmula de No-Show Errada
A linha 64 da migration atual usa:
```sql
'no_shows', GREATEST(0, agendamentos - r1_realizada)
```

Mas deveria ser:
```sql
'no_shows', GREATEST(0, r1_agendada - r1_realizada)
```

### Problema 2: Agendamentos Usando Campo NULL
A query usa `msa.booked_at` para contar agendamentos, mas 66% dos registros têm esse campo NULL.

| Campo | Registros Preenchidos |
|-------|----------------------|
| `booked_at` | 538 (34%) |
| `created_at` | 1574 (100%) |

**Solução**: Usar `COALESCE(msa.booked_at, msa.created_at)` como fallback.

## Dados Atuais vs Esperados

| SDR | Agendamentos Atual | Agendamentos Esperado | No-Show Atual | No-Show Esperado |
|-----|-------------------|----------------------|---------------|-----------------|
| Julio Caetano | 0 | ~80+ | 0 | 13 |
| Thaynar Tavares | 0 | ~70+ | 0 | 13 |
| Cristiane Gomes | 0 | ~50+ | 0 | 6 |
| Carol Correa | 89 | ~173 | 0 | 49 |

## Alterações Necessárias

### 1. Nova Migration SQL

Recriar a função RPC com duas correções:

```sql
CREATE OR REPLACE FUNCTION get_sdr_metrics_from_agenda(
  start_date TEXT,
  end_date TEXT,
  sdr_email_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH sdr_metrics AS (
    SELECT 
      p_booker.email as sdr_email,
      COALESCE(p_booker.full_name, split_part(p_booker.email, '@', 1)) as sdr_name,
      
      -- CORREÇÃO 1: Agendamentos usa COALESCE para fallback em created_at
      COUNT(DISTINCT CASE 
        WHEN (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as agendamentos,
      
      -- R1 Agendada: reuniões marcadas PARA o período
      COUNT(DISTINCT CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN msa.id 
      END) as r1_agendada,
      
      -- R1 Realizada: reuniões realizadas no período
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
    JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    JOIN profiles p_booker ON p_booker.id = msa.booked_by
    WHERE msa.booked_by IS NOT NULL
      AND (sdr_email_filter IS NULL OR LOWER(p_booker.email) = LOWER(sdr_email_filter))
      AND (msa.is_reschedule IS NOT TRUE OR msa.is_reschedule IS NULL)
    GROUP BY p_booker.email, COALESCE(p_booker.full_name, split_part(p_booker.email, '@', 1))
  )
  SELECT jsonb_build_object(
    'metrics', COALESCE(jsonb_agg(
      jsonb_build_object(
        'sdr_email', sdr_email,
        'sdr_name', sdr_name,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        -- CORREÇÃO 2: No-shows usa r1_agendada - r1_realizada
        'no_shows', GREATEST(0, r1_agendada - r1_realizada),
        'contratos', contratos
      )
    ), '[]'::jsonb)
  ) INTO result
  FROM sdr_metrics;
  
  RETURN result;
END;
$$;
```

### 2. Hook useTeamMeetingsData.ts

Manter cálculo de no_shows usando dados da RPC (que já estará corrigido):

```typescript
// Linha ~75 - Manter usando dados da RPC
noShows: m.no_shows || 0,  // Vem corrigido da RPC
```

### 3. Hook useMinhasReunioesFromAgenda.ts

Ajustar para usar dados da RPC:

```typescript
// Linhas 34-37
const agendamentos = myMetrics?.agendamentos || 0;
const r1Agendada = myMetrics?.r1_agendada || 0;
const r1Realizada = myMetrics?.r1_realizada || 0;
const noShows = myMetrics?.no_shows || 0; // Usar direto da RPC
```

## Resumo das Correções

| Local | Correção |
|-------|----------|
| Migration SQL | `COALESCE(booked_at, created_at)` para agendamentos |
| Migration SQL | `r1_agendada - r1_realizada` para no_shows |
| useTeamMeetingsData.ts | Usar `m.no_shows` da RPC |
| useMinhasReunioesFromAgenda.ts | Usar `no_shows` da RPC |

## Resultado Esperado

Após as correções, os números voltarão a estar corretos:

- SDRs com `booked_at` NULL terão seus agendamentos contabilizados via `created_at`
- No-show será calculado corretamente como `R1 Agendada - R1 Realizada`
- A identidade matemática `R1 Agendada = R1 Realizada + No-Show` estará preservada
