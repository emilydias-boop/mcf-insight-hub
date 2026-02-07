
# Corrigir Cálculo do Variável - Soma dos Indicadores

## Problema Identificado

O card "Variável" exibe `payout.valor_variavel_total` (valor salvo no banco pela edge function), mas os indicadores de meta (DynamicIndicatorsGrid) recalculam os valores localmente. Como usam lógicas ou dados ligeiramente diferentes, os valores não batem:

| Componente | Valor Exibido | Fonte |
|------------|---------------|-------|
| Card Variável | R$ 1.040 | `payout.valor_variavel_total` (banco) |
| Indicadores | R$ 350 + R$ 350 + R$ 0 + R$ 200 = R$ 900 | Cálculo local |

## Solução

Modificar o card "Variável" para exibir a **soma calculada dos valores finais dos indicadores**, garantindo consistência visual entre o resumo e os cards de indicadores.

## Arquivos a Alterar

### 1. src/pages/fechamento-sdr/Detail.tsx

**Mudança:** Criar uma função helper que calcula o variável usando a mesma lógica do `DynamicIndicatorCard`, e usar esse valor no card "Variável".

**Antes (linha 408):**
```tsx
{formatCurrency(payout.valor_variavel_total || effectiveVariavel)}
```

**Depois:**
```tsx
{formatCurrency(calculatedVariavel)}
```

**Nova lógica:** Calcular `calculatedVariavel` somando os valores finais de cada indicador:
- Para cada métrica ativa:
  - Calcular porcentagem com base no KPI e meta ajustada
  - Obter multiplicador da faixa
  - Calcular valor base (peso % × variável total)
  - Valor final = base × multiplicador
- Somar todos os valores finais

### 2. Criar hook/helper para cálculo consistente

Extrair a lógica de cálculo do variável para um hook reutilizável que:
- Recebe as métricas ativas, KPI, compPlan e dias úteis
- Calcula cada indicador usando a mesma lógica do DynamicIndicatorCard
- Retorna a soma dos valores finais

```typescript
function useCalculatedVariavel(
  metricas: ActiveMetric[],
  kpi: SdrMonthKpi | null,
  compPlan: SdrCompPlan | null,
  diasUteisMes: number,
  sdrMetaDiaria: number,
  variavelTotal: number
): number {
  // Para cada métrica, calcular valor final igual ao DynamicIndicatorCard
  // Retornar soma
}
```

## Fluxo do Cálculo

```text
┌─────────────────────────────────────────────────────────────┐
│ Para cada métrica ativa:                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Obter valor realizado do KPI (kpi[kpiField])            │
│ 2. Calcular meta ajustada (baseado no tipo de métrica)     │
│ 3. pct = (realizado / metaAjustada) × 100                  │
│ 4. mult = getMultiplier(pct)                               │
│ 5. valorBase = variavelTotal × (peso% / 100)               │
│ 6. valorFinal = valorBase × mult                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ VARIÁVEL = Σ valorFinal de todas as métricas               │
└─────────────────────────────────────────────────────────────┘
```

## Exemplo com Jessica Martins

| Indicador | Realizado | Meta | % | Mult | Base | Valor Final |
|-----------|-----------|------|---|------|------|-------------|
| Agendamentos | 169 | 200 | 84.5% | 0.5x | R$ 700 | R$ 350 |
| Realizadas | 110 | 140 | 78.6% | 0.5x | R$ 700 | R$ 350 |
| Tentativas | 1.158 | 1.680 | 68.9% | 0x | R$ 200 | R$ 0 |
| Organização | 100 | 100 | 100% | 1x | R$ 200 | R$ 200 |
| **TOTAL** | | | | | | **R$ 900** |

## Impacto

- O card "Variável" sempre corresponderá à soma dos valores verdes dos indicadores
- Consistência visual total entre resumo e indicadores
- O "Total Conta" também será atualizado (Fixo + Variável calculado)

## Observação Importante

O valor salvo no banco (`payout.valor_variavel_total`) continuará sendo calculado pela edge function. A mudança é apenas na **exibição** para garantir consistência visual. Se desejar que o banco também use essa lógica, a edge function precisará ser ajustada em uma etapa futura.
