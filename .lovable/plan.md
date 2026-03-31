

## Replicar Dashboard de Performance Individual do SDR para Closers

### O que muda

A página de detalhe do Closer (`CloserMeetingsDetailPage`) passará de ter apenas KPI cards + ranking para ter o mesmo layout completo do SDR:
- Filtros de período/comparação/meta
- Resumo automático textual
- KPI Cards com meta, attainment, barra de progresso e comparação
- Projeção do Período (card lateral)
- Funil Individual (R1 Agendada → R1 Realizada → Contratos)
- Gráfico de Evolução Diária (acumulado vs meta)
- Comparação com o Time
- Tabela de Breakdown Diário

### Abordagem técnica

Os componentes visuais do SDR (`SdrProjectionCard`, `SdrFunnelPanel`, `SdrCumulativeChart`, `SdrTeamComparisonPanel`, `SdrDailyBreakdownTable`, `SdrAutoSummary`, `SdrPerformanceFilters`, `SdrDetailKPICards`) já usam interfaces genéricas (`ProjectionData`, `DailyRow`, `MetricWithMeta`). Serão reutilizados diretamente — sem criar componentes duplicados.

### Arquivos a criar

**1. `src/hooks/useCloserPerformanceData.ts`** — Hook central que produz o mesmo shape de `SdrPerformanceData`:
- Consome `useCloserDetailData` (já existente) para métricas base
- Calcula `MetricWithMeta[]` para: R1 Agendada, R1 Realizada, No-Show, Taxa No-Show, Contrato Pago, Outside, Taxa Conversão, R2 Agendada
- Calcula `ProjectionData` baseado em R1 Agendada (meta = reuniões alocadas por dia × dias úteis)
- Calcula `DailyRow[]` agrupando `allLeads` por `scheduled_at` (data da reunião)
- Calcula `funnel` = R1 Agendada → R1 Realizada → Contratos
- Calcula `teamComparison` usando `teamAverages` e `ranking` do `useCloserDetailData`
- Gera `summaryText` automático
- Aceita `comparisonMode` e `metaMode` como o SDR
- Meta diária do closer: derivada de configuração ou fallback (ex: 10 reuniões/dia)

### Arquivos a modificar

**2. `src/pages/crm/CloserMeetingsDetailPage.tsx`** — Refatorar para espelhar `SdrMeetingsDetailPage`:
- Adicionar state de filtros (`comparisonMode`, `metaMode`, `customMeta`)
- Usar `useCloserPerformanceData` em vez de `useCloserDetailData` diretamente
- Renderizar: `SdrPerformanceFilters`, `SdrAutoSummary`, `SdrDetailKPICards` + `SdrProjectionCard`, `SdrFunnelPanel` + `SdrCumulativeChart`, `SdrTeamComparisonPanel`, `SdrDailyBreakdownTable`
- Manter tabs de Leads/No-Shows/R2/Faturamento como estão
- Manter `ManualSaleAttributionDialog`

### Detalhes das métricas do Closer

| Métrica | Valor | Meta |
|---------|-------|------|
| R1 Agendada | `closerMetrics.r1_agendada` | metaDiária × diasÚteis |
| R1 Realizada | `closerMetrics.r1_realizada` | 70% do R1 Agendada real |
| Contratos Pagos | `closerMetrics.contrato_pago` | 30% do R1 Realizada real |
| Taxa Conversão | contratos/realizadas×100 | 30% |
| Taxa No-Show | noshow/agendada×100 | máx 30% (invertido) |
| Outside | `closerMetrics.outside` | sem meta |
| R2 Agendada | `closerMetrics.r2_agendada` | 100% dos contratos |

### Projeção

Baseada em R1 Agendada — mesmo cálculo do SDR (ritmo × dias úteis totais).

### Funil

R1 Agendada → R1 Realizada → Contratos Pagos (3 passos, sem "Novos Leads" pois closer não prospecta).

### Evolução Diária

Agrupa `allLeads` (reuniões do closer) por data de `scheduled_at`, calcula acumulado vs meta acumulada por dia útil.

### Comparação com o Time

Usa `allClosers` do `useCloserDetailData` para calcular médias e ranking em: R1 Realizada, Contrato Pago, Taxa Conversão, Taxa No-Show.

