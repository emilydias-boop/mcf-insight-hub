

## Corrigir valores de Incorporador na Home (Ultrameta)

### Problema
O hook `useUltrametaByBU` usa a RPC `get_all_hubla_transactions` para calcular o valor do Incorporador. Essa RPC retorna **todas** as transações Hubla de **todas as BUs**, não apenas as do Incorporador. O resultado é um valor incorreto no card da Home.

O dashboard de Setores usa corretamente `get_hubla_transactions_by_bu` com `p_bu: 'incorporador'`, que filtra apenas transações mapeadas para aquela BU via `product_configurations`. Por isso os valores divergem.

### Correção

**Arquivo: `src/hooks/useUltrametaByBU.ts`**

Trocar a chamada de `get_all_hubla_transactions` por `get_hubla_transactions_by_bu` com `p_bu: 'incorporador'`, alinhando com a mesma lógica do `useSetoresDashboard`:

```typescript
// ANTES (linha 51):
supabase.rpc('get_all_hubla_transactions', {
  p_start_date: ...,
  p_end_date: ...,
  p_limit: 10000,
  p_search: null,
  p_products: null,
}),

// DEPOIS:
supabase.rpc('get_hubla_transactions_by_bu', {
  p_bu: 'incorporador',
  p_start_date: ...,
  p_end_date: ...,
  p_limit: 10000,
  p_search: null,
}),
```

Isso garante que os dois dashboards (Home e Setores) consultem a mesma fonte filtrada por BU e retornem valores consistentes.

### Arquivo alterado
- `src/hooks/useUltrametaByBU.ts` (1 linha de chamada RPC)

