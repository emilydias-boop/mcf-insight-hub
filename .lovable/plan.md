

# Fix: Transações manuais não contam no Bruto e Líquido

## Problema identificado

As transações adicionadas manualmente (source='manual') possuem `linked_attendee_id` que aponta para reuniões R2 de semanas anteriores. O sistema calcula `is_extra = true` para essas vendas, e o KPI "Bruto (Semana)" **exclui** todas as extras:

```js
const vendasNormais = vendas.filter(v => !v.is_extra && !v.excluded_from_cart);
const brutoTotal = vendasNormais.reduce((sum, v) => sum + getDeduplicatedGross(v), 0);
```

As 3 transações manuais da semana (WANDER, Guilherme, Paulo Henrique) são todas extras, então R$ 42.500 de bruto e seus líquidos são excluídos do KPI.

## Correção

### Arquivo: `src/components/crm/R2VendasList.tsx` (~linha 102)

Alterar o cálculo de `totals` para incluir **todas** as vendas no Bruto e Líquido, separando apenas a contagem de "Vendas da Semana" vs "Extras":

```js
// Bruto: incluir TODAS as vendas não excluídas (normais + extras)
const vendasAtivas = vendas.filter(v => !v.excluded_from_cart);
const brutoTotal = vendasAtivas.reduce((sum, v) => sum + getDeduplicatedGross(v), 0);

// Contagem separada para os cards
const vendasNormais = vendas.filter(v => !v.is_extra && !v.excluded_from_cart);
const vendasExtras = vendas.filter(v => v.is_extra && !v.excluded_from_cart);

// Líquido: todas as vendas (já estava correto, mas garantir)
const liquidoTotal = vendasAtivas.reduce((sum, v) => sum + (v.net_value || 0), 0);
```

Isso garante que transações manuais (e extras em geral) contribuam para Bruto e Líquido. A contagem "Vendas da Semana" e "Vendas Extras" permanece separada.

