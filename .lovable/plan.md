

## Vendas desaparecem — timezone gap entre startOfDay (BRT) e sale_date (UTC)

### Causa raiz

As transações do Make são gravadas com `sale_date = 2026-03-27T00:00:00.000Z` (meia-noite **UTC**).

A janela `vendasParceria.start` usa `startOfDay()` do date-fns, que cria meia-noite no fuso **local** (BRT = UTC-3). Convertido para ISO, isso vira `2026-03-27T03:00:00.000Z`.

```text
Transação Make:   2026-03-27T00:00:00Z  (meia-noite UTC)
Janela vendas:    2026-03-27T03:00:00Z  → 2026-03-31T02:59:59Z
                  ↑ 3 horas depois!
```

Resultado: todas as transações com `sale_date` entre 00:00 e 02:59 UTC (= 21:00-23:59 BRT do dia anterior) ficam fora da janela. As vendas editadas pelo usuário mantiveram o `sale_date = 00:00:00Z` original do Make, caindo nesse buraco.

### Solução

No `carrinhoWeekBoundaries.ts`, criar a data de início da janela de vendas usando **UTC explícito** em vez de `startOfDay` (que usa fuso local):

```typescript
// Antes (cria meia-noite BRT = 03:00 UTC):
const friCartStart = startOfDay(addDays(new Date(weekEnd), 2));

// Depois (cria meia-noite UTC = 00:00 UTC):
const friDate = addDays(new Date(weekEnd), 2);
const friCartStartUTC = new Date(Date.UTC(friDate.getFullYear(), friDate.getMonth(), friDate.getDate(), 0, 0, 0, 0));
```

Mesma correção para `monAfterCart` (fim da janela), e para outras boundaries que usam `startOfDay`/`endOfDay` com datas que serão comparadas com timestamps UTC do banco.

### Impacto

Todas as 11+ transações do Make com `sale_date` à meia-noite UTC voltam a aparecer na aba Vendas. Vendas editadas não desaparecem mais.

### Arquivo alterado
1. `src/lib/carrinhoWeekBoundaries.ts` — usar Date.UTC para todas as boundaries

