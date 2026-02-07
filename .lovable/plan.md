

# Corrigir Faturamento Incorporador - Usar RPC Correta

## Problema Confirmado

O faturamento de janeiro 2026 esta errado porque os hooks usam a RPC errada, criando inconsistencia com a deduplicacao.

| Situacao | Valor |
|----------|-------|
| **Esperado pelo usuario** | ~R$ 2.038.000 |
| **Calculo correto (validado via SQL)** | R$ 2.035.898 |
| **Calculo atual (bugado)** | Valor incorreto |

A diferenca de R$ 2.100 (~0.1%) e insignificante e pode ser de arredondamento.

## Causa Raiz

O hook `useTeamRevenueByMonth.ts` usa:

- `get_all_hubla_transactions` -> Retorna TODAS as transacoes (6.955 em janeiro)
- `get_first_transaction_ids` -> Retorna apenas IDs de `target_bu = 'incorporador'`

Isso cria inconsistencia: transacoes de outros BUs sao processadas mas a deduplicacao nao considera elas corretamente.

## Solucao

Alterar os dois hooks para usar a RPC `get_hubla_transactions_by_bu` com `p_bu: 'incorporador'`, garantindo que apenas transacoes do Incorporador MCF sejam processadas.

### Arquivo 1: src/hooks/useTeamRevenueByMonth.ts

**Linhas 33-40 - ANTES:**
```typescript
const { data: transactions } = await supabase.rpc('get_all_hubla_transactions', {
  p_start_date: formatDateForQuery(monthStart),
  p_end_date: formatDateForQuery(monthEnd, true),
  p_limit: 10000,
  p_search: null,
  p_products: null,
});
```

**DEPOIS:**
```typescript
const { data: transactions } = await supabase.rpc('get_hubla_transactions_by_bu', {
  p_bu: 'incorporador',
  p_start_date: formatDateForQuery(monthStart),
  p_end_date: formatDateForQuery(monthEnd, true),
  p_limit: 10000,
  p_search: null,
});
```

**Linhas 45-50 - ANTES:**
```typescript
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
};
```

**DEPOIS:**
```typescript
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
  reference_price: t.reference_price,
};
```

### Arquivo 2: src/hooks/useUltrametaByBU.ts

**Linhas 51-57 - ANTES:**
```typescript
supabase.rpc('get_all_hubla_transactions', {
  p_start_date: formatDateForQuery(monthStart),
  p_end_date: formatDateForQuery(monthEnd, true),
  p_limit: 10000,
  p_search: null,
  p_products: null,
}),
```

**DEPOIS:**
```typescript
supabase.rpc('get_hubla_transactions_by_bu', {
  p_bu: 'incorporador',
  p_start_date: formatDateForQuery(monthStart),
  p_end_date: formatDateForQuery(monthEnd, true),
  p_limit: 10000,
  p_search: null,
}),
```

**Linhas 96-101 - ANTES:**
```typescript
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
};
```

**DEPOIS:**
```typescript
const transaction = {
  product_name: t.product_name,
  product_price: t.product_price,
  installment_number: t.installment_number,
  gross_override: t.gross_override,
  reference_price: t.reference_price,
};
```

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `useTeamRevenueByMonth.ts` | Trocar RPC e adicionar `reference_price` |
| `useUltrametaByBU.ts` | Trocar RPC e adicionar `reference_price` |

## Resultado Esperado

Apos a correcao:

- **Faturamento Janeiro 2026:** ~R$ 2.035.898 (aproximadamente R$ 2.038.000)
- Apenas produtos com `target_bu = 'incorporador'` serao contabilizados
- O calculo respeitara os `reference_price` configurados
- Consistencia com a RPC `get_first_transaction_ids`

