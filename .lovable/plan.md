

## Plano: Corrigir No-Show e adicionar tooltips explicativos nos KPIs

### Problema 1: No-Show calculado errado na RPC
A RPC `get_sdr_metrics_from_agenda` calcula:
- `no_shows = agendamentos - r1_realizada` (linha 70)

Isso mistura duas bases de data: `agendamentos` usa `booked_at` e `r1_realizada` usa `scheduled_at`. O correto é `r1_agendada - r1_realizada` (reuniões que deveriam ocorrer no período menos as que ocorreram).

### Problema 2: Falta explicação do que cada métrica significa
Os KPIs "Agendamentos" e "R1 Agendada" medem coisas diferentes por design, mas sem explicação o usuário fica confuso.

### Correções

**1. Migration SQL** — Corrigir no_shows na RPC:
```sql
'no_shows', GREATEST(0, COALESCE(r1_agendada, 0) - COALESCE(r1_realizada, 0))
```

**2. `src/components/sdr/SdrDetailKPICards.tsx`** — Adicionar tooltip em cada card:
- **Agendamentos**: "Leads agendados pelo SDR neste período (pela data de criação do agendamento)"
- **R1 Agendada**: "Reuniões marcadas PARA este período (pela data da reunião)"
- **R1 Realizada**: "Reuniões que de fato aconteceram no período"
- **No-Show**: "Reuniões agendadas para o período que não ocorreram (R1 Agendada − R1 Realizada)"
- **Contratos Pagos**: "Contratos pagos no período"

Usar `Tooltip` do Radix para exibir a explicação ao hover no título do card.

