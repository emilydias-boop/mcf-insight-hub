
# Plano: Corrigir No-Show para Usar Cálculo R1 Agendada - R1 Realizada

## Problema

A migration anterior alterou o cálculo para contar apenas `status = 'no_show'`, mas a regra correta é:

**No-Show = R1 Agendada - R1 Realizada**

## Valores Atuais vs Corretos

| SDR | R1 Agendada | R1 Realizada | Atual (errado) | Correto |
|-----|-------------|--------------|----------------|---------|
| Carol Correa | 173 | 124 | 44 | **49** |
| Jessica Martins | 166 | 109 | 54 | **57** |
| Leticia Nunes | 136 | 102 | 29 | **34** |
| Caroline Souza | 135 | 100 | 33 | **35** |
| Antony Elias | 125 | 86 | 38 | **39** |
| Julia Caroline | 109 | 68 | 39 | **41** |

## Alteração Técnica

Criar nova migration para atualizar a RPC `get_sdr_metrics_from_agenda`:

```sql
-- REMOVER a coluna no_shows do SELECT (contagem por status)

-- NO JSON FINAL, calcular matematicamente:
'no_shows', GREATEST(0, r1_agendada - r1_realizada)
```

## Estrutura Corrigida

```sql
WITH sdr_metrics AS (
  SELECT 
    p_booker.email as sdr_email,
    ...
    r1_agendada,
    r1_realizada,
    contratos
    -- NÃO incluir no_shows aqui
)
SELECT jsonb_build_object(
  'metrics', jsonb_agg(
    jsonb_build_object(
      'sdr_email', sdr_email,
      'r1_agendada', r1_agendada,
      'r1_realizada', r1_realizada,
      -- CÁLCULO MATEMÁTICO no JSON:
      'no_shows', GREATEST(0, r1_agendada - r1_realizada),
      'contratos', contratos
    )
  )
)
```

## Arquivo a Criar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Remover contagem por status, usar `r1_agendada - r1_realizada` |

Os hooks do frontend não precisam de alteração.
