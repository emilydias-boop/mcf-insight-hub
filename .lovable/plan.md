

## Problema: Edge Function calcula "Meta Realizadas" diferente do frontend

### Causa raiz
A Edge Function `recalculate-sdr-payout` calcula a meta de realizadas como **70% da META de agendadas** (linha 142):
```
metaRealizadasAjustada = Math.round(metaAgendadasAjustada * 0.7)
→ 85 * 0.7 = 59
→ 50/59 = 84.7% → multiplicador 0.5x
```

Mas o frontend (`useCalculatedVariavel.ts`, linha 84) calcula como **70% das agendadas REAIS**:
```
metaAjustada = Math.round(agendadasReais * 0.7)
→ 69 * 0.7 = 48
→ 50/48 = 104.2% → multiplicador 1.0x
```

Isso explica: edge function dá R$ 400 (0.5x + 0.5x), frontend dá R$ 630 (0.5x + 1.0x).

### Correção
No arquivo `supabase/functions/recalculate-sdr-payout/index.ts`, **linha 142**, trocar:
```typescript
// ANTES:
const metaRealizadasAjustada = Math.round(metaAgendadasAjustada * 0.7);

// DEPOIS:
const metaRealizadasAjustada = Math.round((kpi.reunioes_agendadas || 0) * 0.7);
```

Isso sincroniza a Edge Function com o frontend, usando 70% das agendadas **reais** como meta de realizadas.

### Arquivo alterado
`supabase/functions/recalculate-sdr-payout/index.ts` - 1 linha

