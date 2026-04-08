

# Corrigir cálculo dos indicadores na visão do SDR (Meu Fechamento)

## Problema

Os valores base dos indicadores estão errados na tela "Meu Fechamento" do SDR porque o componente `SdrFechamentoView` usa `payout.valor_variavel_total` (o resultado já calculado, R$996) como base para os indicadores, quando deveria usar `compPlan.variavel_total` (o valor base do plano de compensação, R$1200).

| Indicador | Admin (correto) | SDR (errado) |
|---|---|---|
| Agendamentos R1 (30%) | R$360 (1200×30%) | R$298.80 (996×30%) |
| R1 Realizadas (40%) | R$480 (1200×40%) | R$398.40 (996×40%) |
| Contratos (20%) | R$240 (1200×20%) | R$199.20 (996×20%) |
| Tentativas (10%) | R$120 (1200×10%) | R$99.60 (996×10%) |

## Causa raiz

`SdrFechamentoView` (linha 26): `variavelTotal = payout.valor_variavel_total` usa o valor de saída como entrada.

O Detail.tsx (admin) usa corretamente: `compPlan?.variavel_total || 1200`.

## Solução

| Arquivo | Alteração |
|---|---|
| `src/pages/fechamento-sdr/MeuFechamento.tsx` | Extrair `compPlan` do `useOwnFechamento` e passá-lo ao `SdrFechamentoView` e `CloserFechamentoView` |
| `src/components/fechamento/SdrFechamentoView.tsx` | Adicionar prop `compPlan` e usar `compPlan?.variavel_total` como base em vez de `payout.valor_variavel_total` |
| `src/components/fechamento/CloserFechamentoView.tsx` | Mesma correção para closers |

### Detalhe da mudança em SdrFechamentoView

```typescript
// Antes (linha 26):
const variavelTotal = payout.valor_variavel_total || 0;

// Depois:
const variavelTotal = compPlan?.variavel_total || payout.sdr?.meta_diaria ? 1200 : 400;
```

Passando `compPlan` como prop, o cálculo fica idêntico ao da tela admin: base fixa do plano de compensação multiplicada pelos pesos e multiplicadores de performance.

