---
name: Pendentes Arithmetic Closure
description: O total de Pendentes/Sem Desfecho fecha a aritmética com R1 Agendada via campo calculado no RPC.
type: feature
---

Em `get_sdr_metrics_from_agenda` o campo `pendentes` é calculado por aritmética:

```
pendentes = GREATEST(r1_agendada - r1_realizada - no_shows, 0)
```

Isso garante que **Realizadas + No-Show + Pendentes = R1 Agendada** sempre, eliminando "leads no limbo" (status `scheduled`/`invited`/`rescheduled` sem dedup compatível).

O frontend (`ReunioesEquipe.tsx`) usa esse total via `pendentesTotalRpc` somando do `filteredBySDR`. Os sub-buckets (futuras/vencidas/canceladas) continuam calculados localmente em `computePendentesBreakdown`, mas qualquer diferença (RPC > local) é jogada em "vencidas" via `pendentesBreakdownReconciled`.

Status `scheduled` foi adicionado ao `sem_status_per_lead` do RPC para SDRs que esquecem de marcar desfecho.
