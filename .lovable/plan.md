

## Plano: Corrigir filtro de capacidade do pré-agendamento

### Problema
O `preScheduledCounts` conta attendees com status `pre_scheduled`, `invited`, `scheduled` e `confirmed`. Isso inclui reuniões regulares já agendadas, inflando a contagem e bloqueando novos pré-agendamentos em slots que já têm reuniões normais.

### Por que a correção é segura para todos

1. **O `preScheduledCounts` só é usado no modo pré-agendamento** — ele aparece apenas no `R2QuickScheduleModal` quando `isPreSchedule = true`, para mostrar "(lotado)" ou "(1/2)". Não afeta agendamentos regulares.

2. **A capacidade de reuniões regulares é controlada separadamente** — o campo `isAvailable` (linha 118) já usa `currentCount < maxLeadsPerSlot` baseado em `meeting_slots`, que é independente do `preScheduledCounts`.

3. **A regra de negócio diz: limite de 2 pré-agendamentos por slot** — isso deve contar apenas pré-agendamentos pendentes (`pre_scheduled`), não reuniões já confirmadas/realizadas. Attendees que passaram para `invited`/`scheduled`/`confirmed` já viraram reuniões regulares e já são contados no `currentCount`.

4. **O closer Jessica funciona porque provavelmente tem menos reuniões regulares** — Julio tem mais horários ocupados com reuniões normais, que estavam sendo contadas como pré-agendamentos.

### Correção

**Arquivo:** `src/hooks/useR2CloserAvailableSlots.ts` — linha 128

```
// DE:
.in('status', ['pre_scheduled', 'invited', 'scheduled', 'confirmed'])

// PARA:
.eq('status', 'pre_scheduled')
```

Uma única linha. Sem efeitos colaterais — a contagem passa a refletir apenas pré-agendamentos pendentes reais.

