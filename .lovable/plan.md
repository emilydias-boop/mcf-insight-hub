

## Auditoria Completa: BU Incorporador

### ERROS DE BUILD (Urgente)

3 arquivos com `NodeJS.Timeout` que não compila no browser:
- `src/contexts/TwilioContext.tsx` (linha 94)
- `src/hooks/useMeetingReminders.ts` (linha 11)
- `src/hooks/useQualification.ts` (linha 27)

**Correção**: Trocar `NodeJS.Timeout` por `ReturnType<typeof setTimeout>`.

---

### HOOKS MORTOS (Código em excesso)

3 hooks que **nunca são importados** por nenhum componente — código morto que polui o projeto:

| Hook | Motivo |
|------|--------|
| `useIncorporadorGrossMetrics.ts` | Duplica exatamente o que `useSetoresDashboard` já calcula (bruto semanal/mensal/anual). Ninguém importa. |
| `useIncorporador50k.ts` | Lógica legada de filtrar produtos Incorporador. Substituída pela RPC `get_hubla_transactions_by_bu`. Ninguém importa. |
| `useIncorporadorTransactions.ts` | Usa RPC `get_incorporador_transactions` (legada). A página de Vendas usa `useTransactionsByBU`. Ninguém importa. |

**Correção**: Deletar os 3 arquivos.

---

### BUG DE CÁLCULO: `reference_price` ausente no Ultrameta

**`src/hooks/useUltrametaByBU.ts`** (linhas 96-101): Ao montar o objeto `transaction` para calcular o bruto do Incorporador, **não inclui `reference_price`**:

```js
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
  // ← FALTA: reference_price: t.reference_price,
};
```

A RPC `get_all_hubla_transactions` **retorna** `reference_price`, mas ele é ignorado. Consequência: o cálculo do bruto na Home (Visão Chairman/4 Moons) cai na Regra 6 (fallback hardcoded) em vez de usar o preço autoritativo do banco (Regra 5). Pode causar divergência entre o valor na Home vs. no Dashboard do Diretor (que usa `useSetoresDashboard`, que passa `t` diretamente e inclui `reference_price`).

**Correção**: Adicionar `reference_price: t.reference_price` ao objeto.

---

### BUG DE CÁLCULO: `reference_price` ausente no `useTeamRevenueByMonth`

Mesmo problema no hook de faturamento por mês do fechamento (linha 46-50):

```js
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
  reference_price: t.reference_price, // ← este existe, OK
};
```

Este hook **já inclui** `reference_price` — está correto. Apenas confirmo que não há problema aqui.

---

### PERFORMANCE: N+1 queries no `fetchComissao` do Dashboard

**`src/hooks/useSetoresDashboard.ts`** (linhas 156-167): Para calcular comissões do Efeito Alavanca, faz **1 query por card** de consórcio:

```js
for (const card of cards) {
  const { data: installments } = await supabase
    .from('consortium_installments')
    .select('valor_comissao')
    .eq('card_id', card.id);
}
```

Se houver 50 cards no mês, são 50 queries sequenciais. Isso trava o carregamento do Dashboard.

**Correção**: Fazer uma única query com `.in('card_id', cardIds)` em vez do loop.

---

### CÓDIGO HARDCODED: Export de Parcerias com datas fixas

**`src/pages/bu-incorporador/TransacoesIncorp.tsx`** (linhas 257-258):

```js
.gte('sale_date', '2026-02-01')
.lt('sale_date', '2026-02-20')
```

O botão "Exportar Parcerias" tem datas hardcoded de Fevereiro 2026 e o filename é `parcerias-fevereiro-2026.csv`. Isso foi claramente um uso pontual que ficou no código.

**Correção**: Remover o botão ou fazer usar os filtros de data ativos da página.

---

### RESUMO DAS CORREÇÕES

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `TwilioContext.tsx`, `useMeetingReminders.ts`, `useQualification.ts` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| 2 | `useIncorporadorGrossMetrics.ts` | Deletar (código morto) |
| 3 | `useIncorporador50k.ts` | Deletar (código morto) |
| 4 | `useIncorporadorTransactions.ts` | Deletar (código morto) |
| 5 | `useUltrametaByBU.ts` | Adicionar `reference_price: t.reference_price` |
| 6 | `useSetoresDashboard.ts` | Refatorar `fetchComissao` para query única |
| 7 | `TransacoesIncorp.tsx` | Remover botão/função `handleExportParcerias` hardcoded |

