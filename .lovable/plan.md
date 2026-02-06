
# Plano: Restaurar RPC + No-Show = Agendamentos - R1 Realizada

## Problema

A migration `20260206005738` quebrou a função:

| Aspecto | Versão ANTIGA (correta) | Versão NOVA (quebrada) |
|---------|------------------------|------------------------|
| Agendamentos Carol | **181** | 183 (errado) |
| JOIN parent_msa | ✅ Presente | ❌ Removido |
| Filtro cancelled | ✅ `status != 'cancelled'` | ❌ Removido |
| No-Show | Por status | Por status |

## Fórmula Correta

```text
No-Show = Agendamentos - R1 Realizada
```

**Exemplo Carol Correa (Jan/26):**
- Agendamentos: 181
- R1 Realizada: 124
- **No-Show = 181 - 124 = 57** ✅

## Solução

Criar nova migration que:
1. **RESTAURA** a lógica completa da versão `20260201021137`
2. **CALCULA** no_show como `GREATEST(0, agendamentos - r1_realizada)` no JSON final

## Alteração Técnica

### Nova Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(...)
AS $$
BEGIN
  WITH sdr_stats AS (
    SELECT 
      p.email as sdr_email,
      COALESCE(p.full_name, p.email) as sdr_name,
      
      -- AGENDAMENTOS: Lógica CORRETA (originais + 1º reagendamento)
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
      COUNT(CASE WHEN scheduled_at no período THEN 1 END) as r1_agendada,
      
      -- R1 Realizada
      COUNT(CASE WHEN status IN ('completed','contract_paid','refunded') THEN 1 END) as r1_realizada,
      
      -- Contratos
      COUNT(CASE WHEN contract_paid_at no período THEN 1 END) as contratos
      
    FROM meeting_slot_attendees msa
    INNER JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
    LEFT JOIN profiles p ON p.id = msa.booked_by
    LEFT JOIN meeting_slot_attendees parent_msa ON parent_msa.id = msa.parent_attendee_id  -- RESTAURADO!
    WHERE msa.status != 'cancelled'  -- RESTAURADO!
    ...
  )
  SELECT json_build_object(
    'metrics', json_agg(
      json_build_object(
        'sdr_email', sdr_email,
        'agendamentos', agendamentos,
        'r1_agendada', r1_agendada,
        'r1_realizada', r1_realizada,
        -- NO-SHOW CALCULADO: Agendamentos - R1 Realizada
        'no_shows', GREATEST(0, agendamentos - r1_realizada),
        'contratos', contratos
      )
    )
  );
END;
$$;
```

## Resultado Esperado

| SDR | Agendamentos | R1 Realizada | No-Show (calculado) |
|-----|-------------|--------------|---------------------|
| Carol Correa | **181** | 124 | **57** |
| Jessica Martins | ~171 | 109 | **62** |
| Leticia Nunes | ~153 | 102 | **51** |
| Caroline Souza | ~146 | 100 | **46** |
| Antony Elias | ~134 | 86 | **48** |
| Julia Caroline | ~112 | 68 | **44** |

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| Nova migration SQL | Restaura lógica completa + no_show = agendamentos - r1_realizada |

Frontend não precisa de alterações.
