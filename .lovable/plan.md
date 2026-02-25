

## Corrigir duplicacao de leads no Total Leads do Carrinho R2

### Problema

No hook `useR2MetricsData.ts`, o calculo de `totalLeads` agrupa attendees por `deal_id` (linha 207), mas:

1. **Attendees com `status === 'rescheduled'` nao sao filtrados** - eles entram no loop de deduplicacao e, se nao tiverem `deal_id`, sao contados como leads separados (fallback `att.id` na linha 207)
2. **Attendees sem `deal_id`** usam o proprio `att.id` como chave, gerando entradas duplicadas para o mesmo lead fisico que foi reagendado

Isso infla o `totalLeads` (e potencialmente outras metricas como no-show) com registros que ja foram substituidos por um reagendamento.

### Alteracao

**`src/hooks/useR2MetricsData.ts`** - Filtrar attendees com status `rescheduled` ou `cancelled` antes de processar:

Na linha 206, dentro do loop `attendees.forEach(att => {`, adicionar no inicio:

```typescript
// Skip rescheduled/cancelled attendees - they are superseded by newer records
if (att.status === 'rescheduled' || att.status === 'cancelled') return;
```

Isso garante que:
- Um lead reagendado 3x conta apenas 1x (o registro ativo)
- No-shows que foram reagendados nao contam como leads separados
- A deduplicacao por `deal_id` continua funcionando como segunda camada de seguranca

### Resultado

O card "Total Leads" passara a mostrar apenas leads unicos ativos, sem contar registros de reagendamento ou cancelamento.

