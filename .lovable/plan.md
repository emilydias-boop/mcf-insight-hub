

## Análise dos Problemas

### 1. Meta de Contratos Pagos mostrando "22 (1/dia × 22 dias)" em vez de "30% de 50 = 15"

O subtítulo do campo "Contratos Pagos" no formulário KPI mostra a fórmula fixa (`metaContratosDiaria × diasUteis = 22`) em vez da dinâmica (30% das Realizadas = 15).

**Causa raiz (linha 76 de KpiEditForm.tsx):**
```typescript
const realizadasAtual = kpi?.reunioes_realizadas || agendaMetrics.data?.r1_realizada || 0;
```
Este cálculo **não considera** `closerAgendaMetrics?.r1_realizadas`. Como `agendaMetrics` (RPC de SDR) retorna vazio para closers, e `kpi?.reunioes_realizadas` pode estar desatualizado ou zero, o valor pode não refletir o real.

Adicionalmente, é possível que `metaContratosPercentual` esteja vindo como `null`/`0` da tabela `fechamento_metricas_mes` para este closer, fazendo o código cair no fallback fixo (linha 291).

### 2. No-Shows = 24

Os 24 no-shows são uma contagem direta da base de dados: 24 participantes (attendees) com `status = 'no_show'` nos meeting_slots deste closer em março/2026. Não há erro de lógica -- é o dado real registrado na agenda.

Com 50 realizadas e 24 no-shows, a taxa é 24/(50+24) ≈ 32.4% (se considerar agendadas = realizadas + no-shows + pendentes). O número parece plausível.

---

## Correção Proposta

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `KpiEditForm.tsx` (linha 76) | Incluir `closerAgendaMetrics?.r1_realizadas` no cálculo de `realizadasAtual` para closers |

```typescript
// Antes
const realizadasAtual = kpi?.reunioes_realizadas || agendaMetrics.data?.r1_realizada || 0;

// Depois
const realizadasAtual = kpi?.reunioes_realizadas 
  || closerAgendaMetrics?.r1_realizadas 
  || agendaMetrics.data?.r1_realizada 
  || 0;
```

Isso garante que o subtítulo do campo Contratos Pagos use o valor correto de realizadas (50) para calcular a meta dinâmica (30% de 50 = 15), **desde que** `metaContratosPercentual` esteja configurado na tabela `fechamento_metricas_mes`.

Se o problema persistir (subtítulo ainda mostrando fórmula fixa), significa que a configuração de `meta_percentual` para a métrica 'contratos' deste closer/squad/mês não está cadastrada -- seria necessário verificar/cadastrar na aba "Métricas Ativas".

