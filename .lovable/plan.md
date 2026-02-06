
# Plano: Corrigir No-Show para Usar Contagem por Status

## Problema Identificado

A fórmula atual calcula No-show como `R1 Agendada - R1 Realizada`, mas isso inclui reuniões ainda não classificadas (status pendente).

### Comparação dos Dados:

| SDR | No-show CORRETO (status) | No-show ATUAL (cálculo) | Erro |
|-----|--------------------------|-------------------------|------|
| Carol Correa | 44 | 49 | +5 |
| Jessica Martins | 54 | 57 | +3 |
| Leticia Nunes | 29 | 34 | +5 |
| Antony Elias | 38 | 39 | +1 |

## Solução

Alterar a RPC `get_sdr_metrics_from_agenda` para contar No-shows pelo **status real** (`status = 'no_show'`) em vez da fórmula matemática.

## Alteração na Migration SQL

```sql
-- DE (cálculo matemático - ERRADO):
'no_shows', GREATEST(0, r1_agendada - r1_realizada)

-- PARA (contagem por status - CORRETO):
'no_shows', COUNT(DISTINCT CASE 
  WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
   AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
   AND msa.status = 'no_show'
  THEN msa.id 
END)
```

## Estrutura Completa da Função Corrigida

A função será atualizada para incluir uma nova métrica `no_shows` que conta diretamente do status:

```sql
CREATE OR REPLACE FUNCTION get_sdr_metrics_from_agenda(...)
WITH sdr_metrics AS (
  SELECT 
    ...
    -- Nova coluna para No-shows por STATUS
    COUNT(DISTINCT CASE 
      WHEN scheduled_at no período
       AND msa.status = 'no_show'
      THEN msa.id 
    END) as no_shows,
    ...
  FROM meeting_slot_attendees msa
  ...
)
SELECT jsonb_build_object(
  'metrics', jsonb_agg(
    jsonb_build_object(
      ...
      'no_shows', no_shows,  -- Agora vem da contagem, não do cálculo
      ...
    )
  )
)
```

## Resultado Esperado

Após a correção:

| SDR | No-show (correto) |
|-----|-------------------|
| Carol Correa | 44 |
| Jessica Martins | 54 |
| Leticia Nunes | 29 |
| Caroline Souza | 33 |
| Antony Elias | 38 |
| Julia Caroline | 39 |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Contar no_shows por status em vez de cálculo |

Os hooks do frontend (`useTeamMeetingsData.ts` e `useMinhasReunioesFromAgenda.ts`) já estão usando `m.no_shows` da RPC, então não precisam ser alterados.
