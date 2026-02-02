
# Plano: Corrigir Métricas de Fechamento para Closers

## Diagnóstico Completo

Analisando a tela de Thayna (Janeiro 2026), identifiquei **5 problemas** que causam o não funcionamento:

| Problema | Causa Raiz | Impacto |
|----------|------------|---------|
| **1. Contratos Pagos = 0** | O campo `kpi.intermediacoes_contrato` não está sendo preenchido com dados da Agenda | Card mostra "Realizado: 0" quando deveria mostrar **72** |
| **2. Multiplicador = 0x** | Com "Realizado: 0", o cálculo `pct = 0/meta × 100 = 0%` → multiplicador 0x | Valor final sempre R$ 0,00 |
| **3. No-Show não aparece** | Métricas fallback de Closer não incluem `no_show` | Indicador de No-Show não é renderizado |
| **4. Vendas Parceria = 0** | `vendasParceria` não é passado do Detail para os indicadores | Card mostra 0 em vez de dados reais |
| **5. iFood Ultrameta = R$ 0,00** | Sem `compPlan` vigente, o sistema não calcula iFood | Closer não vê o valor disponível |

## Dados Reais (Janeiro 2026)

Consulta direta no banco mostra para **Thayna**:
- **Contratos Pagos na Agenda:** 72 (via `meeting_slot_attendees` com status `contract_paid`)
- **R1 Realizadas:** 83
- **No-Shows:** 12

A informação existe mas não está chegando ao componente de indicadores!

---

## Solução Técnica

### A) Criar hook para métricas de Closer baseadas na Agenda

**Novo arquivo:** `src/hooks/useCloserAgendaMetrics.ts`

O closer é identificado pelo email na tabela `sdr` → busca `closer_id` na tabela `closers` → conta attendees.

```typescript
// Lógica:
// 1. Busca closer_id pelo email do SDR
// 2. Conta reuniões em meeting_slots com esse closer_id no período
// 3. Conta contract_paid, no_show, completed
// 4. Conta vendas_parceria de hubla_transactions com linked_attendee vinculado

export interface CloserAgendaMetrics {
  r1_alocadas: number;        // Total de slots alocados ao closer
  r1_realizadas: number;      // completed + contract_paid + refunded
  contratos_pagos: number;    // contract_paid + refunded
  no_shows: number;           // status = no_show
  vendas_parceria: number;    // hubla_transactions com product_category='parceria' linkadas
}
```

### B) Modificar Detail.tsx para buscar métricas de Closer corretamente

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

Adicionar chamada ao novo hook quando `isCloser === true`:

```typescript
// Buscar métricas específicas de Closer
const closerMetrics = useCloserAgendaMetrics(
  isCloser ? payout?.sdr_id : undefined, 
  payout?.ano_mes
);

// Criar um KPI "virtual" que combina dados existentes com métricas do Closer
const effectiveKpi = isCloser && closerMetrics.data 
  ? {
      ...kpi,
      reunioes_realizadas: closerMetrics.data.r1_realizadas,
      no_shows: closerMetrics.data.no_shows,
      intermediacoes_contrato: closerMetrics.data.contratos_pagos,
    }
  : kpi;
```

### C) Adicionar `no_show` às métricas default de Closer

**Arquivo:** `src/hooks/useActiveMetricsForSdr.ts`

O `DEFAULT_CLOSER_METRICS` atual não inclui `no_show`. Corrigir:

```typescript
const DEFAULT_CLOSER_METRICS: Partial<ActiveMetric>[] = [
  { nome_metrica: 'realizadas', label_exibicao: 'R1 Realizadas', peso_percentual: 35, fonte_dados: 'agenda' },
  { nome_metrica: 'contratos', label_exibicao: 'Contratos Pagos', peso_percentual: 35, fonte_dados: 'agenda' },
  { nome_metrica: 'no_show', label_exibicao: 'Taxa No-Show', peso_percentual: 0, fonte_dados: 'agenda' }, // ← ADICIONAR
  { nome_metrica: 'organizacao', label_exibicao: 'Organização', peso_percentual: 20, fonte_dados: 'manual' },
  { nome_metrica: 'vendas_parceria', label_exibicao: 'Vendas Parceria', peso_percentual: 10, fonte_dados: 'hubla' },
];
```

### D) Passar métricas de Closer ao DynamicIndicatorsSection

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

O `DynamicIndicatorsSection` recebe `kpi` mas para Closers precisa de dados diferentes:

```typescript
<DynamicIndicatorsSection
  sdrId={payout.sdr_id}
  anoMes={payout.ano_mes}
  kpi={effectiveKpi}  // ← KPI com dados de Closer
  payout={payout}
  compPlan={compPlan}
  diasUteisMes={diasUteisMes}
  sdrMetaDiaria={sdrMetaDiaria}
  isCloser={isCloser}
  variavelTotal={effectiveVariavel}
/>
```

### E) Corrigir cálculo de iFood quando não há compPlan

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

Usar `cargo_catalogo.ifood_mensal` como fallback:

```typescript
// iFood com fallback
const effectiveIfoodMensal = payout.ifood_mensal || compPlan?.ifood_mensal || employee?.cargo_catalogo?.ifood_mensal || 600;
const effectiveIfoodUltrameta = payout.ifood_ultrameta || compPlan?.ifood_ultrameta || employee?.cargo_catalogo?.ifood_ultrameta || 0;
```

### F) Atualizar KpiEditForm para usar dados reais do Closer

**Arquivo:** `src/components/sdr-fechamento/KpiEditForm.tsx`

O campo de "Contratos Pagos" atualmente mostra `intermediacoes` que vem do prop, mas não usa os dados da Agenda:

```typescript
// Para Closers, usar dados da Agenda diretamente
const contratosRealizados = isCloser && agendaMetrics.data 
  ? agendaMetrics.data.contratos 
  : intermediacoes;
```

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/hooks/useCloserAgendaMetrics.ts` | **CRIAR** | Hook para buscar contratos, realizadas e no-shows via meeting_slots |
| `src/hooks/useActiveMetricsForSdr.ts` | Modificar | Adicionar `no_show` ao `DEFAULT_CLOSER_METRICS` |
| `src/pages/fechamento-sdr/Detail.tsx` | Modificar | Integrar `useCloserAgendaMetrics` e criar `effectiveKpi` |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Modificar | Usar dados da Agenda para mostrar contratos em vez do prop `intermediacoes` |
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Verificar | Confirmar que lê `kpi.intermediacoes_contrato` corretamente |

---

## Fluxo de Dados Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELA DE FECHAMENTO - CLOSER (Thayna)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Detail.tsx detecta isCloser = true                                      │
│                                                                             │
│  2. Chama useCloserAgendaMetrics(sdrId, '2026-01')                          │
│     ↳ Busca closer_id pelo email de Thayna                                  │
│     ↳ Conta meeting_slot_attendees com status contract_paid: 72             │
│     ↳ Conta no_show: 12                                                     │
│     ↳ Conta realizadas (completed+contract_paid+refunded): 83               │
│     ↳ Conta vendas_parceria de hubla_transactions: X                        │
│                                                                             │
│  3. Cria effectiveKpi = { ...kpi, intermediacoes_contrato: 72, ... }        │
│                                                                             │
│  4. DynamicIndicatorCard recebe effectiveKpi                                │
│     ↳ kpiValue = kpi.intermediacoes_contrato = 72                           │
│     ↳ meta = 1/dia × 20 dias = 20                                           │
│     ↳ pct = 72/20 × 100 = 360%                                              │
│     ↳ mult = 1.5x (> 120%)                                                  │
│     ↳ valorBase = R$ 2.400 × 35% = R$ 840                                   │
│     ↳ valorFinal = R$ 840 × 1.5 = R$ 1.260                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Regra de iFood Ultrameta para Closers (Incorporador)

Conforme esclarecido: o iFood Ultrameta fica **disponível para colaboradores de Incorporador** quando batem a ultrameta (média >= 100% nas métricas ativas).

O cálculo atual já suporta isso via `avgPerformance >= 100`. A correção é garantir que:
1. O compPlan/cargo_catalogo tenha os valores de iFood configurados
2. O cálculo use os valores corretos do variável

---

## Resultado Esperado

Para **Thayna (Closer N2)** após a correção:

| Métrica | Antes | Depois |
|---------|-------|--------|
| **Contratos Pagos** | Realizado: 0 | Realizado: **72** |
| **Multiplicador** | 0x | **1.5x** (360% da meta) |
| **Valor Contratos** | R$ 0,00 | **R$ 1.260,00** |
| **No-Shows** | Não aparece | Aparece com **12** |
| **Vendas Parceria** | 0 | Dados reais da Hubla |
| **iFood Ultrameta** | R$ 0,00 | Calculado se elegível |
