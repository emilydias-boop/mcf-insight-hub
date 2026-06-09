---
name: Meu Desempenho aligned with Fechamento (Closer)
description: No preset Mês, KPIs de Meu Desempenho Closer usam useCloserAgendaMetrics (mesma fonte do supervisor no Fechamento) para evitar divergências.
type: feature
---
Em `src/pages/closer/MeuDesempenhoCloser.tsx`, quando `datePreset === 'month'` e BU é Incorporador, sobrescrevemos `closerMetrics.r1_realizada`, `noshow`, `contrato_pago` e `r2_agendada` com `useCloserAgendaMetrics({ closerIdOverride: myCloser.id }, anoMes)`. Isso garante paridade com a visão do supervisor no Fechamento (CloserFechamentoView), que também usa essa fonte. `useCloserAgendaMetrics` agora aceita `closerIdOverride` para pular o lookup SDR→email→closer.