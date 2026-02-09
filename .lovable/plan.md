

# Corrigir Bruto de Parcerias no KPI Card

## Problema

O fix anterior corrigiu apenas a tabela de detalhamento de parcerias (parceriaMap), mas o KPI card "Parcerias" ainda usa `calcGross()` que aplica deduplicacao global via `globalFirstIds.has(tx.id)`. Por isso o card mostra R$ 39.000 em vez do valor real.

## Solucao

Calcular o bruto de parcerias separadamente, sem deduplicacao global (passando `true` como `isFirstOfGroup`), igual ao que ja foi feito na tabela de breakdown.

## Secao Tecnica

### Arquivo: `src/components/relatorios/CloserRevenueDetailDialog.tsx`

### Mudanca

Linha 120 — trocar o calculo de `parceriasGross` de:

```text
const parceriasGross = calcGross(parcerias);
```

Para:

```text
const parceriasGross = parcerias.reduce(
  (s, t) => s + getDeduplicatedGross(t as any, true), 0
);
```

Isso faz com que o KPI card "Parcerias" mostre o bruto individual de cada venda (sem zerar duplicatas), consistente com a tabela de detalhamento abaixo dele.

O `calcGross` original (com deduplicacao) continua sendo usado para contratos e total, mantendo a consistencia com o dashboard.

