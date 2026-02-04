

# Plano: Corrigir Calculo da Meta de Realizadas

## Problema Identificado

A meta de **Realizadas** esta sendo calculada sobre o valor **real** de agendadas, mas deveria ser sobre a **meta** de agendadas.

| Campo | Valor Atual (errado) | Valor Correto |
|-------|---------------------|---------------|
| Meta Agendadas | 140 | 140 |
| Meta Realizadas | 70% de 217 = 152 | 70% de 140 = **98** |
| Realizadas feitas | 157 | 157 |
| Percentual | 157/152 = 103% | 157/98 = **160%** |

## Codigo Atual (com bug)

```typescript
// Linha 103-104 da edge function
// Meta de Realizadas = 70% do que foi REALMENTE agendado (não da meta teórica)
const metaRealizadasAjustada = Math.round(kpi.reunioes_agendadas * 0.7);
```

O codigo usa `kpi.reunioes_agendadas` (217) em vez de `metaAgendadasAjustada` (140).

## Correcao Proposta

```typescript
// Linha 103-104 da edge function
// Meta de Realizadas = 70% da META de agendadas do mes
const metaRealizadasAjustada = Math.round(metaAgendadasAjustada * 0.7);
```

## Arquivo a Modificar

`supabase/functions/recalculate-sdr-payout/index.ts` - linha 104

## Resultado Esperado Apos Correcao

Para Cleiton Lima (janeiro 2026):
- Meta Agendadas: 140 (7 x 20 dias uteis)
- Meta Realizadas: **98** (70% de 140)
- Realizadas: 157
- Percentual: 157 / 98 = **160%** → Multiplicador **1.5x**

## Impacto

Esta mudanca afetara todos os SDRs que superaram a meta de agendadas, pois atualmente o percentual de realizadas e "penalizado" por ter agendado mais. Com a correcao, o percentual sera calculado corretamente sobre a meta fixa do mes.

