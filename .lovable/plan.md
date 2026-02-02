
# Plano: Corrigir Métricas de Fechamento para Closers

## ✅ Status: IMPLEMENTADO

---

## Correções Aplicadas

### A) ✅ Hook useCloserAgendaMetrics.ts criado
Busca métricas específicas do Closer via meeting_slots:
- `r1_realizadas`: completed + contract_paid + refunded
- `contratos_pagos`: contract_paid + refunded  
- `no_shows`: status = no_show
- `vendas_parceria`: hubla_transactions com product_category='parceria'

### B) ✅ no_show adicionado ao DEFAULT_CLOSER_METRICS
Arquivo `src/hooks/useActiveMetricsForSdr.ts` atualizado para incluir `no_show` com peso 0%.

### C) ✅ Detail.tsx integrado com métricas de Closer
- Importa `useCloserAgendaMetrics`
- Cria `effectiveKpi` combinando KPI do banco com dados da Agenda para Closers
- Passa `vendasParceria` ao KpiEditForm
- `DynamicIndicatorsSection` recebe `effectiveKpi`

### D) ✅ isDynamicCalc para contratos e vendas_parceria
O `DynamicIndicatorCard` calcula dinamicamente valorBase, meta, pct, multiplicador e valorFinal usando `variavelTotal` do cargo.

---

## Fluxo Corrigido

```text
Detail.tsx detecta isCloser = true
        ↓
useCloserAgendaMetrics(sdrId, anoMes)
  ↳ Busca closer_id pelo email
  ↳ Conta contratos_pagos: N
  ↳ Conta no_shows: M
  ↳ Conta r1_realizadas: X
        ↓
effectiveKpi = { ...kpi, intermediacoes_contrato: N, no_shows: M, reunioes_realizadas: X }
        ↓
DynamicIndicatorCard recebe effectiveKpi
  ↳ kpiValue = N
  ↳ meta = meta_valor × diasUteis
  ↳ pct = N / meta × 100
  ↳ mult = getMultiplier(pct)
  ↳ valorFinal = valorBase × mult
```

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useCloserAgendaMetrics.ts` | **CRIADO** - Hook para buscar métricas do Closer |
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionado `no_show` ao DEFAULT_CLOSER_METRICS |
| `src/pages/fechamento-sdr/Detail.tsx` | Integrado useCloserAgendaMetrics, effectiveKpi, vendasParceria |
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Já suporta isDynamicCalc para contratos |

---

## Resultado Esperado

Para **Closers** após a correção:

| Métrica | Comportamento |
|---------|---------------|
| **Contratos Pagos** | Mostra dados da Agenda (status contract_paid + refunded) |
| **Multiplicador** | Calculado dinamicamente baseado no % de atingimento |
| **No-Shows** | Aparece como indicador separado |
| **Vendas Parceria** | Mostra quantidade de hubla_transactions parceria |
| **R1 Realizadas** | Dados do Closer (completed + contract_paid + refunded) |
