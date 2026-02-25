

## Problema: Bruto do A009 mostra R$ 19.500 em vez de R$ 24.500

### Causa raiz

O hook `useR2CarrinhoVendas.ts` tem uma função **hardcoded** de preços na linha 13-22:

```typescript
const getProductReferencePrice = (productName: string | null): number | null => {
  if (upper.includes('A009')) return 19500;  // ← HARDCODED!
  if (upper.includes('A001')) return 14500;  // ← HARDCODED!
  ...
};
```

Essa função é usada para calcular o `consolidated_gross` (linha 386-388), que é o valor exibido na coluna "Bruto" da aba Vendas. Ou seja, **mesmo com o histórico de preços corrigido no banco**, o bruto ignora completamente o banco e usa valores fixos no código.

A função SQL `get_effective_price` retorna 24500 corretamente para vendas de 25/02, mas o Carrinho R2 nunca a chama.

### Solução

Substituir a função hardcoded `getProductReferencePrice` por uma chamada ao cache de preços que já existe no sistema (`getCachedFixedGrossPrice` do `useProductPricesCache`), ou melhor ainda, usar a RPC `get_effective_price` para cada transação.

A abordagem mais eficiente: usar o cache local (`getCachedFixedGrossPrice`) que já é carregado no `App.tsx` e lê da tabela `product_configurations`. Isso pega o **preço atual** do produto. Para respeitar o histórico (preço vigente na data da venda), seria necessário chamar `get_effective_price` -- mas isso requer uma chamada ao banco por transação.

Abordagem recomendada (balanceia precisão e performance):

1. Buscar os `product_configurations` relevantes uma vez no hook
2. Para cada transação, chamar `get_effective_price` via RPC para obter o preço correto na data da venda
3. Remover completamente a função hardcoded `getProductReferencePrice`

### Alterações

| Arquivo | Mudança |
|---|---|
| `src/hooks/useR2CarrinhoVendas.ts` | Remover `getProductReferencePrice` hardcoded; buscar preços de referência via `product_configurations` + `get_effective_price` do banco |

### Detalhes da implementacao

**No hook `useR2CarrinhoVendas.ts`:**

1. Remover a funcao `getProductReferencePrice` (linhas 13-22)
2. Apos obter as transacoes matched, coletar os `product_name` unicos
3. Buscar os `product_configurations` correspondentes (por nome ou codigo)
4. Para cada produto, chamar `get_effective_price(config_id, sale_date)` para obter o preco correto na data da venda
5. Usar esse preco no calculo de `consolidatedGross` (linha 382-403)

Para evitar N chamadas RPC individuais, uma alternativa mais eficiente:
- Buscar todos os registros de `product_price_history` para os configs relevantes
- Resolver o preco localmente no JS (mesma logica da funcao SQL)

Ou a abordagem mais simples: buscar o `reference_price` atual da `product_configurations` (que ja foi atualizado para 24500) e usar diretamente, ja que o historico de precos so importa para transacoes anteriores a mudanca.

### Impacto

Apos a correcao:
- Jessé (A009): Bruto muda de R$ 19.500 para R$ 24.500
- Willians (A009): Bruto muda de R$ 19.500 para R$ 24.500
- Bruto total da semana aumenta em R$ 10.000 (2 vendas x R$ 5.000 de diferenca)
- Qualquer futura mudanca de preco em Produtos sera refletida automaticamente no Carrinho sem precisar alterar codigo

