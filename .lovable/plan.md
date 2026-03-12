

## Corrigir visão "Por Cliente" — Bruto por categoria usando preço de referência

### Problema
Na visão "Por Cliente", o bruto por categoria (A010, Contrato, Parceria, Outros) está usando `getDeduplicatedGross()` que zera transações duplicadas do mesmo cliente+produto. Isso faz com que o Andre, que tem 2 transações A001, mostre o bruto correto no total (16.5k), mas o líquido da segunda transação (2.3k) ainda é somado. O problema é que no campo "Bruto Outros" pode aparecer 3k da segunda transação em vez de 0.

Além disso, o **bruto por categoria deveria usar o preço de referência** (a primeira transação do grupo) e **somar todos os líquidos** incluindo P2 e parceria.

### Solução

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

Ajustar a lógica de `byClientRows` (linhas ~606-668):

1. **Bruto por categoria**: Manter `getDeduplicatedGross()` para o cálculo — ele já retorna 0 para duplicatas e o preço de referência para a primeira. A soma por categoria já funciona corretamente.

2. **Líquido**: Já soma todos os `net_value` (incluindo P2 e parceria) — isso está correto.

3. **Problema real**: A segunda transação A001 do Andre tem `product_price = 3000` e `getDeduplicatedGross` pode estar retornando 3000 ao invés de 0 se o `globalFirstIds` não está detectando corretamente a duplicata (pode ser que as duas transações têm datas diferentes ou product_names ligeiramente diferentes que quebram a deduplicação).

4. **Fix**: Na aggregação `byClientRows`, usar uma deduplicação **local** por `email+product_category` ao invés de depender do `globalFirstIds`:
   - Para cada grupo `email+category`, apenas a **primeira transação** (por data) conta o bruto (usando preço de referência via `getDeduplicatedGross` com `isFirst=true`)
   - Transações subsequentes do mesmo `email+category` contribuem apenas com o líquido

5. **Implementação concreta**:
```typescript
// Dentro do loop de byClientRows:
const localFirstByCategory = new Map<string, boolean>();
// Pré-ordenar filteredTransactions por sale_date asc
const sorted = [...filteredTransactions].sort((a,b) => 
  (a.sale_date || '').localeCompare(b.sale_date || '')
);
sorted.forEach(tx => {
  const key = email + '|' + category;
  const isFirstForCategory = !localFirstByCategory.has(key);
  if (isFirstForCategory) localFirstByCategory.set(key, true);
  
  const grossVal = isFirstForCategory 
    ? getDeduplicatedGross(tx, true)  // força isFirst=true para pegar referência
    : 0;
  // ... soma grossVal na categoria correspondente
});
```

### Escopo
- Apenas `src/components/relatorios/SalesReportPanel.tsx`, lógica do `byClientRows` useMemo

