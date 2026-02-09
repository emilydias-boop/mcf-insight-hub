

# Corrigir Bruto no Detalhamento de Parcerias

## Problema

Na tabela "Detalhamento de Parcerias", o bruto usa `getDeduplicatedGross` com `globalFirstIds`, que zera o valor de transacoes que nao sao a primeira do grupo cliente+produto. Exemplo: 3 vendas A009 mostram bruto de R$ 19.500 em vez de R$ 58.500 (3 x 19.500).

O KPI totalizador de Parcerias deve manter a logica deduplicated (consistente com o dashboard), mas a **tabela de breakdown** precisa mostrar o bruto individual de cada venda para dar visibilidade real ao gestor.

## Solucao

Na tabela de Detalhamento de Parcerias, usar `getDeduplicatedGross` com `isFirstOfGroup = true` para cada transacao (ignorando a deduplicacao global), garantindo que cada venda parcela 1 contribua com seu preco de referencia.

Isso afeta apenas a tabela de breakdown — os KPI cards continuam usando a logica deduplicated global.

## Secao Tecnica

### Arquivo a Modificar

`src/components/relatorios/CloserRevenueDetailDialog.tsx`

### Mudanca Especifica

Linhas 152-159 — no loop do `parceriaMap`, trocar o calculo do gross de:

```text
existing.gross += getDeduplicatedGross(tx as any, globalFirstIds.has(tx.id));
```

Para:

```text
existing.gross += getDeduplicatedGross(tx as any, true);
```

Ao passar `true` como `isFirstOfGroup`, cada transacao parcela 1 contribuira com seu preco de referencia, sem ser zerada pela deduplicacao global. Transacoes com parcela > 1 continuam zeradas (regra interna do `getDeduplicatedGross`).

### Resultado

- A009 com 3 vendas: Bruto = R$ 58.500 (3 x 19.500) em vez de R$ 19.500
- "Parceria" com 17 vendas: Bruto reflete a soma dos precos de referencia de cada venda individual
- KPI cards permanecem inalterados (usam logica deduplicated)

