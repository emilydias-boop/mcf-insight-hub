
# Plano: Corrigir Label "Agendamento" no Painel de Indicadores

## Problema Identificado

O label "Reuniões Agendadas" ainda aparece no painel "Indicadores de Meta" porque vem de um fallback hardcoded no hook `useActiveMetricsForSdr.ts`.

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/hooks/useActiveMetricsForSdr.ts` | 18 | `label_exibicao: 'Reuniões Agendadas'` → `label_exibicao: 'Agendamento'` |

## Mudança

```typescript
// Linha 18: ANTES
{ nome_metrica: 'agendamentos', label_exibicao: 'Reuniões Agendadas', peso_percentual: 25, fonte_dados: 'agenda' },

// DEPOIS
{ nome_metrica: 'agendamentos', label_exibicao: 'Agendamento', peso_percentual: 25, fonte_dados: 'agenda' },
```

## Por que isso acontece

O componente `DynamicIndicatorsGrid` usa o hook `useActiveMetricsForSdr` que:
1. Primeiro tenta buscar métricas configuradas na tabela `fechamento_metricas_mes`
2. Se não encontrar, usa o array `DEFAULT_SDR_METRICS` como fallback
3. O fallback tinha o label antigo "Reuniões Agendadas"

## Resultado

Após a mudança, o painel de Indicadores de Meta mostrará "Agendamento" em vez de "Reuniões Agendadas".
