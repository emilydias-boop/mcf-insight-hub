
# Plano: Corrigir Valor Base dos Indicadores para Usar Pesos das Métricas Ativas

## Problema Identificado

Na tela de fechamento individual, o **valor base exibido** está mostrando R$ 300,00 (valor fixo antigo do `compPlan`) ao invés de calcular dinamicamente baseado nos **novos pesos** configurados nas Métricas Ativas.

| Métrica | Peso Configurado | Base Esperado | Base Exibido |
|---------|------------------|---------------|--------------|
| Agendamentos | 35.19% | R$ 422,28 | R$ 300,00 ❌ |
| Realizadas | 35.19% | R$ 422,28 | R$ 300,00 ❌ |
| Tentativas | 14.81% | R$ 177,72 | R$ 300,00 ❌ |
| Organização | 14.81% | R$ 177,72 | R$ 300,00 ❌ |

### Causa Raiz

No arquivo `DynamicIndicatorCard.tsx`, linha 144:
```typescript
// CÓDIGO ATUAL (errado)
const valorBase = compPlan ? (compPlan as any)[config.compPlanValueField] || 0 : 0;
```

O sistema busca valores fixos do `compPlan` (R$ 300 cada = 25% × R$ 1.200), **ignorando completamente** o `peso_percentual` configurado nas Métricas Ativas.

## Solução

Alterar a lógica para calcular o `valorBase` dinamicamente usando o peso da métrica ativa, da mesma forma que já funciona para métricas com `isDynamicCalc` (como "Contratos"):

```typescript
// CÓDIGO CORRIGIDO
const baseVariavel = variavelTotal || compPlan?.variavel_total || 1200;
const pesoPercent = metrica.peso_percentual || 25;
const valorBase = baseVariavel * (pesoPercent / 100);
```

### Fórmula

```text
Valor Base = Variável Total × (Peso % ÷ 100)
```

Para Carol (Variável = R$ 1.200):
- **Agendamentos**: 1200 × 35.19% = R$ 422,28 ✅
- **Realizadas**: 1200 × 35.19% = R$ 422,28 ✅
- **Tentativas**: 1200 × 14.81% = R$ 177,72 ✅
- **Organização**: 1200 × 14.81% = R$ 177,72 ✅

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/fechamento/DynamicIndicatorCard.tsx` | Alterar linhas 140-144 para calcular `valorBase` usando `metrica.peso_percentual` |

## Mudança de Código

**Antes (linhas 139-144):**
```typescript
// For metrics that use SdrIndicatorCard (have payout percentage fields)
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  const pct = (payout as any)[config.payoutPctField] || 0;
  const mult = (payout as any)[config.payoutMultField] || 0;
  const valorFinal = (payout as any)[config.payoutValueField] || 0;
  const valorBase = compPlan ? (compPlan as any)[config.compPlanValueField] || 0 : 0;
```

**Depois:**
```typescript
// For metrics that use SdrIndicatorCard (have payout percentage fields)
if (config.payoutPctField && config.payoutMultField && config.payoutValueField) {
  const pct = (payout as any)[config.payoutPctField] || 0;
  const mult = (payout as any)[config.payoutMultField] || 0;
  const valorFinal = (payout as any)[config.payoutValueField] || 0;
  
  // Calculate valorBase dynamically from peso_percentual
  const baseVariavel = variavelTotal || compPlan?.variavel_total || 1200;
  const pesoPercent = metrica.peso_percentual || 25;
  const valorBase = baseVariavel * (pesoPercent / 100);
```

## Resultado Esperado

Após a correção, os cards de indicadores exibirão:

| Métrica | Exibição |
|---------|----------|
| Agendamentos | "R$ 422,28 × 1" = R$ 422,28 |
| Realizadas | "R$ 422,28 × 0.7" = R$ 295,60 |
| Tentativas | "R$ 177,72 × 0.5" = R$ 88,86 |
| Organização | "R$ 177,72 × 1" = R$ 177,72 |
