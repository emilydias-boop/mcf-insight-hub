
# Correção: Coluna `start_time` → `scheduled_at`

## Problema

A migration anterior usou `ms.start_time` mas a coluna correta na tabela `meeting_slots` é **`scheduled_at`**.

## Erro Atual

```
column ms.start_time does not exist
```

## Correção

Criar nova migration substituindo todas as referências de `ms.start_time` por `ms.scheduled_at`:

```sql
-- Onde estava:
(ms.start_time AT TIME ZONE 'America/Sao_Paulo')::date

-- Corrigir para:
(ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date
```

## Locais de Alteração

| Linha | Errado | Correto |
|-------|--------|---------|
| R1 Agendada | `ms.start_time` | `ms.scheduled_at` |
| R1 Realizada | `ms.start_time` | `ms.scheduled_at` |

## Arquivo

| Arquivo | Descrição |
|---------|-----------|
| Nova migration SQL | Corrige nome da coluna para `scheduled_at` |

## Resultado Esperado

Após a correção, os dados voltarão a aparecer com os valores corretos:
- Carol Correa: 181 Agendamentos, 124 R1 Realizada, 57 No-Show
