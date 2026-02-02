
# Plano: Corrigir Multiplicador e Fonte de Contratos para Closers

## Problemas Identificados

### Problema 1: Card de "Contratos Pagos" não mostra multiplicador
No `METRIC_CONFIG`, a métrica "contratos" não tem configuração de payout:
```typescript
contratos: {
  icon: 'FileCheck',
  color: 'green',
  kpiField: 'intermediacoes_contrato',
  isAuto: true,
  autoSource: 'Hubla',  // ← Deveria ser 'Agenda'
  // ⚠️ FALTAM: payoutPctField, payoutMultField, payoutValueField, compPlanValueField
}
```

Como resultado, o `DynamicIndicatorCard` renderiza um card simples sem multiplicador.

### Problema 2: Contratos mostram 0 mesmo com dados na Agenda
- O `KpiEditForm` mostra "Agenda: 5" (dados vindos de `useSdrAgendaMetricsBySdrId`)
- Mas o campo `intermediacoes_contrato: 0` no `sdr_month_kpi` não está sendo atualizado
- O valor da Agenda não está sendo usado no cálculo

### Problema 3: Valores zerados no Payout
O banco mostra:
- `valor_variavel_total: 0`
- `valor_organizacao: 0` (apesar de `mult_organizacao: 1` e `pct_organizacao: 100`)

O cálculo dinâmico não está usando o `variavel_total` correto do `cargo_catalogo` (R$ 2.400) quando não há `sdr_comp_plan` vigente para janeiro.

---

## Solução

### A) Adicionar configuração completa para métrica "contratos"

**Arquivo:** `src/hooks/useActiveMetricsForSdr.ts`

Adicionar campos de payout para "contratos":

```typescript
contratos: {
  icon: 'FileCheck',
  color: 'green',
  kpiField: 'intermediacoes_contrato',
  payoutPctField: 'pct_contratos',        // Novo
  payoutMultField: 'mult_contratos',      // Novo
  payoutValueField: 'valor_contratos',    // Novo
  compPlanValueField: 'valor_contratos',  // Novo (usar peso dinâmico)
  isAuto: true,
  autoSource: 'Agenda',  // Corrigir de 'Hubla' para 'Agenda'
}
```

### B) Atualizar DynamicIndicatorCard para suportar contratos

**Arquivo:** `src/components/fechamento/DynamicIndicatorCard.tsx`

Adicionar tratamento especial para métricas sem campos legacy de payout (como "contratos"):

```typescript
// Para métricas dinâmicas sem campos legacy, calcular valores manualmente
if (metrica.nome_metrica === 'contratos' || metrica.nome_metrica === 'vendas_parceria') {
  const variavelTotal = compPlan?.variavel_total || 1200;
  const valorBase = variavelTotal * (metrica.peso_percentual / 100);
  const meta = metrica.meta_valor ? (metrica.meta_valor * diasUteisMes) : 20;
  const realizado = kpiValue;
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const mult = getMultiplier(pct);
  const valorFinal = valorBase * mult;

  return (
    <SdrIndicatorCard
      title={metrica.label_exibicao}
      meta={metrica.meta_valor || 1}
      metaAjustada={meta}
      realizado={realizado}
      pct={pct}
      multiplicador={mult}
      valorBase={valorBase}
      valorFinal={valorFinal}
      isPercentage={false}
      isManual={false}
    />
  );
}
```

### C) Sincronizar dados da Agenda com KPI ao salvar

**Arquivo:** `src/hooks/useSdrKpiMutations.ts`

Modificar `useRecalculateWithKpi` para incluir `intermediacoes_contrato` dos dados da Agenda:

```typescript
// Ao salvar KPI para Closer, buscar contratos da Agenda
if (isCloser && agendaMetrics) {
  kpiData.intermediacoes_contrato = agendaMetrics.contratos;
}
```

### D) Corrigir cálculo quando não há sdr_comp_plan

**Arquivo:** `src/hooks/useSdrFechamento.ts`

No `useRecalculatePayout`, quando não encontra `sdr_comp_plan` vigente, usar dados do `cargo_catalogo`:

```typescript
// Se não encontrar compPlan, usar valores do cargo_catalogo
if (!compPlan) {
  const { data: employee } = await supabase
    .from('employees')
    .select('cargo_catalogo:cargo_catalogo_id(ote_total, fixo_valor, variavel_valor)')
    .eq('sdr_id', sdrId)
    .eq('status', 'ativo')
    .maybeSingle();
  
  if (employee?.cargo_catalogo) {
    // Criar um compPlan sintético a partir do cargo_catalogo
    compPlan = {
      ote_total: employee.cargo_catalogo.ote_total,
      fixo_valor: employee.cargo_catalogo.fixo_valor,
      variavel_total: employee.cargo_catalogo.variavel_valor,
      // ... outros campos com defaults
    };
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useActiveMetricsForSdr.ts` | Adicionar payoutPctField, payoutMultField, etc para "contratos" |
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Calcular valores dinamicamente para métricas sem campos legacy |
| `src/hooks/useSdrFechamento.ts` | Usar cargo_catalogo como fallback quando não há sdr_comp_plan |
| `src/hooks/useSdrKpiMutations.ts` | Sincronizar `intermediacoes_contrato` com dados da Agenda ao salvar |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Passar `contratos` da Agenda para o saveKpi |

---

## Fluxo Corrigido

```text
ANTES (com problemas):
┌──────────────────────────────────────────────────────────────────────┐
│  DynamicIndicatorCard(contratos)                                     │
│    → config.payoutPctField? ❌ (undefined)                           │
│    → Renderiza Card SIMPLES (sem multiplicador)                      │
│    → kpiValue = kpi.intermediacoes_contrato = 0                      │
│    → Mostra apenas "0" e "Peso: 50%"                                 │
└──────────────────────────────────────────────────────────────────────┘

DEPOIS (corrigido):
┌──────────────────────────────────────────────────────────────────────┐
│  DynamicIndicatorCard(contratos)                                     │
│    → metrica.nome_metrica === 'contratos'? ✅                        │
│    → Calcula dinamicamente:                                          │
│        valorBase = 2400 × 50% = R$ 1.200                             │
│        realizado = kpi.intermediacoes_contrato (sincronizado)        │
│        pct = realizado / meta × 100                                  │
│        mult = getMultiplier(pct)                                     │
│        valorFinal = valorBase × mult                                 │
│    → Renderiza SdrIndicatorCard COM multiplicador                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

**Para Thayna (Closer Inside N2) - Janeiro 2026:**

| Métrica | Antes | Depois |
|---------|-------|--------|
| Contratos Pagos | Card simples, sem multiplicador, "0" | Card completo com Meta, Realizado, %, Mult, Valor |
| Multiplicador | Não mostrado | Calculado baseado no % de atingimento |
| Valor Final | Não calculado | `R$ 1.200 × multiplicador` |
| Fonte | "Hubla" | "Agenda" |

**Organização:**
| Campo | Antes | Depois |
|-------|-------|--------|
| Valor Final | R$ 0,00 | R$ 1.200,00 (50% de R$ 2.400 × 1x) |
| Cálculo | Usando compPlan inexistente | Usando cargo_catalogo como fallback |
